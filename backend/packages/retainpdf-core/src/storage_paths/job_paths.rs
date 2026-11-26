use std::ffi::OsString;
use std::path::{Path, PathBuf};

use anyhow::Result;

use crate::models::domain::{JobArtifacts, JobSnapshot};

use super::constants::{
    OUTPUT_ARTIFACTS_DIR_NAME, OUTPUT_LOGS_DIR_NAME, OUTPUT_MARKDOWN_DIR_NAME, OUTPUT_OCR_DIR_NAME,
    OUTPUT_RENDERED_DIR_NAME, OUTPUT_SOURCE_DIR_NAME, OUTPUT_SPECS_DIR_NAME,
    OUTPUT_TRANSLATED_DIR_NAME,
};

/// 模型用量台账（每次模型返回追加一行，见 Python `retainpdf_base/usage_ledger.py`）。
pub const TOKEN_USAGE_LEDGER_FILE_NAME: &str = "token-usage.v1.jsonl";
/// 台账文件路径的环境变量（Python `retainpdf_base/usage_ledger.py` 的 `LEDGER_ENV`）。
pub const USAGE_LEDGER_ENV: &str = "RETAIN_USAGE_LEDGER";
/// 台账行记的任务编号（Python 的 `JOB_ID_ENV`）。
pub const USAGE_JOB_ID_ENV: &str = "RETAIN_USAGE_JOB_ID";

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

    pub fn token_usage_ledger(&self) -> PathBuf {
        self.artifacts_dir.join(TOKEN_USAGE_LEDGER_FILE_NAME)
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

/// 起任何可能调模型的子进程（阶段 worker、领域预热、单块重放、失败诊断……）都要带上的台账环境变量，
/// 用 `command.envs(usage_ledger_env(..))` 设。Python 那边没拿到台账路径就不记账、也不报错，
/// 漏传了花的钱就静默不入账（2026-11-26，S57：领域预热、单块重放都漏过），所以统一从这里取，不要手写变量名。
///
/// 路径和用量报表读的是同一个（`JobPaths::for_job(output_root, job_id).token_usage_ledger()`）。
pub fn usage_ledger_env(output_root: &Path, job_id: &str) -> [(&'static str, OsString); 2] {
    [
        (
            USAGE_LEDGER_ENV,
            JobPaths::for_job(output_root, job_id)
                .token_usage_ledger()
                .into_os_string(),
        ),
        (USAGE_JOB_ID_ENV, OsString::from(job_id)),
    ]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usage_ledger_env_points_at_the_job_ledger_the_report_reads() {
        let output_root = Path::new("/data/jobs");
        let env = usage_ledger_env(output_root, "job-a");
        assert_eq!(env[0].0, "RETAIN_USAGE_LEDGER");
        assert_eq!(
            PathBuf::from(&env[0].1),
            JobPaths::for_job(output_root, "job-a").token_usage_ledger()
        );
        assert_eq!(env[1], ("RETAIN_USAGE_JOB_ID", OsString::from("job-a")));
    }
}
