---
name: ddd-golang-runtime
description: Go House Style for config loading, Fx composition and lifecycle, the shared ConnectRPC server, execution-boundary logging, and shutdown.
---

# Go Runtime

## Applies When

Runtime owns process configuration, shared technical resources, active loops, composition, startup, and shutdown. It contains no business policy. Shared runtime packages live under `internal/pkg/<capability>`; bounded contexts contribute modules, handlers, and adapters.

## Mandatory Runtime Stack

For covered Go House Style concerns use:
- `github.com/go-jimu/components/config/loader` for configuration;
- `go.uber.org/fx` for dependency injection and lifecycle;
- `log/slog` with `github.com/go-jimu/components/sloghelper` for structured logs;
- `connectrpc.com/connect/v2` on one standard-library `http.ServeMux` listener for the shared RPC/HTTP server;
- `github.com/samber/oops` when an external/runtime error first enters controlled code.
Generated Protobuf and Connect files live under `gen/` and are never edited manually. Contract sources live under `proto/`. Runtime mounts generated handlers; Application never implements generated server interfaces.

## Component-Owned Configuration

Each runtime component owns an Option/Config type and `Validate() error` beside its constructor. The process aggregates those types only for loading and Fx supply: its `Option` embeds `fx.Out` and holds one `json`/`yaml`/`toml`-tagged field per component Option, so `fx.Supply(option)` provides each one.

`main` loads with `loader.WithConfigurationDirectory("./configs/<service>", "defaults")`, logs a load failure and exits non-zero, logs an allow-listed startup summary, then runs `fx.New` with the Option, `sloghelper.NewLog`, `pkg.Module`, the selected context modules, `pkg.Lifecycle`, `fx.StartTimeout(15*time.Second)`, and `fx.StopTimeout(30*time.Second)`.

Each `cmd/<service>` loads only its own `configs/<service>` directory; never scan the shared `configs` parent in a multi-service repository. When profiles are supported, also pass `loader.WithConfigFilePrefix("app")`. Use `loader.WithEnvVarsPrefix("APP")` when the repository wants `${NAME:default}` placeholders to read only `APP_`-prefixed variables.
Never log the aggregate Option, a resolved config map, DSN, password, token, API key, certificate/private key, cookie, secret-bearing URL, or full environment. Startup summaries are allow-list based: profile/source, enabled modules, non-secret listen addresses, counts, and a non-reversible config version/hash.

## Composition Boundaries

`cmd/main.go` loads configuration, selects modules, sets process timeouts, and runs Fx. It does not construct Repositories, clients, generated handlers, or lifecycle loops individually. `internal/pkg/module.go` exposes `pkg.Module`, an `fx.Module("internal.pkg", ...)` that provides shared technical resources such as the shared Connect server and MySQL driver.

A bounded-context module owns its providers and registrations. It may import generated Transport contracts from `gen/`; `cmd` does not. `<context>.go` exposes `fx.Module("business.<context>", ...)`: it provides the context's Repository adapters, `application.NewApplication`, and Transport handlers, and in `fx.Invoke` registers each generated Connect handler on the shared `Server`'s `connect.Server` through its generated `Register*Handler` function, which applies the shared interceptor chain.

For multi-service repositories, expose named `internal/pkg` modules rather than copying provider lists across `cmd/<service>`. Use `fx.ValidateApp` in a wiring test to prove the graph is complete without starting providers.

## Active Resource Ownership

For changes to the shared RPC/HTTP server itself, read the
[ConnectRPC server guide](ddd-golang-server.md). A change only to Fx
providers uses the composition rules above.

Every optional active resource follows the same ownership rule: the package
that creates it owns its start and stop behavior, goroutines, terminal errors,
and bounded drain. An entry point, the event dispatcher, or the Outbox exposes
its hook for `pkg.Lifecycle` to order, as [Shutdown](#shutdown) describes.
Provider-specific construction stays in the provider leaf.

## Execution Owner Logs And Errors

The router's caller rule decides who logs an execution. Runtime passes the process logger to every go-jimu component and provider adapter, and owns one log for each lifecycle operation it executes itself. Infrastructure enriches and returns errors unless it owns suppression or a terminal operation.

The shared Connect interceptor wraps every unary and streaming RPC except health checks. It stores the process logger with `sloghelper.NewContext`, recovers a handler panic as `internal`, and records one `request complete` entry with `operation` (the procedure), `elapsed_ms`, `outcome`, and `connect_code`. The level follows what the code means for the service: client-caused outcomes at Info, transient service or dependency failures at Warn, server faults at Error. A failure entry logs the cause behind the `*connect.Error`, not the message sent to the client.

At the first controlled boundary, enrich and wrap once with `oops.With(...).Wrap(providerErr)`; use `oops.Wrap(providerErr)` only when there is no owned context. Never wrap an already wrapped provider error again. Later layers add context only for new semantics, preserve `errors.Is/As`, and do not mechanically wrap or log-and-return the same error. Expected rejection is not an internal failure. Never log secret configuration, credentials, full payloads, or sensitive personal data.

## Shutdown

Shutdown drains the process's execution entry points so every running
execution reaches its end: committed or rolled back, acknowledged or left for
redelivery. Running work finishes on a context the stop does not cancel,
bounded by its own timeout; only the end of the Fx stop timeout abandons it.

1. Entry points stop taking work and finish what is running: the RPC/HTTP
   server after readiness turns NOT_SERVING, message consumers through their
   graceful `Shutdown`, task workers and schedulers. They hand no work to one
   another in-process, so their relative order is free.
2. The Domain Event dispatcher closes last: every entry point may raise Domain
   Events, and `Close` drains their follow-ups until idle. With an Outbox,
   `Close` also stops the Relay, and the records it does not finish stay
   pending in the database. Best-effort handlers are the only work lost when
   time runs out.
3. The process exits. Connection pools such as MySQL and Redis stay open. A
   client closes only when closing completes work, such as flushing telemetry
   or leaving a consumer group, and only after every user of it has stopped.

Constructors register the hooks of the resources they open. The entry-point
and dispatcher order has no constructor edge to carry it, so
`internal/pkg/lifecycle.go` exposes `pkg.Lifecycle`, listed after every
bounded-context module, which appends those hooks in start order (dispatcher
or Relay, then entry points); Fx stops them in reverse.

Fx runs stop hooks one after another on one deadline, so the readiness delay,
request drain, handler timeouts, and dispatcher drain add up within the Fx stop
timeout, which stays below the deployment's termination grace. Every goroutine
needs cancellation or Close plus a surfaced terminal-error path.

## Observability

When accepted observability includes OpenTelemetry, load
[`ddd-golang-observability.md`](ddd-golang-observability.md). Runtime remains the
owner of logging and the execution boundary; the observability leaf owns the
OTel-specific constructors and propagation shape.

## Verification

Select evidence for the changed runtime behavior and its affected dependencies:

| Changed behavior | Evidence |
|---|---|
| Option validation, loading, or profiles | Affected validation and defaults/profile cases |
| Configuration or startup logging | Affected allow-listed output and secret redaction |
| Fx providers or dependency wiring | `fx.ValidateApp` composition; registration/reachability when those change |
| Shared RPC/HTTP server | Affected cases in the server guide |
| Execution logging | Affected completion outcome, level, and error mapping |
| Active loop or shutdown | Affected reachability, running work finishing on a graceful stop, and bounded stop |
| OpenTelemetry | Affected observability-leaf cases |

Reuse valid unaffected evidence. Broaden only for new changes, failures, or an
unresolved risk. Guard reads existing results without running this verification.
