# Go ConnectRPC and Chi Server

Read for changes to the shared RPC/HTTP server, listener, handler registration,
or server lifecycle. Fx-only provider registration uses the Runtime guide.
The [Runtime guide](ddd-golang-runtime.md) owns process configuration, logging,
and dependency-aware shutdown.

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

## Verification

Exercise the server behavior changed: handler registration and reachability,
synchronous listener failure, unexpected Serve shutdown, or bounded HTTP drain.
Reuse unaffected evidence. Guard reads existing results.
