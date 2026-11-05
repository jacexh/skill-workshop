# Go ConnectRPC and Chi Server

Read for changes to the shared RPC/HTTP server, listener, handler registration,
or server lifecycle. Fx-only provider registration uses the Runtime guide.
The [Runtime guide](ddd-golang-runtime.md) owns process configuration, logging,
and dependency-aware shutdown.

## ConnectRPC And Chi Lifecycle

Bind the listener synchronously in `OnStart` so address errors fail startup. Serve in an owned goroutine. `OnStop` calls `http.Server.Shutdown`. An unexpected Serve failure is an Execution Owner failure and requests process shutdown.

The shared server lives in `internal/pkg/connectrpc`. Its `Option` carries a
required `Addr`. Other packages depend on this interface:

```go
type Server interface {
    GetGlobalInterceptors() []connect.Interceptor
    Register(string, http.Handler)
    Address() string
}
```

`NewServer` builds a Chi router with a `/healthz` route, serves it through
`h2c` with `ReadHeaderTimeout` 3s, `IdleTimeout` 60s, and `MaxHeaderBytes`
16 KiB, and starts the global interceptors with the logging carrier.
`Register` mounts a handler at its pattern plus `/*`, `GetGlobalInterceptors`
returns a copy, and `Address` returns the bound listener address after start.
A listen error is wrapped with the operation and address. In the serve
goroutine, `http.ErrServerClosed` is a normal stop; any other error is wrapped,
logged, and passed to `fx.Shutdowner.Shutdown(fx.ExitCode(1))`.

## Verification

Exercise the server behavior changed: handler registration and reachability,
synchronous listener failure, unexpected Serve shutdown, or bounded HTTP drain.
Reuse unaffected evidence. Guard reads existing results.
