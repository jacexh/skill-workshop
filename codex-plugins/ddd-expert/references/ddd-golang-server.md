# Go ConnectRPC Server

Read for changes to the shared RPC/HTTP listener, handler registration, health
reporting, or server lifecycle. Fx-only provider registration uses the Runtime
guide. The [Runtime guide](ddd-golang-runtime.md) owns process configuration,
execution logging, and dependency-aware shutdown.

## One Listener

`internal/pkg/connectrpc` owns one listener and one `connect.Server` for every
contract the process serves. Public and private name a contract's audience and
compatibility promise through its proto package; the gateway's route allowlist
decides which procedures leave the deployment, and the platform owns caller
identity between services.

Its `Option` carries the listen `Addr` and a `ShutdownDelay`. Bounded contexts
depend on a narrow `Server` interface that exposes the `connect.Server` for the
generated `Register*Handler` calls and the bound `Address()`. The shared
interceptor chain is set once when that `connect.Server` is built.

Route with the standard library `http.ServeMux` and serve HTTP/1.1 plus
unencrypted HTTP/2, so Connect, gRPC, and gRPC-Web clients and gRPC probes reach
the same port. Give the `http.Server` header-read, idle, and header-size limits.

## Health

Register `grpc.health.v1.Health` on the shared `connect.Server`. A named
liveness service reports SERVING for as long as the process runs. The empty
service name reports readiness: SERVING once the listener is bound,
NOT_SERVING from the moment shutdown begins. Health checks bypass the execution
log.

## Lifecycle

Contexts register handlers in Fx invokes, before the start hook. The start hook
mounts every registered procedure, binds the listener synchronously so address
errors fail startup, and serves in an owned goroutine. `http.ErrServerClosed`
is a normal stop; any other Serve error is wrapped, logged once, and requests
process shutdown with exit code 1.

The server is an entry point; the Runtime orders its hooks (see
[Shutdown](ddd-golang-runtime.md#shutdown)). The stop hook reports readiness
NOT_SERVING, keeps serving for `ShutdownDelay` so load balancers stop routing,
then calls `http.Server.Shutdown`. The stop ctx bounds the delay and the drain
together, so both count against the Fx stop timeout.

## Verification

Exercise the server behavior changed: handler registration and reachability,
readiness and liveness status, synchronous listener failure, unexpected Serve
shutdown, or the delayed and bounded drain. Reuse unaffected evidence. Guard
reads existing results.
