---
name: ddd-golang-runtime
description: Go House Style for config loading, Fx composition and lifecycle, ConnectRPC/Chi servers, execution-boundary logging, and shutdown.
---

# Go Runtime

## Applies When

Runtime owns process configuration, shared technical resources, active loops, composition, startup, and shutdown. It contains no business policy. Shared runtime packages live under `internal/pkg/<capability>`; bounded contexts contribute modules, handlers, and adapters.

## Mandatory Runtime Stack

For covered Go House Style concerns use:
- `github.com/go-jimu/components/config/loader` for configuration;
- `go.uber.org/fx` for dependency injection and lifecycle;
- `log/slog` with `github.com/go-jimu/components/sloghelper` for structured logs;
- ConnectRPC with `github.com/go-chi/chi/v5` for the shared RPC/HTTP server;
- `github.com/samber/oops` when an external/runtime error first enters controlled code.
Generated Protobuf and Connect files live under `gen/` and are never edited manually. Contract sources live under `proto/`. Runtime mounts generated handlers; Application never implements generated server interfaces.

## Component-Owned Configuration

Each runtime component owns an Option/Config type and `Validate() error` beside its constructor. The process aggregates those types only for loading and Fx supply.

```go
// cmd/user-api/main.go
package main

import (
    "log/slog"
    "os"
    "time"

    "github.com/go-jimu/components/config/loader"
    "github.com/go-jimu/components/sloghelper"
    "example/internal/business/user"
    "example/internal/pkg"
    sharedconnect "example/internal/pkg/connectrpc"
    "example/internal/pkg/database"
    "github.com/samber/oops"
    "go.uber.org/fx"
)

type Option struct {
    fx.Out
    Logger   sloghelper.Options   `json:"logger" yaml:"logger" toml:"logger"`
    MySQL    database.Option      `json:"mysql" yaml:"mysql" toml:"mysql"`
    Connect  sharedconnect.Option `json:"connect" yaml:"connect" toml:"connect"`
}

func main() {
    var option Option
    if err := loader.Load(
        &option,
        loader.WithConfigurationDirectory("./configs/user-api", "defaults"),
    ); err != nil {
        slog.Error("failed to load configuration", sloghelper.Error(oops.Wrap(err)))
        os.Exit(1)
    }

    // Allow-list only non-secret startup facts. Never log option or its %+v form.
    slog.Info("configuration loaded",
        slog.String("connect_addr", option.Connect.Addr),
        slog.Int("mysql_port", option.MySQL.Port),
    )

    app := fx.New(
        fx.Supply(option),
        fx.Provide(sloghelper.NewLog),
        pkg.Module,
        user.Module,
        fx.StartTimeout(15*time.Second),
        fx.StopTimeout(30*time.Second),
    )
    app.Run()
}
```

Each `cmd/<service>` loads only its own `configs/<service>` directory; never scan the shared `configs` parent in a multi-service repository. `loader.Load` automatically applies `JIMU_PROFILES_ACTIVE` after caller options. When profiles are supported, also pass `loader.WithConfigFilePrefix("app")`; an active profile without a prefix is invalid. Use `loader.WithEnvVarsPrefix("APP")` only when the repository wants a filtered flat environment source. Verify placeholder behavior against the adopted components version rather than inventing nested environment-key translation.
Never log the aggregate Option, a resolved config map, DSN, password, token, API key, certificate/private key, cookie, secret-bearing URL, or full environment. Startup summaries are allow-list based: profile/source, enabled modules, non-secret listen addresses, counts, and a non-reversible config version/hash.

## Composition Boundaries

`cmd/main.go` loads configuration, selects modules, sets process timeouts, and runs Fx. It does not construct Repositories, clients, generated handlers, or lifecycle loops individually.

```go
// internal/pkg/module.go
package pkg

import (
    sharedconnect "example/internal/pkg/connectrpc"
    "example/internal/pkg/database"
    "go.uber.org/fx"
)

var Module = fx.Module(
    "internal.pkg",
    fx.Provide(sharedconnect.NewServer),
    fx.Provide(database.NewMySQLDriver),
)
```

A bounded-context module owns its providers and registrations. It may import generated Transport contracts from `gen/`; `cmd` does not.

