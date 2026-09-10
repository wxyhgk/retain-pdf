//! Durable pipeline persistence.
//!
//! Mutations are grouped by complete state transitions rather than by SQLite
//! table. Transaction-scoped helpers never open or commit their own
//! connection, so generation fencing, durable state, and audit events remain
//! atomic.

mod attempts;
mod dispatches;
pub(super) mod events;
mod queries;
mod stages;
pub(super) mod tx;
mod units;

#[cfg(test)]
mod tests;

pub(super) use events::append_state_event;
pub(super) use tx::validate_identity;

mod types;

pub use types::{
    PipelineAttemptCursor, PipelineCheckpoint, PipelineCommitEventRecord, PipelineDispatchBegin,
    PipelineDispatchIntent, PipelineDispatchRecord, PipelineStageObservation, PipelineStageState,
    PipelineUnitCommit, PipelineUnitRecord,
};
