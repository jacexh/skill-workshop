---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Features

## Current Capabilities

### Dispatch
The dispatcher service runs on port 8083 and coordinates executor sessions via Redis ownership directory.
Kafka eventbus publishes cross-BC events with topic equal to the proto full name.
ClickHouse async_insert stores UnifiedMessage rows partitioned by month.
