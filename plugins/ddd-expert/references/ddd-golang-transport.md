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

```go
package connectrpc

import (
	"context"

	"connectrpc.com/connect"
	"example/gen/user/public/v1"
	"example/gen/user/public/v1/userv1connect"
	"example/internal/business/user/application"
	"example/internal/business/user/application/command"
)

type Handler struct {
	application *application.Application
}

var _ userv1connect.UserServiceHandler = (*Handler)(nil)

func NewHandler(app *application.Application) userv1connect.UserServiceHandler {
	return &Handler{application: app}
}

func (h *Handler) Create(
	ctx context.Context,
	request *connect.Request[userv1.CreateRequest],
) (*connect.Response[userv1.CreateResponse], error) {
	result, err := h.application.Commands.Create.Handle(ctx, command.CreateUser{
		Name: request.Msg.GetName(),
		Email: request.Msg.GetEmail(),
	})
	if err != nil {
		return nil, mapError(err)
	}
	return connect.NewResponse(&userv1.CreateResponse{
		User: &userv1.User{Id: result.ID, Name: result.Name, Email: result.Email},
	}), nil
}
```

The generated service interface is implemented only here, never by `application.Application`. Keep protocol-to-command mapping explicit. A sibling `assembler.go` may map generated RPC messages and Application results; it does not replace `application/assembler.go`, which maps Application DTOs and Domain Entities.

`<context>.go` registers `userv1connect.NewUserServiceHandler(handler, ...)` with the shared server. `internal/pkg/connectrpc` owns address binding, interceptors, start/stop and the single RPC completion log.

If a hand-written HTTP endpoint is accepted, place it under `transport/http` and route with `github.com/go-chi/chi/v5`. It follows the same map-once/delegate-once rule; do not introduce Gin, Echo or a second server lifecycle.

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
Kafka and Asynq provider construction, active loops, completion logging, and
lifecycle remain in their provider leaves.
## Errors, Logging and Trace Context

Transport maps stable errors to ConnectRPC/HTTP status or returns them to the provider boundary. It preserves the internal cause for the single execution logger.

- ConnectRPC/HTTP middleware owns end-to-end duration and completion.
- A message subscriber never records generic delivery completion because its return precedes provider commit. It may record only an independently valuable business-semantic fact; the post-commit provider boundary owns delivery success and terminal failure.
- Task worker middleware owns task completion and duration.
- Do not log an error and return it unless this adapter is the terminal owner.

When OpenTelemetry is available and accepted, Transport extracts/creates trace context and passes `context.Context` unchanged. Completion logs may include `trace_id`, `span_id` and `request_id`; async boundaries also retain their own `message_id` or `task_id`. Domain remains telemetry-free.

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

Do not pre-create empty adapter directories. Test the real adapter with a focused fake Application handler. Cover mapping, one-call delegation, public error/outcome mapping, unexpected message/task payloads and returned retry/skip classification; do not retest Domain rules here.
