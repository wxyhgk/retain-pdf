/**
 * Shared types for the job-status engine (stage contract, display state, progress).
 * Built from public-stage-engine, contract adapter, and status-card usage.
 *
 * Source of truth: `contracts/job-status.v1.schema.json`
 * (JobProgressView / JobStageSnapshotView / JobStagesView / JobTimestampsView).
 * Rust origin: `backend/packages/retain-core/src/models/view/{job_types.rs, common.rs}`.
 * Contract test: `tests/job-status-contract.test.mjs` locks `stage_snapshot/progress/percent/unit` and `JobStageStateView`.
 * TODO: replace hand-written progress/stage types with generated types from schemas.
 */
export {};
