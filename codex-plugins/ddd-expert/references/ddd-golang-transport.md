---
name: ddd-golang-transport
description: Go house style for ConnectRPC, conditional HTTP, Integration Message subscribers and task processors as independent inbound adapters.
---

# Go Transport Layer

## Applies When

Transport is the physical house-style name for inbound adapters. It maps one external or runtime-triggered contract to one protocol-neutral Application use case and maps the result back. It is separate from Application even when an older service combines both responsibilities.

## Inbound Contract

An inbound adapter may decode its envelope, extract authentication/correlation metadata, map input, delegate once and map the resulting error or outcome. It must not:

- call a Domain Repository or QueryRepository;
- mutate an Aggregate or implement a Domain branch from exported fields;
- control a business transaction;
- coordinate several Application ports;
- duplicate Domain field validation in protocol DTOs;
- expose provider types to Application or Domain.

Command-side business data reaches a Domain Factory or reconstituted Entity and is validated in Domain. QueryRepository filters and read models are the explicit exception: Transport maps syntax, while the Application Query use case normalizes, authorizes, and validates read semantics without constructing a fake Domain Entity. Transport only performs checks required to decode and safely interpret its own envelope, then maps inner errors into the boundary's public outcome.

## ConnectRPC

When an RPC API exists, use ConnectRPC. Deployment-private contracts live under `proto/<context>/private/v1`; externally supported contracts with their stronger authentication and compatibility obligations live under `proto/<context>/public/v1`. Generated messages and stubs mirror the source path directly under `gen/`, the adapter lives under `transport/connectrpc`, and shared HTTP server/interceptor lifecycle lives under `internal/pkg/connectrpc`.

The `Handler` type holds `*application.Application`, asserts the generated
interface at compile time with `var _ userv1connect.UserServiceHandler =
(*Handler)(nil)`, and `NewHandler` returns that interface. Each RPC method maps
the request message to one Application input, delegates once, maps errors
through `mapError` in `error.go`, and returns the mapped response message.

The generated service interface is implemented only here, never by `application.Application`. Keep protocol-to-command mapping explicit. A sibling `assembler.go` may map generated RPC messages and Application results; it never maps Domain Entities, which belong to `application/assembler.go` when that mapping exists.

`<context>.go` registers the handler with `userv1connect.RegisterUserServiceHandler` on the shared server's `connect.Server`. `internal/pkg/connectrpc` owns the listener, interceptors, health, start/stop and the single RPC completion log.

If a hand-written HTTP endpoint is accepted, place it under `transport/http` and mount it on the shared listener's `http.ServeMux` with method and path patterns. It follows the same map-once/delegate-once rule and shares the one server lifecycle.

## Message and Task Adapters

An accepted Integration Message consumer lives under
transport/messagesubscriber and follows
[ddd-golang-messages.md](ddd-golang-messages.md). It decodes one registered
generated payload, maps it to one Application Command, delegates once, and
returns the semantic result to the selected provider Runtime.

An accepted internal task processor lives under transport/taskprocessor and
follows [ddd-golang-taskqueue.md](ddd-golang-taskqueue.md). It decodes one
provider-neutral protobuf task, maps it to one Application Command, delegates
once, and returns the semantic result.

The Bounded Context module contributes subscriber and processor registrations.
Kafka and Asynq provider construction, active loops, and lifecycle remain in
their provider leaves.
## Errors, Logging and Trace Context

Transport maps stable errors to ConnectRPC/HTTP status or returns them to the provider boundary. Outcomes the client can act on carry the error's message; every other error becomes `internal` with a fixed message. The original error stays the unsent cause for `errors.Is` and the single execution logger. A transaction conflict is retryable (`aborted`); an unknown transaction outcome (`unknown`) tells the client the write may have happened.

- ConnectRPC/HTTP middleware owns end-to-end duration and completion.
- Do not log an error and return it unless this adapter is the terminal owner.

Transport passes `context.Context` unchanged; accepted trace context follows [ddd-golang-observability.md](ddd-golang-observability.md). Async boundaries also log their own `message_id` or `task_id`. Domain remains telemetry-free.

## File Shape and Verification

```text
transport/
  connectrpc/
    handler.go
    assembler.go
    error.go
  http/                         # only for accepted hand-written HTTP
  messagesubscriber/<fact>.go  # only for accepted Integration Messages
  taskprocessor/<task>.go       # only for accepted Task Queue
```

Do not pre-create empty adapter directories. Test the real adapter with a focused fake of its consumed Application contract. Cover mapping, one-call delegation, public error/outcome mapping, unexpected message/task payloads and returned retry/skip classification; do not retest Domain rules here.
