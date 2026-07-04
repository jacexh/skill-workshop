---
name: ddd-golang-runtime
description: Go runtime patterns for DDD services — fx-based configuration management, graceful shutdown, lifecycle hooks, and Kubernetes deployment. Use when editing cmd/**/main.go, internal/pkg/<middleware>/**.go (mysql, redis, kafka, taskqueue, httpsrv, grpcsrv, eventbus, etc.), fx.Module assembly, fx.Lifecycle hooks, OnStart/OnStop logic, shutdown ordering, or Kubernetes preStop hooks in Go DDD services. Complements ddd-golang.md (layers, aggregates, repositories), ddd-golang-events-messages.md (events/messages), and ddd-golang-taskqueue.md (task queues, polling jobs, asynq workers).
---

# Go Runtime Patterns for DDD
## Configuration, Lifecycle, Graceful Shutdown

**Version**: v1.1
**Date**: 2026-06-01
**Scope**: Go runtime patterns complementing [`ddd-golang.md`](ddd-golang.md)
**Phase routing**:
- **Phase skill**: Start from [`design`](../skills/design/SKILL.md), [`implement`](../skills/implement/SKILL.md), or [`review`](../skills/review/SKILL.md). Load this file only when the active phase needs Go runtime, config, lifecycle, shutdown, or Kubernetes rules.
- **Agent contract**: [`ddd-agent-contract.md`](ddd-agent-contract.md) — Load when the phase needs runtime-only classification, prohibited actions, or runtime self-checks.
- **Go implementation**: [`ddd-golang.md`](ddd-golang.md) — Layer responsibilities, directory layout, naming, error handling. This runtime guide covers what `ddd-golang.md` defers to: config plumbing, process lifecycle, graceful shutdown, k8s.
- **Events / messages**: [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md) — Domain Event / Integration Message semantics, handler roles, and message adapter boundaries.
- **Task queues / polling**: [`ddd-golang-taskqueue.md`](ddd-golang-taskqueue.md) — Task-specific placement, `TaskType`, schema registry, processors, asynq worker wiring, and middleware.

> **Code blocks are illustrative**, not copy-paste templates. Imports may be omitted and identifiers may reference types defined elsewhere in the project. See [`ddd-agent-contract.md` §6](ddd-agent-contract.md).

> **When to read this file**:
> - Editing `cmd/server/main.go` or any `cmd/**/main.go`
> - Editing `internal/pkg/<middleware>/*.go` (adding a new shared middleware client)
> - Editing `internal/pkg/taskqueue/**`, task worker lifecycle hooks, or asynq client/worker wiring
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

- Initialize shared middleware clients in `internal/pkg/<middleware>`: `internal/pkg/mysql`, `internal/pkg/redis`, `internal/pkg/kafka`, `internal/pkg/taskqueue`, etc.
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

Then: register `fx.Provide(redis.NewClient)` in `internal/pkg/module.go`, add a `Redis redis.Option` field (with `yaml:"redis"` tag) to the top-level `Option` in `cmd/server/main.go` (see §1.2), and add a `redis:` block to `configs/defaults.yml`. The component never imports anything from `cmd/`, and `main` never imports `redis.Client` — `fx` wires both ends through the typed `Option`.

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
    err := loader.Load(
        &opt,
        loader.WithConfigurationDirectory("./configs", "defaults"),
        loader.WithConfigFilePrefix("app"),
        loader.WithEnvVarsPrefix("APP"),
    )
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

Configuration files are stored under the `configs/` directory. `loader.Load` uses these defaults unless the service passes explicit loader options:

- Configuration directory: `./configs`
- Base config file name without extension: `defaults`
- Profile file prefix: empty by default; required when a profile is active
- Environment variable prefix: empty
- Profile source: `JIMU_PROFILES_ACTIVE`, applied automatically by `loader.Load`

Prefer passing `loader.WithConfigurationDirectory("./configs", "defaults")` in `main` even when using the defaults. The explicit call documents the runtime contract and makes non-standard command layouts obvious during review. If the service supports environment profiles, also pass `loader.WithConfigFilePrefix("<service-or-app-name>")`; otherwise setting `JIMU_PROFILES_ACTIVE` makes startup fail because the loader cannot identify which profile file belongs to the process.

`loader.Load` discovers the base file by exact stem and the profile file by exact `prefix + "_" + profile` stem:

```
configs/
├── defaults.yml         # Base configuration, loaded first when present
├── app_prod.yml         # Profile override when prefix=app and profile=prod
└── app_staging.toml     # Profile override when prefix=app and profile=staging
```

Profile switching uses a single profile alias. At startup `loader.Load` applies `loader.WithProfilesActiveFromEnvVar()` after caller-supplied options, so the environment variable overrides any `loader.WithProfilesAlias(...)` value in code:

```bash
export JIMU_PROFILES_ACTIVE=prod
```

With `JIMU_PROFILES_ACTIVE=prod` and `loader.WithConfigFilePrefix("app")`, the loader reads the base file whose stem is exactly `defaults`, then the profile file whose stem is exactly `app_prod`. Profile files are merged on top of the base file, so they should contain only the environment-specific deltas. Keep profile names simple (`dev`, `test`, `staging`, `prod`); do not rely on comma-separated multi-profile semantics unless the adopted `config/loader` version explicitly documents splitting.

Supported formats include YAML, TOML, JSON, and any registered config codec. The file extension determines the codec.

### 1.4 Environment Variable Override

`loader.Load` appends an environment-variable source after file sources. `loader.WithEnvVarsPrefix("APP")` makes the env source read only variables with the `APP_` prefix and strips that prefix before inserting keys into the config map. The profile selector `JIMU_PROFILES_ACTIVE` is read separately and is not affected by this prefix.

The env source is flat. It can override a config key only when the remaining env key matches the config path the loader understands; it does not translate conventional shell names such as `APP_MYSQL_DSN` into nested `mysql.dsn`. For nested service settings, prefer **placeholder syntax** `${VAR:default}` in config files:

With the `loader.WithEnvVarsPrefix("APP")` example in §1.2, set variables such as `APP_LOG_LEVEL` or `APP_MYSQL_DSN`; the prefix is stripped before placeholder resolution, so the YAML still references `${LOG_LEVEL:...}` and `${MYSQL_DSN:...}`.

```yaml
# configs/defaults.yml
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

1. Loader options are resolved. Defaults are `./configs`, `defaults`, no profile file prefix, and no env prefix; `JIMU_PROFILES_ACTIVE` then overrides any code-supplied profile alias.
2. Base file source — the file whose stem equals the configured default name, loaded first when present.
3. Profile file source — when a profile is active, the file whose stem equals `WithConfigFilePrefix(...) + "_" + profile`, merged on top of the base file. Startup fails if a profile is active and no config-file prefix was configured.
4. Environment source — variables collected into a flat key-value pool, optionally filtered and trimmed by `WithEnvVarsPrefix`.
5. Resolve phase — `${VAR:default}` placeholders in the merged config are expanded using the config map, including values contributed by the env source. If the key is absent, the default value after `:` is used.

Do not branch in `main` on deployment environment names. Express environment differences as profile files plus placeholders, then load once into the aggregate `Option` and supply it to `fx`.

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

### 2.2 Fx Module Assembly Guardrails

`cmd/<service>/main.go` is the process entry point, not the place where provider details accumulate. It loads config, logs the resolved config, supplies the aggregate `Option`, selects modules, sets process-level fx options, and runs the app. Provider construction belongs to modules.

Use this ownership split:

- `cmd/<service>/main.go` — config load, `fx.Supply(opt)` or `fx.Provide(parseOption)`, module selection, `fx.StopTimeout`, `fx.NopLogger`, `app.Run()`.
- `internal/pkg/module.go` — shared runtime module assembly. It registers middleware clients, servers, telemetry, taskqueue/message runtime, and named service runtime modules when a multi-service repo needs different shared runtime sets.
- `internal/business/<context>/<context>.go` — bounded-context module assembly: repositories, query repositories, application service, event/message handlers, handler registration, and context-scoped Infrastructure adapters.
- `internal/business/<context>/infrastructure` or an explicit ACL package — adapter implementation details for context-owned ports and cross-context/client translations. `cmd` must not implement those adapters as inline `fx.Provide(func(...) SomePort { ... })` closures.

For a multi-service project, keep the service-to-service runtime difference in `internal/pkg/module.go`, not spread across `cmd/**/main.go`. Define multiple module variables such as `FooModule`, `BarModule`, `DispatcherModule`, or `SandboxModule` in that file; each entry point imports `internal/pkg` and loads the one it needs.

```go
// internal/pkg/module.go
package pkg

