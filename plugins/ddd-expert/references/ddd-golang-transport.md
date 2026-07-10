---
name: ddd-golang-transport
description: Go house style for ConnectRPC, conditional HTTP, Integration Message subscribers and task processors as independent inbound adapters.
---

# Go Transport Layer

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

When an RPC API exists, use ConnectRPC. Contract sources live under `proto/<context>/...`, generated messages and stubs live directly under `gen/`, the adapter lives under `transport/connectrpc`, and shared HTTP server/interceptor lifecycle lives under `internal/pkg/connectrpc`.

```go
package connectrpc

import (
	"context"

	"connectrpc.com/connect"
	"example/gen/user/v1"
	"example/gen/user/v1/userv1connect"
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

## Integration Message Subscriber

An accepted Integration Message consumer lives under `transport/messagesubscriber` and implements `github.com/go-jimu/components/ddd/message.Handler`:

```go
package messagesubscriber

import (
	"context"
	"fmt"

	"github.com/go-jimu/components/ddd/message"
	userintegrationv1 "example/gen/user/integration/v1"
	"example/internal/business/notification/application"
	"example/internal/business/notification/application/command"
)

type UserRegisteredSubscriber struct {
	app *application.Application
}

var _ message.Handler = (*UserRegisteredSubscriber)(nil)

func NewUserRegisteredSubscriber(
	app *application.Application,
) *UserRegisteredSubscriber {
	return &UserRegisteredSubscriber{app: app}
}

func (*UserRegisteredSubscriber) Listening() []message.Kind {
	return []message.Kind{message.KindOf(&userintegrationv1.UserRegisteredV1{})}
}

func (s *UserRegisteredSubscriber) Handle(
	ctx context.Context,
	integrationMessage message.Message,
) error {
	payload, ok := integrationMessage.Payload().(*userintegrationv1.UserRegisteredV1)
	if !ok {
		return fmt.Errorf("unexpected integration payload %T", integrationMessage.Payload())
	}
	return s.app.Commands.SendWelcomeNotification.Handle(ctx, command.SendWelcomeNotification{
		UserID: payload.GetUserId(),
		Name:   payload.GetName(),
		Email:  payload.GetEmail(),
	})
}
```

The subscriber validates envelope/type facts required for mapping, extracts message/correlation metadata and delegates once. Business validity and idempotent state change stay in Application/Domain. A returned error is a message-level failure; Kafka Runtime owns commit, redelivery, retry and DLQ policy.

The consuming context imports a producer-owned Published Fact Contract, or its own receiver-owned Asynchronous Intent Contract. It never imports another context's internal Domain Event. `message.Subscriber.Subscribe` is registration in `<context>.go`; `message.Runner.Run` and Kafka/franz-go remain under `internal/pkg/messagebus`.

Outbox, Inbox, persistent idempotency, retry and DLQ are not implied by using messages. Add only the mechanism accepted by Tactical Design.

## Task Processor

Task Queue code exists only after the design accepts it. The owning context defines the stable contract under `application/task`; the inbound adapter lives under `transport/taskprocessor` and implements `github.com/go-jimu/components/taskqueue.Processor`:

```go
package taskprocessor

import (
	"context"
	"fmt"

	"github.com/go-jimu/components/taskqueue"
	"example/internal/business/notification/application"
	"example/internal/business/notification/application/command"
	notificationtask "example/internal/business/notification/application/task"
)

type SendWelcomeProcessor struct {
	registry *taskqueue.SchemaRegistry
	app      *application.Application
}

var _ taskqueue.Processor = (*SendWelcomeProcessor)(nil)

func NewSendWelcomeProcessor(
	registry *taskqueue.SchemaRegistry,
	app *application.Application,
) *SendWelcomeProcessor {
	return &SendWelcomeProcessor{registry: registry, app: app}
}

func (p *SendWelcomeProcessor) TaskType() taskqueue.TaskType {
	return notificationtask.SendWelcomeDefinition.Type
}

func (p *SendWelcomeProcessor) Process(
	ctx context.Context,
	queued taskqueue.Task,
) error {
	decoded, err := p.registry.DecodeJSON(queued)
	if err != nil {
		return err // malformed JSON already wraps taskqueue.ErrSkipRetry
	}
	payload, ok := decoded.(*notificationtask.SendWelcomePayload)
	if !ok {
		return fmt.Errorf("%w: unexpected task payload %T", taskqueue.ErrSkipRetry, decoded)
	}
	return p.app.Commands.SendWelcomeNotification.Handle(ctx, command.SendWelcomeNotification{
		UserID: payload.UserID,
	})
}
```

A processor handles one `TaskType` and delegates to one Application Command. Expected waiting is not a provider failure: enqueue an explicitly bounded delayed follow-up and complete the current task. Domain guards or an accepted persistent mechanism make repeated delivery converge.

`<context>.go` contributes schema and processor registration. `internal/pkg/taskqueue` owns the Asynq/Redis clients, worker, scheduler, retry middleware and Fx lifecycle. Periodic scheduling enqueues an ordinary task; it does not call a business service directly. External bounded contexts collaborate through Integration Messages, not another context's internal task contract.

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
