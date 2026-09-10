use crate::config::{JobRunnerConfig, JobSnapshotRuntimeConfig};
use crate::db::Db;
use crate::services::job_launcher::JobLaunchDeps;
use crate::services::runtime_gateway::{JobRuntime, RuntimeControl};
use crate::services::uploads::UploadService;
use std::path::Path;

#[derive(Clone)]
pub(crate) struct SnapshotBuildDeps<'a> {
    pub(crate) db: &'a Db,
    pub(crate) config: JobSnapshotRuntimeConfig<'a>,
}

impl<'a> SnapshotBuildDeps<'a> {
    pub(crate) fn new(db: &'a Db, config: JobSnapshotRuntimeConfig<'a>) -> Self {
        Self { db, config }
    }
}

#[derive(Clone)]
pub(crate) struct JobSubmitDeps<'a> {
    pub(crate) snapshot: SnapshotBuildDeps<'a>,
    pub(crate) uploads: &'a UploadService,
    pub(crate) launcher: JobLaunchDeps<'a>,
}

impl<'a> JobSubmitDeps<'a> {
    pub(crate) fn new(
        snapshot: SnapshotBuildDeps<'a>,
        uploads: &'a UploadService,
        launcher: JobLaunchDeps<'a>,
    ) -> Self {
        Self {
            snapshot,
            uploads,
            launcher,
        }
    }
}

#[derive(Clone)]
pub(crate) struct BundleBuildDeps<'a> {
    pub(crate) submit: JobSubmitDeps<'a>,
}

impl<'a> BundleBuildDeps<'a> {}

#[derive(Clone)]
pub(crate) struct ControlDeps<'a> {
    pub(crate) db: &'a Db,
    pub(crate) job_runner: &'a JobRunnerConfig,
    pub(crate) data_root: &'a Path,
    pub(crate) output_root: &'a Path,
    pub(crate) runtime: RuntimeControl<'a>,
}

impl<'a> ControlDeps<'a> {
    pub(crate) fn new(
        db: &'a Db,
        job_runner: &'a JobRunnerConfig,
        data_root: &'a Path,
        output_root: &'a Path,
        job_runtime: &'a JobRuntime,
    ) -> Self {
        Self {
            db,
            job_runner,
            data_root,
            output_root,
            runtime: RuntimeControl::new(job_runtime),
        }
    }
}

#[derive(Clone)]
pub(crate) struct CommandJobsDeps<'a> {
    pub(crate) db: &'a Db,
    pub(crate) submit: JobSubmitDeps<'a>,
    pub(crate) control: ControlDeps<'a>,
}

impl<'a> CommandJobsDeps<'a> {
    pub(crate) fn new(db: &'a Db, submit: JobSubmitDeps<'a>, control: ControlDeps<'a>) -> Self {
        Self {
            db,
            submit,
            control,
        }
    }
}