import (
    "github.com/example/project/internal/pkg/httpserver"
    "github.com/example/project/internal/pkg/kafka"
    "github.com/example/project/internal/pkg/mysql"
    "github.com/example/project/internal/pkg/redis"
    "github.com/example/project/internal/pkg/taskqueue"
    "go.uber.org/fx"
)

var DispatcherModule = fx.Module(
    "internal.pkg.dispatcher",
    fx.Provide(httpserver.New),
    fx.Provide(redis.NewClient),
    fx.Provide(kafka.NewProducer),
    fx.Provide(kafka.NewConsumerFactory),
    fx.Provide(mysql.NewClient),
)

var SandboxModule = fx.Module(
    "internal.pkg.sandbox",
    fx.Provide(httpserver.New),
    fx.Provide(redis.NewClient),
    taskqueue.Module,
    fx.Provide(mysql.NewClient),
)
```

Then the entry point stays thin:

```go
app := fx.New(
    fx.Supply(opt),
    fx.Provide(sloghelper.NewLog),
    pkg.DispatcherModule, // service runtime difference is selected here
    dispatcher.Module,    // bounded context owns its own providers
    fx.StopTimeout(30*time.Second),
    fx.NopLogger,
)
app.Run()
```

Review signals that require a rewrite or a written exception:

- `cmd/**/main.go` imports a bounded context's `infrastructure`, `application/command`, `application/query`, `application/eventhandler`, `application/messagehandler`, or `application/messagepublisher` package.
- `cmd/**/main.go` imports generated Connect/gRPC handler packages to register routes directly. Handler registration belongs to the bounded-context module.
- `cmd/**/main.go` contains provider closures that return Domain/Application ports, repositories, query repositories, ACL clients, routing directories, peer clients, publishers, or handler wrappers.
- `cmd/**/main.go` manually supplies many config fields such as `fx.Supply(opt.Redis)`, `fx.Supply(opt.Kafka)`, or `fx.Supply(opt.HTTPServer)` instead of supplying one aggregate `Option` with `fx.Out`.
- A repo has multiple shared runtime packages under `internal/pkg/*` but no `internal/pkg/module.go` that names the public runtime modules.
- Service-specific runtime choices are encoded as repeated provider lists in each `cmd/<service>/main.go` instead of named modules in `internal/pkg/module.go`.

Lightweight smoke scans before approving runtime wiring:

```bash
# cmd should select modules, not import inner business implementation packages.
rg -n 'internal/.*/(infrastructure|application/(command|query|eventhandler|messagehandler|messagepublisher))' cmd

