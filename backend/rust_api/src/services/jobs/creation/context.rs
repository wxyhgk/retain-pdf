use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;

use tokio::sync::Mutex;
use tokio::sync::RwLock;

use crate::config::{JobRunnerConfig, JobSnapshotRuntimeConfig};
use crate::db::Db;
use crate::services::job_launcher::JobLaunchDeps;
use crate::services::runtime_gateway::RuntimeControl;

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
pub(crate) struct UploadStoreDeps<'a> {
    pub(crate) db: &'a Db,
    pub(crate) uploads_dir: &'a Path,
    pub(crate) upload_max_bytes: u64,
    pub(crate) upload_max_pages: u32,
    pub(crate) python_bin: &'a str,
}

impl<'a> UploadStoreDeps<'a> {
    pub(crate) fn new(
        db: &'a Db,
        uploads_dir: &'a Path,
        upload_max_bytes: u64,
        upload_max_pages: u32,
        python_bin: &'a str,
    ) -> Self {
        Self {
            db,
            uploads_dir,
            upload_max_bytes,
            upload_max_pages,
            python_bin,
        }
    }
}

#[derive(Clone)]
pub(crate) struct JobSubmitDeps<'a> {
    pub(crate) snapshot: SnapshotBuildDeps<'a>,
    pub(crate) uploads: UploadStoreDeps<'a>,
    pub(crate) launcher: JobLaunchDeps<'a>,
}

impl<'a> JobSubmitDeps<'a> {
    pub(crate) fn new(
        snapshot: SnapshotBuildDeps<'a>,
        uploads: UploadStoreDeps<'a>,
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
        canceled_jobs: &'a RwLock<HashSet<String>>,
    ) -> Self {
        Self {
            db,
            job_runner,
            data_root,
            output_root,
            runtime: RuntimeControl::new(canceled_jobs),
        }
    }
}

#[derive(Clone)]
pub(crate) struct ReplayDeps<'a> {
    pub(crate) project_root: &'a Path,
    pub(crate) scripts_dir: &'a Path,
    pub(crate) python_bin: &'a str,
    pub(crate) data_root: &'a Path,
}

impl<'a> ReplayDeps<'a> {
    pub(crate) fn new(
        project_root: &'a Path,
        scripts_dir: &'a Path,
        python_bin: &'a str,
        data_root: &'a Path,
    ) -> Self {
        Self {
            project_root,
            scripts_dir,
            python_bin,
            data_root,
        }
    }
}

#[derive(Clone)]
pub(crate) struct QueryJobsDeps<'a> {
    pub(crate) db: &'a Db,
    pub(crate) data_root: &'a Path,
    pub(crate) downloads_dir: &'a Path,
    pub(crate) downloads_lock: &'a Arc<Mutex<()>>,
    pub(crate) replay: ReplayDeps<'a>,
}

impl<'a> QueryJobsDeps<'a> {
    pub(crate) fn new(
        db: &'a Db,
        data_root: &'a Path,
        downloads_dir: &'a Path,
        downloads_lock: &'a Arc<Mutex<()>>,
        replay: ReplayDeps<'a>,
    ) -> Self {
        Self {
            db,
            data_root,
            downloads_dir,
            downloads_lock,
            replay,
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
