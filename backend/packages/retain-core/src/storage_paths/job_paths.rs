use std::path::{Path, PathBuf};

use anyhow::Result;

use crate::models::domain::{JobArtifacts, JobSnapshot};

use super::constants::{
    OUTPUT_ARTIFACTS_DIR_NAME, OUTPUT_LOGS_DIR_NAME, OUTPUT_MARKDOWN_DIR_NAME, OUTPUT_OCR_DIR_NAME,
    OUTPUT_RENDERED_DIR_NAME, OUTPUT_SOURCE_DIR_NAME, OUTPUT_SPECS_DIR_NAME,
    OUTPUT_TRANSLATED_DIR_NAME,
};

#[derive(Clone, Debug)]
pub struct JobPaths {
    pub root: PathBuf,
    pub source_dir: PathBuf,
    pub ocr_dir: PathBuf,
    pub markdown_dir: PathBuf,
    pub translated_dir: PathBuf,
    pub rendered_dir: PathBuf,
    pub artifacts_dir: PathBuf,
    pub logs_dir: PathBuf,
    pub specs_dir: PathBuf,
}

impl JobPaths {
    pub fn for_job(output_root: &Path, job_id: &str) -> Self {
        let root = output_root.join(job_id);
        Self {
            source_dir: root.join(OUTPUT_SOURCE_DIR_NAME),
            ocr_dir: root.join(OUTPUT_OCR_DIR_NAME),
            markdown_dir: root.join(OUTPUT_MARKDOWN_DIR_NAME),
            translated_dir: root.join(OUTPUT_TRANSLATED_DIR_NAME),
            rendered_dir: root.join(OUTPUT_RENDERED_DIR_NAME),
            artifacts_dir: root.join(OUTPUT_ARTIFACTS_DIR_NAME),
            logs_dir: root.join(OUTPUT_LOGS_DIR_NAME),
            specs_dir: root.join(OUTPUT_SPECS_DIR_NAME),
            root,
        }
    }

    pub fn create_all(&self) -> Result<()> {
        for path in [
            &self.root,
            &self.source_dir,
            &self.ocr_dir,
            &self.markdown_dir,
            &self.translated_dir,
            &self.rendered_dir,
            &self.artifacts_dir,
            &self.logs_dir,
            &self.specs_dir,
        ] {
            std::fs::create_dir_all(path)?;
        }
        Ok(())
    }
}

pub fn build_job_paths(output_root: &Path, job_id: &str) -> Result<JobPaths> {
    let job_paths = JobPaths::for_job(output_root, job_id);
    job_paths.create_all()?;
    Ok(job_paths)
}

pub fn attach_job_paths(job: &mut JobSnapshot, job_paths: &JobPaths) {
    let artifacts = job.artifacts.get_or_insert_with(JobArtifacts::default);
    artifacts.job_root = Some(job_paths.root.to_string_lossy().to_string());
}