# handler registration should live in bounded-context modules.
rg -n 'pkg/gen/.*(connect|grpc)|connectrpc.com/connect|google.golang.org/grpc' cmd

# per-field option supply usually means the aggregate Option is not doing its job.
rg -n 'fx\.Supply\(opt\.' cmd

# provider-heavy cmd files are review targets; most should have only config/bootstrap providers.
rg -n 'fx\.Provide\(' cmd

# shared runtime packages should have a public module assembly point.
test -f internal/pkg/module.go || rg -n 'fx\.Module|fx\.Provide' internal/pkg
```

Treat these scans as review targets, not proof. A hit is acceptable only when the Architecture Gate or runtime impact note states why the provider is truly process-owned and cannot live in `internal/pkg/module.go`, a bounded-context module, or an ACL/infrastructure package.

### 2.3 Lifecycle Hooks

Components that have **in-flight work** at shutdown time must register `fx.Lifecycle` hooks to drain gracefully. Pure connection clients do not need drain-style hooks, but they may register `Close` hooks for cleanup when the library exposes one.

**Needs OnStop** (has in-flight work):

| Component | In-flight work | OnStop action |
|-----------|---------------|---------------|
| HTTP Server | HTTP requests being processed | `srv.Shutdown(ctx)` — stop accepting, drain in-flight requests |
| gRPC Server | RPC calls being processed | `server.GracefulStop()` — stop accepting, drain in-flight calls |
| EventBus (Dispatcher) | Queued event batches + the handler invocation currently running on the worker | `dispatcher.Close(ctx)` — wait `delayClose`, reject new events, drain queued/in-flight batches |
| Message queue consumer | Messages being processed | Stop consuming, finish current batch |
| Task queue worker | Task processors currently running | `worker.Shutdown(ctx)` — stop accepting new tasks, wait for in-flight processors |

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
            go func() {
                if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
                    slog.Error("http server stopped unexpectedly", sloghelper.Error(err))
                }
            }()
            return nil
        },
        OnStop: func(ctx context.Context) error {
            return srv.Shutdown(ctx)
        },
    })
    return srv
}
```

