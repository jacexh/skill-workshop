---
name: ddd-golang-runtime
description: Go runtime patterns for DDD services — fx-based configuration management, graceful shutdown, lifecycle hooks, and Kubernetes deployment. Use when editing cmd/**/main.go, internal/pkg/<middleware>/**.go (mysql, redis, kafka, httpsrv, grpcsrv, eventbus, etc.), fx.Module assembly, fx.Lifecycle hooks, OnStart/OnStop logic, shutdown ordering, or Kubernetes preStop hooks in Go DDD services. Complements ddd-golang.md (layers, aggregates, repositories, events, integration messages).
---

# Go Runtime Patterns for DDD
## Configuration, Lifecycle, Graceful Shutdown

**Version**: v1.0
**Date**: 2026-05-11
**Scope**: Go runtime patterns complementing [`ddd-golang.md`](ddd-golang.md)
**Prerequisites**:
- **Agent contract**: [`ddd-agent-contract.md`](ddd-agent-contract.md) — Code agents must read this first.
- **Go implementation**: [`ddd-golang.md`](ddd-golang.md) — Layer responsibilities, directory layout, naming, error handling. This runtime guide covers what `ddd-golang.md` defers to: config plumbing, process lifecycle, graceful shutdown, k8s.

> **Code blocks are illustrative**, not copy-paste templates. Imports may be omitted and identifiers may reference types defined elsewhere in the project. See [`ddd-agent-contract.md` §6](ddd-agent-contract.md).

> **When to read this file**:
> - Editing `cmd/server/main.go` or any `cmd/**/main.go`
> - Editing `internal/pkg/<middleware>/*.go` (adding a new shared middleware client)
> - Adding `fx.Lifecycle` hooks or `OnStart` / `OnStop` logic anywhere
> - Designing graceful shutdown for a component with in-flight work
> - Wiring fx.Module / fx.Provide / fx.Supply at the top level
> - Tuning Kubernetes deployment manifests for the service

---

## 1. Configuration Management

### 1.1 Option Declaration Convention

Each component owns its `Option`; the top-level `main` only aggregates and distributes. Three rules:

1. **Component-owned `Option`** — Every fx-provided component declares its own `Option` struct in **its own package** (alongside `NewXxx`, or in a sibling `option.go`). Fields carry `json/yaml/toml` tags so the loader can map config files into them.
2. **Constructor consumes `Option` directly** — Signature pattern: `NewXxx(lc fx.Lifecycle, opt Option, ...) (*Xxx, error)`. The component does not know where `Option` came from; `fx` injects it.
3. **Top-level only aggregates** — `cmd/server/main.go` declares one `Option` struct embedding `fx.Out`, with **one field per component**. Field tags map to top-level YAML keys. Never inline a component's leaf fields (host, port, dsn …) into the top-level struct — those belong inside the component's package.

**Business modules follow the same rule.** If a bounded context needs runtime config (e.g., `user.MaxLoginAttempts`), declare `user.Option` in `internal/business/user/option.go` and add a `User user.Option` field to the top-level `Option`.

#### Shared Middleware Client Ownership

- Initialize shared middleware clients in `internal/pkg/<middleware>`: `internal/pkg/mysql`, `internal/pkg/redis`, `internal/pkg/kafka`, etc.
- Each middleware package owns its `Option`, constructor, health/lifecycle hooks, and fx provider.
- Bounded-context Infrastructure packages must not read shared middleware config, open connections, or close clients.
- Repository / QueryRepository / Publisher / Consumer constructors receive initialized clients and adapt them to Domain/Application interfaces.
- Do not create technology-shaped interfaces for raw clients (`RedisClient`, `MysqlReader`, `Cacher`) when an existing Repository / QueryRepository / semantic port already expresses the caller's need. Compose those clients inside the Infrastructure implementation.
- Example: `internal/pkg/mysql.NewClient(...) -> *xorm.Engine`, then `internal/business/user/infrastructure/persistence.NewRepository(db *xorm.Engine)`.

**Example — adding a Redis client.** Declare `Option` next to the constructor:

```go
// internal/pkg/redis/redis.go
package redis

import (
    "context"

    "github.com/redis/go-redis/v9"
    "go.uber.org/fx"
)

type Option struct {
    Addr     string `json:"addr" yaml:"addr" toml:"addr"`
    Password string `json:"password" yaml:"password" toml:"password"`
    DB       int    `json:"db" yaml:"db" toml:"db"`
}

func NewClient(lc fx.Lifecycle, opt Option) *redis.Client {
    client := redis.NewClient(&redis.Options{
        Addr: opt.Addr, Password: opt.Password, DB: opt.DB,
    })
    lc.Append(fx.Hook{
        OnStop: func(ctx context.Context) error { return client.Close() },
    })
    return client
}
```

Then: register `fx.Provide(redis.NewClient)` in `internal/pkg/module.go`, add a `Redis redis.Option` field (with `yaml:"redis"` tag) to the top-level `Option` in `cmd/server/main.go` (see §1.2), and add a `redis:` block to `configs/default.yml`. The component never imports anything from `cmd/`, and `main` never imports `redis.Client` — `fx` wires both ends through the typed `Option`.

### 1.2 Aggregate Configuration in `main`

The aggregate `Option` lives in `cmd/server/main.go`. It embeds `fx.Out` so each field is automatically injected into the component declaring a matching type dependency. Load it once at startup, log it (success or failure), and hand it to `fx.Supply` — no helper function needed. Always log the resolved config so problems are diagnosable from a single line.

```go
// cmd/server/main.go
package main

import (
    "log/slog"
    "os"

    "github.com/go-jimu/components/config/loader"
    "github.com/go-jimu/components/sloghelper"
    "github.com/example/project/internal/pkg/eventbus"
    "github.com/example/project/internal/pkg/grpcsrv"
    "github.com/example/project/internal/pkg/httpsrv"
    "github.com/example/project/internal/pkg/mysql"
    "go.uber.org/fx"
)

// Option holds all infrastructure configuration.
// fx.Out enables automatic distribution — each field is injected
// into the component that declares a matching type dependency.
type Option struct {
    fx.Out
    Logger     sloghelper.Options `json:"logger" toml:"logger" yaml:"logger"`
    MySQL      mysql.Option       `json:"mysql" toml:"mysql" yaml:"mysql"`
    HTTPServer httpsrv.Option     `json:"http-server" toml:"http-server" yaml:"http-server"`
    GRPCServer grpcsrv.Option     `json:"grpc" toml:"grpc" yaml:"grpc"`
    Eventbus   eventbus.Option    `json:"eventbus" toml:"eventbus" yaml:"eventbus"`
}

func main() {
    var opt Option
    err := loader.Load(&opt)
    // Always log the resolved config — even on partial failure it helps diagnose.
    slog.Info("load config", slog.Any("config", opt))
    if err != nil {
        slog.Error("load config failed", slog.Any("error", err))
        os.Exit(1)
    }

    app := fx.New(
        fx.Supply(opt),  // distributes every field via fx.Out
        // ... other providers and modules (see §2.1)
    )
    app.Run()
}
```

> The bootstrap log uses slog's default handler (the configured logger from `sloghelper.NewLog` is not yet wired). That is expected — keep it; it is the only signal you have if `fx` itself fails to start.

### 1.3 Configuration Files & Profiles

Configuration files are stored in the `configs/` directory. `loader.Load` automatically discovers and merges them:

```
configs/
├── default.yml          # Base configuration (always loaded)
└── default_prod.yml     # Profile override (loaded when JIMU_PROFILES_ACTIVE=prod)
```

Profile switching via environment variable:

```bash
export JIMU_PROFILES_ACTIVE=prod   # Loads default.yml, then default_prod.yml overrides
```

Supported formats: YAML, TOML, JSON. The file extension determines the codec.

### 1.4 Environment Variable Override

Environment variables do **not** automatically map to nested config keys (unlike Spring Boot's convention). Instead, use **placeholder syntax** `${VAR:default}` in config files to reference environment variables:

```yaml
# configs/default.yml
logger:
  level: "${LOG_LEVEL:info}"

mysql:
  dsn: "${MYSQL_DSN:root:123456@tcp(localhost:3306)/mydb}"

http-server:
  addr: "${HTTP_ADDR::8080}"

grpc:
  addr: "${GRPC_ADDR::9090}"

eventbus:
  buffer-size: 1024
  delay-close: "5s"
  handler-timeout: "30s"
```

Loading and resolution order:

1. `default.yml` — base configuration
2. `default_<profile>.yml` — profile-specific overrides (merged on top)
3. Environment variables — collected into a flat key-value pool
4. **Resolve phase** — `${VAR:default}` placeholders in the merged config are expanded using the environment variable pool; if the variable is unset, the default value after `:` is used

---

## 2. Entry Point & Graceful Shutdown

### 2.1 Entry Point

Use `app.Run()` as the standard entry point — it encapsulates Start → Wait for SIGINT/SIGTERM → Stop → Exit. The full `main()` (with config loading and bootstrap logging) is in §1.2; the module wiring inside `fx.New` is what differs per service:

```go
app := fx.New(
    fx.Supply(opt),                  // distributes every field via fx.Out (see §1.2)
    fx.Provide(sloghelper.NewLog),
    fx.Provide(eventbus.NewDispatcher),
    pkg.Module,                      // infrastructure adapters (internal/pkg)
    user.Module,                     // bounded contexts (internal/business/<module>)
    fx.StopTimeout(30*time.Second),
    fx.NopLogger,
)
app.Run()
```

`Run()` internally uses `app.Wait()` (not `app.Done()`), which returns `ShutdownSignal{Signal, ExitCode}` — properly propagating exit codes when a component triggers shutdown via `fx.Shutdowner`.

**When to use manual Start/Wait/Stop instead**: only when you need post-shutdown logic before exit (e.g., flushing telemetry). For most services, `app.Run()` is sufficient.

### 2.2 Lifecycle Hooks

Components that have **in-flight work** at shutdown time must register `fx.Lifecycle` hooks to drain gracefully. Pure connection clients do not need drain-style hooks, but they may register `Close` hooks for cleanup when the library exposes one.

**Needs OnStop** (has in-flight work):

| Component | In-flight work | OnStop action |
|-----------|---------------|---------------|
| HTTP Server | HTTP requests being processed | `srv.Shutdown(ctx)` — stop accepting, drain in-flight requests |
| gRPC Server | RPC calls being processed | `server.GracefulStop()` — stop accepting, drain in-flight calls |
| EventBus (Dispatcher) | Queued event batches + the handler invocation currently running on the worker | `dispatcher.Close(ctx)` — wait `delayClose`, reject new events, drain queued/in-flight batches |
| Message queue consumer | Messages being processed | Stop consuming, finish current batch |

Pure connection clients (MySQL, Redis, HTTP Client) do not need drain-style OnStop hooks — they have no in-flight work of their own. They may still register cleanup hooks such as `client.Close()`.

#### Server: Listen/Serve Separation

Separate `net.Listen` (synchronous, in OnStart) from `Serve` (asynchronous, in goroutine). Startup errors (e.g., port already in use) are caught immediately and cause `app.Start` to fail. OnStop drains in-flight requests before returning.

```go
// internal/pkg/httpsrv/server.go
func NewHTTPServer(lc fx.Lifecycle, opt Option) *http.Server {
    srv := &http.Server{Addr: opt.Addr, Handler: mux}

    lc.Append(fx.Hook{
        OnStart: func(ctx context.Context) error {
            ln, err := net.Listen("tcp", srv.Addr)
            if err != nil {
                return err
            }
            go srv.Serve(ln)
            return nil
        },
        OnStop: func(ctx context.Context) error {
            return srv.Shutdown(ctx)
        },
    })
    return srv
}
```

gRPC Server follows the same pattern: OnStart binds listener + `go server.Serve(ln)`; OnStop calls `server.GracefulStop()`.

#### EventBus: Drain Queued Event Batches

```go
// internal/pkg/eventbus/eventbus.go
package eventbus

import (
    "context"
    "log/slog"
    "time"

    "github.com/go-jimu/components/ddd/event"
    "go.uber.org/fx"
)

// Option owns the dispatcher's tunable settings (per §1.1 — each component
// declares its own Option; the third-party package no longer ships a config struct).
type Option struct {
    BufferSize     int           `json:"buffer-size" toml:"buffer-size" yaml:"buffer-size"`
    DelayClose     time.Duration `json:"delay-close" toml:"delay-close" yaml:"delay-close"`
    HandlerTimeout time.Duration `json:"handler-timeout" toml:"handler-timeout" yaml:"handler-timeout"`
}

// NewDispatcher returns the in-memory dispatcher under both faces it implements.
// fx wires each return value by its declared type, so consumers inject whichever
// face they need; both views point to the same underlying *event.InMemoryDispatcher.
func NewDispatcher(lc fx.Lifecycle, opt Option, logger *slog.Logger) (event.Dispatcher, event.Subscriber) {
    d := event.NewDispatcher(
        event.WithLogger(logger),
        event.WithBufferSize(opt.BufferSize),
        event.WithDelayClose(opt.DelayClose),
        event.WithHandlerTimeout(opt.HandlerTimeout),
    )
    lc.Append(fx.Hook{
        OnStop: func(ctx context.Context) error {
            // Close first sleeps for delayClose (the dispatcher still accepts new
            // events during this grace window), then marks itself closed and waits
            // for the single worker to drain the queue and finish the in-flight
            // batch. fx.StopTimeout (passed via ctx) is the hard cap on the total.
            return d.Close(ctx)
        },
    })
    return d, d
}
```

The example wires only the YAML-friendly options. `event` also exposes callback-shaped hooks that don't belong in config but are wired here when needed: `event.WithContextFactory` (per-dispatch context derivation, e.g. propagate trace IDs), `event.WithUnhandledEventHandler` (events with no registered handler — useful for surfacing typos and dead kinds), `event.WithPanicHandler` (recovered handler panics — forward to metrics/alerting), and `event.WithCloseInterruptedHandler` (snapshot of accepted-but-unhandled batches when `Close` is cut short by `ctx.Done()`).

### 2.3 Shutdown Ordering

`fx` executes OnStop hooks in **reverse order of OnStart**. The dependency graph naturally produces the correct shutdown sequence:

```
Start order (determined by dependency graph):
  EventBus → MySQL → Application → Server

Stop order (automatic reverse):
  Server.OnStop        → drain in-flight requests
                          (last requests may dispatch final events via dispatcher.DispatchAll(events.Drain()))
  EventBus.OnStop      → drain queued/in-flight event batches (single worker, sequential)
                          (handlers can still access MySQL)
  Process exits        → OS reclaims all connections
```

MySQL has no in-flight work to drain, so it remains available while Server and EventBus handlers finish. If the MySQL package registers a `Close` cleanup hook, it must run after consumers have stopped.

### 2.4 Kubernetes Deployment

When deploying to Kubernetes, there is a **race condition** between SIGTERM delivery to the Pod and kube-proxy removing the Pod from the Service's Endpoints. During this window (typically a few seconds), new requests may still be routed to a Pod that is already shutting down.

This is a **network-layer concern, not an application-layer concern**. The recommended solution is a `preStop` hook that delays SIGTERM delivery, giving kube-proxy time to complete the endpoint update:

```yaml
spec:
  terminationGracePeriodSeconds: 60
  containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command: ["sleep", "5"]
```

The sequence becomes:

```
Kubernetes initiates Pod deletion
  ├─ async: kube-proxy starts removing Pod from Endpoints
  ├─ sync:  preStop executes → sleep 5s (app still serving normally)
  └─ after preStop: SIGTERM → app.Run() triggers OnStop hooks → graceful shutdown
```

> **Note**: For low-traffic internal services, the impact of this race condition is minimal (a few connection-refused errors, retried by clients). The `preStop` hook is most important for high-traffic, user-facing services.

---

**References:**
- [`ddd-agent-contract.md`](ddd-agent-contract.md) — Agent execution contract (read first)
- [`ddd-golang.md`](ddd-golang.md) — Go DDD implementation (layers, aggregates, events, integration messages, module assembly)
- [`ddd-core.md`](ddd-core.md) — Language-agnostic DDD + Clean Architecture specification
- [`ddd-modeling.md`](ddd-modeling.md) — Strategic domain modeling
