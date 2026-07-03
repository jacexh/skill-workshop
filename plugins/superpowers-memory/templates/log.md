---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:ingest
triggered_by_plan: null
---

<!-- OWNER: Chronological KB maintenance ledger.

     SLOT CONTRACT:
     - Owner: append-only ingest events after KB changes.
     - Required shape: # Project Knowledge Log; entries use ## [YYYY-MM-DD] ingest | <topic>.
     - Conditional shape: include Source query only when ingest accepted a query Memory candidate.
     - Shard rule: log.md never shards.
     - Must not include: stable facts, query-only events, lint-only events, chat transcripts, release narrative, copied owner content, or broad access/audit logs.
     - Verify coverage: log_heading_format, log_heading_date, log_event_not_ingest_owned, stale refs, retrieval cost.

     Append new entries at the end. Do not rewrite older entries except to fix a broken path/format through ingest. -->

# Project Knowledge Log

## [YYYY-MM-DD] ingest | <short topic>

- Source: `<spec/plan/ADR/doc/path>` or code/diff validation summary
- Source query: <optional; only when ingest accepted a query Memory candidate>
- Touched: `docs/superpowers/memory/<owner>.md`
- Verify: ok; qualityGate blocking=0 advisory=0
- Follow-up: <optional next ingest/lint target>
