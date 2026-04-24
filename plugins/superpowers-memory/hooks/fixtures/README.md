# Verify Fixtures

Each subdirectory is a scenario KB for manually exercising `hook-runtime.js verify` behavior.
`verify` uses `process.cwd()` as the repo root; run from inside the scenario directory.

## Running

```bash
cd plugins/superpowers-memory/hooks/fixtures/<scenario>
node ../../hook-runtime.js verify
```

No git init required — the `committable` field is only meaningful in a real repo, but `verify` does not fail when `committable: false`.

## Scenarios

- **clean/** — minimal valid KB; all checks return empty violations. Includes `cmd/server/main.go` stub so staleRef check is quiet.
- **ssot-violation/** — three identical lines span architecture.md + features.md; triggers `ssotViolations`.
- **shape-violation/** — exercises all `shapeViolations` kinds: commit SHA + test count + shipped-narrative + commits-range in features.md; multi-line term + method signatures + over-wide single-line entry in glossary.md; summary-format ADR whose body exceeds 6 lines (`unsplit_adr_detail`) + superseded ADR with residual body content (`unresolved_supersede`) in decisions.md.

For `tokenBudgetViolation` (>20K tokens ≈ >80KB of content), use a real large KB (e.g., `/home/xuhao/talgent/`) rather than a dedicated fixture — mocking 80KB of filler content here has no additional signal over the real-data dry-run in Task 11.
