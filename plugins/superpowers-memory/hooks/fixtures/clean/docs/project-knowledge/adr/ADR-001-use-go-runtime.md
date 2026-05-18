---
adr: 001
title: Use Go runtime
date: 2026-04-24
status: Accepted
---

# ADR-001: Use Go runtime

## Context

The server fixture needs a small runtime with enough structure to exercise KB verification without adding external dependencies.

## Decision

Implement the server fixture in Go 1.26 using standard-library HTTP.

## Alternatives Rejected

- **Node.js fixture server:** Easier to write inline, but less representative of projects that depend on compiled manifests.

## Consequences

Handlers stay explicit and fixture setup remains dependency-free.
