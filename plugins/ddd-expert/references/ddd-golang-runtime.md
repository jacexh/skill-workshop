---
name: ddd-golang-runtime
description: Executable Go House Style for config loading, Fx composition and lifecycle, ConnectRPC/Chi servers, execution-boundary logging, shutdown, and conditional OpenTelemetry.
---

# Go Runtime

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
    "example/internal/business/notification"
    "example/internal/business/user"
    "example/internal/pkg"
    sharedconnect "example/internal/pkg/connectrpc"
    "example/internal/pkg/database"
    "example/internal/pkg/eventbus"
    "example/internal/pkg/messagebus"
    "github.com/samber/oops"
    "go.uber.org/fx"
)

type Option struct {
    fx.Out
    Logger   sloghelper.Options   `json:"logger" yaml:"logger" toml:"logger"`
    MySQL    database.Option      `json:"mysql" yaml:"mysql" toml:"mysql"`
    EventBus eventbus.Config      `json:"eventbus" yaml:"eventbus" toml:"eventbus"`
    Kafka    messagebus.Option    `json:"kafka" yaml:"kafka" toml:"kafka"`
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
        slog.Int("kafka_broker_count", len(option.Kafka.Brokers)),
    )

    app := fx.New(
        fx.Supply(option),
        fx.Provide(sloghelper.NewLog),
        fx.Provide(eventbus.NewDispatcher),
        pkg.Module,
        user.Module,
        notification.Module,
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
    "example/internal/pkg/messagebus"
    "go.uber.org/fx"
)

var Module = fx.Module(
    "internal.pkg",
    fx.Provide(sharedconnect.NewServer),
    fx.Provide(database.NewMySQLDriver),
    fx.Provide(messagebus.NewKafka),
)
```

A bounded-context module owns its providers and registrations. It may import generated Transport contracts from `gen/`; `cmd` does not.

```go
// internal/business/user/user.go
package user

import (
    connect "connectrpc.com/connect"
    "github.com/go-jimu/components/ddd/event"
    "example/gen/user/v1/userv1connect"
    "example/internal/business/user/application"
    "example/internal/business/user/application/command"
    "example/internal/business/user/application/eventhandler"
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
        eventhandler.NewUserCreatedHandler,
        application.NewApplication,
        userconnect.NewHandler,
    ),
    fx.Invoke(func(sub event.Subscriber, handler *eventhandler.UserCreatedHandler) {
        sub.Subscribe(handler)
    }),
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

## ConnectRPC And Chi Lifecycle

Bind the listener synchronously in `OnStart` so address errors fail startup. Serve in an owned goroutine. `OnStop` calls `http.Server.Shutdown`. An unexpected Serve failure is an Execution Owner failure and requests process shutdown.

