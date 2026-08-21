---
name: ddd-golang-observability
description: Go House Style for accepted OpenTelemetry construction, Connect interception, propagation, log correlation, and shutdown.
---

# Go OpenTelemetry

## Applies When

Load this leaf only when the accepted Go service observability stack includes
OpenTelemetry, an OTLP destination, and a Runtime shutdown owner.

## Runtime Shape

Runtime owns OTLP exporter, Resource, `TracerProvider`, global propagation, and
`TracerProvider.Shutdown(ctx)` through `fx.Lifecycle`. Configure telemetry before
constructing instrumented clients and servers.

Add `connectrpc.com/otelconnect` to the global Connect interceptors:

```go
func NewOTelConnectInterceptor() (connect.Interceptor, error) {
	interceptor, err := otelconnect.NewInterceptor()
	if err != nil {
		return nil, oops.With("operation", "otelconnect.create").Wrap(err)
	}
	return interceptor, nil
}
```

Transport/Runtime extracts and injects W3C context across accepted HTTP, RPC,
Integration Message, and task boundaries. Execution-completion logs include
available `trace_id`, `span_id`, and `request_id` fields.

The in-memory `event.Dispatcher.DispatchAll` has no caller `context.Context`.
Represent business correlation in Domain facts and start or link technical spans
outside Domain.

## Verification

Test exporter/provider construction, Connect interceptor registration,
representative propagation across every touched boundary, trace/log correlation,
provider error surfacing, flush, and bounded shutdown. Provider evidence uses
the configured collector or a protocol-faithful test receiver.
