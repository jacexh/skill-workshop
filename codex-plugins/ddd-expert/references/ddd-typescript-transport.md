---
name: ddd-typescript-transport
description: TypeScript House Style for ConnectRPC, Fastify, message-subscriber, and task-processor adapters.
---

# TypeScript Transport Layer

## Applies When

Load this leaf when a TypeScript inbound RPC/HTTP endpoint, Integration Message
subscriber, or task processor is touched.

## Adapter Contract

An inbound adapter decodes its contract, extracts accepted actor/correlation
facts, maps primitives, delegates once through `Application.commands` or
`.queries`, and maps the result or stable error. Generated and framework types
remain in Transport.

## ConnectRPC Shape

Use Connect-ES 2 with generated descriptors under root `gen/`:

```ts
import type { ConnectRouter } from "@connectrpc/connect";
import { UserService } from "../../../../../gen/user/v1/user_pb.js";
import type { Application } from "../../application/application.js";

export function createUserConnectRoutes(application: Application) {
  return (router: ConnectRouter): void => {
    router.service(UserService, {
      async createUser(request) {
        const created = await application.commands.createUser.execute({
          name: request.name,
          email: request.email,
        });
        return { user: created };
      },
    });
  };
}
```

Map stable Application errors to Connect codes in a Transport error module and
map unknown errors to a non-leaking Internal response. A Transport assembler may
map large generated messages.

## Fastify and Worker Adapters

Hand-written HTTP uses Fastify 5 with `typebox` and
`@fastify/type-provider-typebox` for params, body, query, and response shape.
Route schemas decode external syntax; accepted Domain rules remain in Domain
construction and behavior.

A message subscriber decodes one generated contract and delegates once; Kafka
mechanics stay in Platform. A BullMQ processor decodes one `Job<unknown>` into a
typed local task payload and delegates once; Redis/BullMQ policy stays in
Platform/Runtime.

## Verification

Use the real generated request or framework injection path. Verify decoding,
actor/correlation extraction, one Application delegation, response mapping, and
safe error mapping. Subscriber/processor tests return semantic disposition to a
separate provider-boundary test.
