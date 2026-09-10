//! Narrow dependencies assembled by app/jobs, independent of job creation implementation.

mod command;
mod query;
mod replay;

pub(crate) use command::{
    BundleBuildDeps, CommandJobsDeps, ControlDeps, JobSubmitDeps, SnapshotBuildDeps,
};
pub(crate) use query::QueryJobsDeps;
pub(crate) use replay::ReplayDeps;