```go
// internal/business/user/user.go
package user

import (
    connect "connectrpc.com/connect"
    "example/gen/user/public/v1/userv1connect"
    "example/internal/business/user/application"
    "example/internal/business/user/application/command"
    "example/internal/business/user/application/query"
    "example/internal/business/user/infrastructure"
    userconnect "example/internal/business/user/transport/connectrpc"
    sharedconnect "example/internal/pkg/connectrpc"
    "go.uber.org/fx"
)

var Module = fx.Module(
    "business.user",
    fx.Provide(
        infrastructure.NewUserRepository,
        infrastructure.NewUserQueryRepository,
        command.NewCreateUserHandler,
        query.NewGetUserHandler,
        application.NewApplication,
        userconnect.NewHandler,
    ),
    fx.Invoke(func(
        handler userv1connect.UserServiceHandler,
        server sharedconnect.Server,
    ) {
        server.Register(userv1connect.NewUserServiceHandler(
            handler,
            connect.WithInterceptors(server.GetGlobalInterceptors()...),
        ))
    }),
)
```

For multi-service repositories, expose named `internal/pkg` modules rather than copying provider lists across `cmd/<service>`. Use `fx.ValidateApp` in a wiring test to prove the graph is complete without starting providers.

## Active Resource Ownership

For changes to the shared RPC/HTTP server itself, read the
[ConnectRPC and Chi server guide](ddd-golang-server.md). A change only to Fx
providers uses the composition rules above.

Every optional active resource follows the same ownership rule: the package
that creates it owns its `fx.Lifecycle` hooks, goroutines, terminal errors, and
bounded drain. Provider-specific construction stays in the provider leaf.

## Execution Owner Logs And Errors

Transport middleware owns one Execution Completion Log per inbound RPC/message/task. Runtime owns one for each terminal loop, scheduler tick, or lifecycle operation it executes. Application does not duplicate that record; Infrastructure enriches and returns errors unless it owns suppression or a terminal operation.

A Connect interceptor creates the request-scoped logger and records the final outcome:

```go
startedAt := time.Now()
requestID := request.Header().Get("X-Request-ID")
logger := root.With(slog.String("request_id", requestID))
ctx = sloghelper.NewContext(ctx, logger)

response, err := next(ctx, request)
attrs := []any{
    slog.String("operation", request.Spec().Procedure),
    slog.Int64("duration_ms", time.Since(startedAt).Milliseconds()),
}
if err != nil {
    logger.ErrorContext(ctx, "request complete",
        append(attrs,
            slog.String("outcome", "failed"),
            slog.String("connect_code", connect.CodeOf(err).String()),
            sloghelper.Error(err),
        )...,
    )
    return response, err
}
logger.InfoContext(ctx, "request complete",
    append(attrs, slog.String("outcome", "success"))...,
)
```

At the first controlled boundary, enrich and wrap once with `oops.With(...).Wrap(providerErr)`; use `oops.Wrap(providerErr)` only when there is no owned context. Never wrap an already wrapped provider error again. Later layers add context only for new semantics, preserve `errors.Is/As`, and do not mechanically wrap or log-and-return the same error. Expected rejection is not an internal failure. Never log secret configuration, credentials, full payloads, or sensitive personal data.

## Shutdown Ordering

Encode dependencies so shutdown happens in this order:

1. stop accepting RPC/HTTP ingress and scheduled triggers;
2. stop message consumers and task workers taking new work;
3. drain or cancel in-flight executions according to their contract;
4. drain accepted event and telemetry work within the Fx stop timeout;
5. close MySQL, broker, Redis, and other clients after their users stop.

Fx lifecycle order follows the constructor dependency graph and hook registration, not the conceptual layer diagram. Every goroutine needs cancellation or Close plus a surfaced terminal-error path. Readiness becomes false before drain; deployment termination grace and pre-stop behavior must exceed the measured drain budget rather than a universal sleep value.

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
| Execution logging | Affected completion outcome and error mapping |
| Active loop or shutdown | Affected reachability, cancellation, dependency-aware drain, and bounded stop |
| OpenTelemetry | Affected observability-leaf cases |

Reuse valid unaffected evidence. Broaden only for new changes, failures, or an
unresolved risk. Guard reads existing results without running this verification.
