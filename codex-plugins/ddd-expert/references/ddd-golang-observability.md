---
name: ddd-golang-observability
description: Go House Style for accepted OpenTelemetry construction, Connect interception, propagation, log correlation, and shutdown.
---

# Go OpenTelemetry

## Applies When

Load this leaf only when the accepted Go service stack includes OpenTelemetry.

## Runtime Shape

Runtime owns the Resource, `TracerProvider`, W3C propagation, and
`TracerProvider.Shutdown(ctx)` through `fx.Lifecycle`, configured by the
standard `OTEL_*` environment. Spans export over OTLP only when an endpoint is
configured, so trace IDs correlate logs without a collector. Instrumented
servers and clients take the provider as a dependency, so it is built before
them and shuts down after them, flushing their spans.

The trace ID is the correlation identity of one piece of work across RPCs,
Domain Events, messages, tasks, and services. The process log handler adds
`trace_id` and `span_id` from a record's ctx, so code correlates by logging
with the ctx of its work. Business code starts no spans; Domain represents
business correlation in Domain facts.

## Boundaries

- RPC: the `connectrpc.com/otelconnect` server interceptor is outermost in the
  shared `connect.Server` chain, so the access log is written inside the RPC's
  span. It continues the caller's `traceparent` and skips health checks; the
  gateway owns the trust boundary for external traffic.
- Domain Event: `event.WithContextFactory` continues the span context from
  `event.SourceContext` in the handler ctx.
- Integration Message and task: the publisher injects trace context into
  provider headers, and the consumer's handlers continue it.

## Verification

Test exporter/provider construction, Connect interceptor registration,
representative propagation across every touched boundary, trace/log correlation,
provider error surfacing, flush, and bounded shutdown. Provider evidence uses
the configured collector or a protocol-faithful test receiver.
