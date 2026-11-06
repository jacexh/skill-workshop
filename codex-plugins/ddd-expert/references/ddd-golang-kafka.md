---
name: ddd-golang-kafka
description: Go House Style for an accepted Kafka message adapter, consumer runner, configuration, logging, and lifecycle.
---

# Go Kafka Runtime

## Applies When

Load this leaf only when the accepted implementation uses Kafka for a Go
Integration Message path. Load [ddd-golang-messages.md](ddd-golang-messages.md)
for provider-neutral contracts and registration.

## Adopted Adapter

Only `internal/pkg/messagebus` imports `github.com/go-jimu/contrib/message/kafka`
(`jimukafka`) and `github.com/twmb/franz-go/pkg/kgo`. Construct the provider boundary with `jimukafka.NewClient`,
`jimukafka.NewPublisher`, and `jimukafka.NewConsumer`. Supply the shared payload
registry using `jimukafka.WithPayloadResolver(registry)` and pass an explicit
`jimukafka.FailurePolicy` from validated project configuration.

Kafka brokers, topics, consumer groups, partitions, offsets, commit behavior,
and `kgo` options remain in Runtime/provider code. Application depends on
`message.Publisher`; Transport implements `message.Handler`.

## Registration and Lifecycle

`message.Subscriber.Subscribe` registers handlers. The Kafka consumer also
implements `message.Runner`; Runtime starts `Run(ctx)` and observes its terminal
error. The consumer is an entry point: stopping calls its `Shutdown(ctx)`, which
lets running handlers finish and commit, and waits for `Run` to return. The
shared client closes after the event dispatcher drains, because handlers publish
through it; closing it leaves the consumer group.

Register payload factories and handlers before starting the runner. Readiness
becomes true only after required registrations and provider startup complete.

## Ordering

Use a stable `message.Message.Key` for the accepted ordering scope and include a
monotonic version/sequence only when the accepted consumer contract contains
that meaning.

When OpenTelemetry is present, Runtime injects/extracts context through provider
headers according to [ddd-golang-observability.md](ddd-golang-observability.md).

## Verification

Use provider integration evidence for client options, payload resolution,
registration, serialization, keying, configured disposition, runner
reachability, terminal-error surfacing, readiness, and bounded shutdown. Keep
Application/Transport tests provider-neutral.
