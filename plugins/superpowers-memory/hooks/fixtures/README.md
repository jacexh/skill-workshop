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
- **architecture-coverage-gap/** — complex multi-service/DDD-shaped repo with a thin architecture summary; triggers advisory `coverageGaps` without failing `verify.ok`.
- **architecture-shallow-coverage/** — complex multi-service/DDD-shaped repo whose card/diagram counts pass but service cards only name generic code layers and scenarios lack local source refs; triggers advisory answerability gaps without failing `verify.ok`.
- **architecture-shard-crossrefs-gap/** — complex repo with dedicated module/scenario shards that miss required cross-links and scenario authority/order/failure fields; triggers module/scenario advisory gaps without failing `verify.ok`.
- **architecture-view-shards-legacy/** — complex multi-service/DDD-shaped repo whose card/diagram counts and source refs pass but architecture detail is split by legacy view shards (`architecture-contexts.md`, `architecture-flows.md`); triggers advisory migration to module-first and named scenario shards without failing `verify.ok`.
- **dense-features/** — `features.md` capability compressed into one oversized paragraph; triggers `feature_entry_too_dense`.
- **legacy-adr-inline/** — old-style inline ADR rationale in `decisions.md`; triggers `legacy_adr_inline`.
- **missing-adr-detail/** — ADR summary points to a missing on-demand detail file; triggers `adr_detail_missing`.
- **readiness-warning/** — implemented capability points at scaffolded/not-implemented code without boundary calibration; triggers `capability_readiness_uncalibrated`.
- **missing-feature-fields/** — implemented `features.md` capability missing fixed fields; triggers `feature_missing_field`.
- **ssot-violation/** — three identical lines span architecture.md + features.md; triggers `ssotViolations`.
- **shape-violation/** — exercises all `shapeViolations` kinds: commit SHA + test count + shipped-narrative + commits-range in features.md; multi-line term + method signatures + over-wide single-line entry in glossary.md; summary-format ADR whose body exceeds 6 lines (`unsplit_adr_detail`) + superseded ADR with residual body content (`unresolved_supersede`) in decisions.md.

For retrieval-cost observation, use a real large KB or generate a focused shard fixture inside the test script. Retrieval cost and split candidates are advisory and do not make `verify.ok` fail.
