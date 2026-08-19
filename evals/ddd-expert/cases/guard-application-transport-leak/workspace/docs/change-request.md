# Consume Payment Captured

Application records the accepted payment fact through the idempotent Record
Payment use case and remains transport-neutral. The inbound adapter validates
the producer-owned contract, translates it into Order language, and delegates
once. Broker envelopes and generated contract types stay outside Application.