```go
// internal/pkg/connectrpc/connectrpc.go
package connectrpc

import (
    "context"
    "errors"
    "log/slog"
    "net"
    "net/http"
    "strings"
    "time"

    connect "connectrpc.com/connect"
    "github.com/go-chi/chi/v5"
    "github.com/go-jimu/components/sloghelper"
    "github.com/samber/oops"
    "go.uber.org/fx"
    "golang.org/x/net/http2"
    "golang.org/x/net/http2/h2c"
)

type Option struct {
    Addr string `json:"addr" yaml:"addr" toml:"addr"`
}

type Server interface {
    GetGlobalInterceptors() []connect.Interceptor
    Register(string, http.Handler)
    Address() string
}

type server struct {
    option       Option
    logger       *slog.Logger
    shutdowner   fx.Shutdowner
    interceptors []connect.Interceptor
    router       *chi.Mux
    httpServer   *http.Server
    listener     net.Listener
}

func NewServer(
    lifecycle fx.Lifecycle,
    shutdowner fx.Shutdowner,
    option Option,
    logger *slog.Logger,
) (Server, error) {
    if strings.TrimSpace(option.Addr) == "" {
        return nil, errors.New("connectrpc address is required")
    }

    router := chi.NewRouter()
    router.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
        w.WriteHeader(http.StatusOK)
    })
    result := &server{
        option:       option,
        logger:       logger,
        shutdowner:   shutdowner,
        interceptors: []connect.Interceptor{NewCarrier(logger).Intercept()},
        router:       router,
    }
    result.httpServer = &http.Server{
        Addr:              option.Addr,
        Handler:           h2c.NewHandler(router, &http2.Server{}),
        ReadHeaderTimeout: 3 * time.Second,
        IdleTimeout:       60 * time.Second,
        MaxHeaderBytes:    16 * 1024,
    }

    lifecycle.Append(fx.Hook{
        OnStart: func(context.Context) error {
            listener, err := net.Listen("tcp", option.Addr)
            if err != nil {
                return oops.With("operation", "connectrpc.listen").
                    With("address", option.Addr).
                    Wrap(err)
            }
            result.listener = listener
            go result.serve()
            return nil
        },
        OnStop: func(ctx context.Context) error {
            return oops.Wrap(result.httpServer.Shutdown(ctx))
        },
    })
    return result, nil
}

func (s *server) Register(pattern string, handler http.Handler) {
    pattern = strings.TrimSuffix(pattern, "/")
    s.router.Handle(pattern+"/*", handler)
}

func (s *server) GetGlobalInterceptors() []connect.Interceptor {
    return append([]connect.Interceptor(nil), s.interceptors...)
}

func (s *server) Address() string {
    if s.listener != nil {
        return s.listener.Addr().String()
    }
    return s.option.Addr
}

func (s *server) serve() {
    err := s.httpServer.Serve(s.listener)
    if err == nil || errors.Is(err, http.ErrServerClosed) {
        return
    }
    err = oops.With("operation", "connectrpc.serve").Wrap(err)
    s.logger.Error("ConnectRPC server stopped unexpectedly", sloghelper.Error(err))
    if shutdownErr := s.shutdowner.Shutdown(fx.ExitCode(1)); shutdownErr != nil {
        s.logger.Error("failed to request shutdown",
            sloghelper.Error(oops.Wrap(shutdownErr)))
    }
}
```

The Message Runner, task worker/scheduler, event dispatcher, poller, and telemetry exporter follow the same ownership rule: the package that creates the active resource owns its `fx.Lifecycle` hooks, goroutines, terminal errors, and bounded drain.

## Execution Owner Logs And Errors

Transport middleware owns one Execution Completion Log per inbound RPC/message/task. Runtime owns one for each terminal loop, scheduler tick, reconciliation run, or lifecycle operation it executes. Application does not duplicate that record; Infrastructure enriches and returns errors unless it owns retry, suppression, or a terminal operation.

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
4. drain accepted event/outbox/telemetry work within the Fx stop timeout;
5. close MySQL, broker, Redis, and other clients after their users stop.

Fx lifecycle order follows the constructor dependency graph and hook registration, not the conceptual layer diagram. Every goroutine needs cancellation or Close plus a surfaced terminal-error path. Readiness becomes false before drain; deployment termination grace and pre-stop behavior must exceed the measured drain budget rather than a universal sleep value.

## Conditional OpenTelemetry

Do not add OTel merely because the library exists. It becomes mandatory only when accepted project observability constraints require distributed tracing and a backend is available.

Runtime then owns OTLP exporter/resource/TracerProvider construction, global propagation, and `TracerProvider.Shutdown(ctx)` in `fx.Lifecycle`. Add `connectrpc.com/otelconnect` to global Connect interceptors using its verified constructor:

```go
func NewOTelConnectInterceptor() (connect.Interceptor, error) {
    interceptor, err := otelconnect.NewInterceptor()
    if err != nil {
        return nil, oops.With("operation", "otelconnect.create").
            Wrap(err)
    }
    return interceptor, nil
}
```

Propagate trace context through accepted Integration Message/task headers, and include `trace_id`, `span_id`, and `request_id` in execution logs when present. The current in-memory `event.Dispatcher.DispatchAll` has no caller `context.Context`, so it cannot automatically continue the request span; do not put trace fields in a Domain Event to simulate propagation. Domain stays telemetry-free. If there is no accepted backend, sampling/retention decision, and shutdown owner, omit OTel rather than shipping a half-wired tracer.

## Verification

Test component Option validation, loader defaults/profile behavior, secret-redacted startup logs, `fx.ValidateApp` composition, generated-handler registration, synchronous listener failure, unexpected Serve shutdown, request completion logging, runner reachability, cancellation, dependency-aware drain, and bounded stop. When OTel is active, test interceptor registration, propagation, exporter failure, and provider shutdown.
