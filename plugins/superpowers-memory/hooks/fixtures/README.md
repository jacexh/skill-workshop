# Verify Fixtures

Each subdirectory is a scenario KB for exercising `hook-runtime.js verify` behavior.
The runtime resolves the Git worktree root when invoked inside a repository, so fixture tests copy scenarios to a temporary non-repo directory before running `verify`.

## Running

```bash
bash scripts/release/test/test_memory_verify.sh
```

No git init required — the `committable` field is only meaningful in a real repo, but `verify` does not fail when `committable: false`.

## Scenarios

- **clean/** — minimal valid KB; all checks return empty violations. Includes `cmd/server/main.go` stub so staleRef check is quiet.
- **dense-features/** — `features.md` capability compressed into one oversized paragraph; triggers `feature_entry_too_dense`.
- **missing-feature-fields/** — implemented `features.md` capability missing fixed fields; triggers `feature_missing_field`.
- **ssot-violation/** — three identical lines span architecture.md + features.md; triggers `ssotViolations`.
- **shape-violation/** — exercises all `shapeViolations` kinds: commit SHA + test count + shipped-narrative + commits-range in features.md; multi-line term + method signatures + over-wide single-line entry in glossary.md; summary-format ADR whose body exceeds 6 lines (`unsplit_adr_detail`) + superseded ADR with residual body content (`unresolved_supersede`) in decisions.md.

For `tokenBudgetViolation` (>20K tokens ≈ >80KB of content), use a real large KB (e.g., `/home/xuhao/talgent/`) rather than a dedicated fixture — mocking 80KB of filler content here has no additional signal over the real-data dry-run in Task 11.
