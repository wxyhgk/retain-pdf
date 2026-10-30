//! 下载测试用的临时库、任务目录和假渲染器。任务包自己的测试用它；书库的测试经 `test-fixtures` 特性用它，
//! 生产构建里没有。

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use retainpdf_core::models::domain::{CreateJobInput, JobArtifacts, JobSnapshot};
use retainpdf_data::db::Db;
use retainpdf_files::DownloadGeneration;

use super::JobDownloads;

pub const JOB_ID: &str = "preview-job";

pub struct DownloadFixture {
    pub root: PathBuf,
    pub db: Db,
    pub generation: Arc<DownloadGeneration>,
    pub renderer: String,
}

impl DownloadFixture {
    pub fn new() -> Self {
        let root = std::env::temp_dir().join(format!("retain-download-test-{}", fastrand::u64(..)));
        let job_root = root.join("jobs").join(JOB_ID);
        fs::create_dir_all(&job_root).unwrap();
        fs::write(job_root.join("source.pdf"), b"source").unwrap();
        fs::write(job_root.join("translated.pdf"), b"translated").unwrap();
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().unwrap();
        let mut job = JobSnapshot::new(JOB_ID.into(), CreateJobInput::default(), vec![]);
        job.artifacts = Some(JobArtifacts {
            job_root: Some(format!("jobs/{JOB_ID}")),
            source_pdf: Some(format!("jobs/{JOB_ID}/source.pdf")),
            output_pdf: Some(format!("jobs/{JOB_ID}/translated.pdf")),
            ..Default::default()
        });
        db.save_job(&job).unwrap();

        // Exercise the actual subprocess boundary without requiring PyMuPDF.
        // The bounded release barrier also makes a runtime-blocking regression
        // fail instead of hanging the test indefinitely.
        let renderer = root.join("renderer");
        fs::write(
            &renderer,
            r#"#!/bin/sh
[ -n "$RENDER_WARMUP" ] && exit 0
printf 'render\n' >> "$0.calls"
remaining=250
while [ ! -f "$0.release" ]; do
    remaining=$((remaining - 1))
    [ "$remaining" -gt 0 ] || exit 1
    sleep 0.02
done
printf 'offline preview bytes' > "$4"
"#,
        )
        .unwrap();
        fs::set_permissions(&renderer, fs::Permissions::from_mode(0o755)).unwrap();
        // 先空跑一次（不记调用），见 files::test_scripts（2026-10-30 在全量测试里碰到 "renderer starts: Elapsed"）
        crate::files::test_scripts::warm_up_fresh_script(&renderer, "RENDER_WARMUP");
        Self {
            root,
            db,
            generation: Arc::new(DownloadGeneration::default()),
            renderer: renderer.to_string_lossy().into_owned(),
        }
    }

    pub fn downloads(&self) -> JobDownloads<'_> {
        JobDownloads::new(
            &self.db,
            &self.root,
            &self.root,
            &self.generation,
            &self.renderer,
            "unused-pipeline",
        )
    }

    pub async fn wait_started(&self) {
        tokio::time::timeout(Duration::from_secs(3), async {
            while !self.root.join("renderer.calls").exists() {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .expect("renderer starts");
    }

    pub async fn release_when_started(&self) {
        self.wait_started().await;
        // This timer must run even with a single Tokio worker and a waiting
        // subprocess. The renderer only exits successfully after this write.
        tokio::time::sleep(Duration::from_millis(10)).await;
        fs::write(self.root.join("renderer.release"), b"release").unwrap();
    }

    pub fn render_count(&self) -> usize {
        fs::read_to_string(self.root.join("renderer.calls"))
            .unwrap_or_default()
            .lines()
            .count()
    }
}

impl Drop for DownloadFixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