gRPC Server follows the same pattern: OnStart binds listener + starts `server.Serve(ln)` in a goroutine that records unexpected serve errors; OnStop calls `server.GracefulStop()`.

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

#### Runtime Execution Boundary Logs

Runtime components that own execution without an outer request middleware must log one completion summary per operation. This includes consumer loops, scheduler ticks, reconcilers, task processors, lifecycle hooks that perform work, and external-system call wrappers that own retry or polling behavior.

Use the same fields as `ddd-golang.md §8.2`:

- `operation`: stable operation name such as `kafka.consumer.tick`, `work.reconcile`, or `task.process`
- `outcome`: `success`, `failed`, `skipped`, or `retrying`
- `duration_ms`: wall-clock duration
- `error`: `sloghelper.Error(err)` on failed or retrying outcomes
- relevant IDs: aggregate/entity IDs, `event_kind`, `message_id`, `correlation_id`, consumer name, task type, or scheduler name

`started` / `requested` logs may appear when useful, but they do not replace the completion summary. Missing targets, already-applied inputs, disabled work, and no-op guards are observable outcomes and should be logged as `outcome=skipped` with a stable `skip_reason`.

### 2.4 Shutdown Ordering

`fx` executes OnStop hooks in **reverse order of OnStart**. Correct shutdown order comes from actual constructor dependencies, `fx.Invoke` wiring, and lifecycle hook registration order; it is not implied by the conceptual architecture diagram. Encode the dependencies that must remain available during drain, so servers/consumers/workers stop before event dispatchers and storage clients they may still use:

```
Start order (must be encoded by dependency graph / invokes):
  EventBus → MySQL → Application → Server

Stop order (automatic reverse of the encoded start order):
  Server.OnStop        → drain in-flight requests
                          (last requests may dispatch final events via dispatcher.DispatchAll(events.Drain()))
  EventBus.OnStop      → drain queued/in-flight event batches (single worker, sequential)
                          (handlers can still access MySQL)
  Process exits        → OS reclaims all connections
```

MySQL has no in-flight work to drain, so it remains available while Server and EventBus handlers finish. If the MySQL package registers a `Close` cleanup hook, it must run after consumers have stopped.

### 2.5 Kubernetes Deployment

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
- [`design`](../skills/design/SKILL.md) / [`implement`](../skills/implement/SKILL.md) / [`review`](../skills/review/SKILL.md) — Phase entrypoints
- [`ddd-agent-contract.md`](ddd-agent-contract.md) — Runtime classification, prohibited actions, and self-checks
- [`ddd-golang.md`](ddd-golang.md) — Go DDD implementation (layers, aggregates, events, integration messages, module assembly)
- [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md) — Go Domain Events, Boundary Publishers, Integration Messages, Kafka adapter wiring
- [`ddd-golang-taskqueue.md`](ddd-golang-taskqueue.md) — Go taskqueue and polling patterns
- [`ddd-core.md`](ddd-core.md) — Language-agnostic DDD + Clean Architecture specification
- [`ddd-modeling.md`](ddd-modeling.md) — Strategic domain modeling
