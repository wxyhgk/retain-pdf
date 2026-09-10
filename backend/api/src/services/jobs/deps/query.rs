use super::ReplayDeps;
use crate::db::Db;
use crate::services::download_generation::DownloadGeneration;
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Clone)]
pub(crate) struct QueryJobsDeps<'a> {
    pub(crate) db: &'a Db,
    pub(crate) data_root: &'a Path,
    pub(crate) downloads_dir: &'a Path,
    pub(crate) download_generation: &'a Arc<DownloadGeneration>,
    pub(crate) replay: ReplayDeps<'a>,
}

impl<'a> QueryJobsDeps<'a> {
    pub(crate) fn new(
        db: &'a Db,
        data_root: &'a Path,
        downloads_dir: &'a Path,
        download_generation: &'a Arc<DownloadGeneration>,
        replay: ReplayDeps<'a>,
    ) -> Self {
        Self {
            db,
            data_root,
            downloads_dir,
            download_generation,
            replay,
        }
    }
}

/// Owned snapshot for a blocking download task; never captures borrowed facade
/// state or reconstructs runtime paths from environment variables.
pub(crate) struct OwnedQueryJobsDeps {
    db: Db,
    data_root: PathBuf,
    downloads_dir: PathBuf,
    download_generation: Arc<DownloadGeneration>,
    project_root: PathBuf,
    scripts_dir: PathBuf,
    python_bin: String,
    pipeline_command: String,
    replay_data_root: PathBuf,
}

impl QueryJobsDeps<'_> {
    pub(crate) fn owned(&self) -> OwnedQueryJobsDeps {
        OwnedQueryJobsDeps {
            db: self.db.clone(),
            data_root: self.data_root.into(),
            downloads_dir: self.downloads_dir.into(),
            download_generation: self.download_generation.clone(),
            project_root: self.replay.project_root.into(),
            scripts_dir: self.replay.scripts_dir.into(),
            python_bin: self.replay.python_bin.into(),
            pipeline_command: self.replay.pipeline_command.into(),
            replay_data_root: self.replay.data_root.into(),
        }
    }
}

impl OwnedQueryJobsDeps {
    pub(crate) fn borrowed(&self) -> QueryJobsDeps<'_> {
        QueryJobsDeps::new(
            &self.db,
            &self.data_root,
            &self.downloads_dir,
            &self.download_generation,
            ReplayDeps::new(
                &self.project_root,
                &self.scripts_dir,
                &self.python_bin,
                &self.pipeline_command,
                &self.replay_data_root,
            ),
        )
    }
}
