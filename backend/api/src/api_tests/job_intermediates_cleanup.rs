//! 成功任务目录里纯重复文件的清理（整轮清理每次都做，不用设置）：删掉以后任务记录里的字段跟着清、文件列表不再列；
//! 排队、在跑的任务引用着的目录不碰；打包下载的旧 zip 删掉。

use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime};

use super::jobs_common::test_state;
use crate::app::{run_cleanup_once, RetentionSettings};
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot, JobStatusKind};

const DONE: &str = "20261028090000-done00";
const BUSY: &str = "20261028090000-busy00";
const QUEUED: &str = "20261028100000-queued";

fn all_off() -> RetentionSettings {
    RetentionSettings {
        events_retention_days: 0,
        orphan_upload_retention_hours: 0,
        derived_cache_retention_days: 0,
    }
}

fn write(path: &Path, age: Duration) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, b"bytes").unwrap();
    fs::File::options()
        .write(true)
        .open(path)
        .unwrap()
        .set_modified(SystemTime::now() - age)
        .unwrap();
}

/// 一个成功的 MinerU 翻译任务：原始压缩包、解包目录、发布的 Markdown、译文和上一份译文。
fn save_succeeded_job(state: &crate::AppState, job_id: &str) {
    let data_root = &state.config.data_root;
    let rel = |rest: &str| format!("jobs/{job_id}/{rest}");
    for rest in [
        "source/paper.pdf",
        "ocr/mineru_bundle.zip",
        "ocr/unpacked/layout.json",
        "ocr/unpacked/abc_origin.pdf",
        "ocr/unpacked/images/fig1.jpg",
        "ocr/normalized/document.v1.json",
        "md/full.md",
        "rendered/paper-translated.pdf",
        "rendered/paper-translated.previous.pdf",
    ] {
        write(&data_root.join(rel(rest)), Duration::ZERO);
    }
    let mut job = JobSnapshot::new(job_id.into(), CreateJobInput::default(), vec!["python".into()]);
    job.status = JobStatusKind::Succeeded;
    job.artifacts = Some(JobArtifacts {
        job_root: Some(format!("jobs/{job_id}")),
        source_pdf: Some(rel("source/paper.pdf")),
        layout_json: Some(rel("ocr/unpacked/layout.json")),
        normalized_document_json: Some(rel("ocr/normalized/document.v1.json")),
        provider_raw_dir: Some(rel("ocr/unpacked")),
        provider_zip: Some(rel("ocr/mineru_bundle.zip")),
        output_pdf: Some(rel("rendered/paper-translated.pdf")),
        previous_output_pdf: Some(rel("rendered/paper-translated.previous.pdf")),
        previous_finished_at: Some("2026-10-27T10:00:00Z".into()),
        ..Default::default()
    });
    job.sync_runtime_state();
    state.db.save_job(&job).expect("save job");
}

fn provider_zip_listed(state: &crate::AppState, job_id: &str) -> bool {
    state
        .db
        .list_job_artifact_entries(job_id)
        .unwrap()
        .iter()
        .any(|entry| entry.artifact_key == "provider_bundle_zip" && entry.ready)
}

#[test]
fn duplicates_of_succeeded_jobs_go_and_their_records_follow() {
    let state = test_state("job-intermediates");
    let data_root = state.config.data_root.clone();
    save_succeeded_job(&state, DONE);
    assert!(provider_zip_listed(&state, DONE), "listed before the sweep");

    run_cleanup_once(&all_off(), &state.db, &data_root).expect("sweep");

    let job_dir = data_root.join("jobs").join(DONE);
    assert!(!job_dir.join("ocr/mineru_bundle.zip").exists());
    assert!(!job_dir.join("ocr/unpacked/abc_origin.pdf").exists());
    assert!(!job_dir.join("ocr/unpacked/images").exists());
    assert!(!job_dir.join("rendered/paper-translated.previous.pdf").exists());
    for kept in [
        "source/paper.pdf",
        "ocr/unpacked/layout.json",
        "ocr/normalized/document.v1.json",
        "md/full.md",
        "rendered/paper-translated.pdf",
    ] {
        assert!(job_dir.join(kept).exists(), "{kept} must be kept");
    }
    let job = state.db.get_job(DONE).unwrap();
    assert_eq!(job.status, JobStatusKind::Succeeded);
    let artifacts = job.artifacts.unwrap();
    assert_eq!(artifacts.provider_zip, None);
    assert_eq!(artifacts.previous_output_pdf, None);
    assert_eq!(artifacts.previous_finished_at, None);
    assert!(artifacts.layout_json.is_some());
    assert!(artifacts.output_pdf.is_some());
    assert!(!provider_zip_listed(&state, DONE), "the file list no longer offers the zip");
}

#[test]
fn directories_a_queued_job_still_reads_are_left_alone() {
    let state = test_state("job-intermediates-busy");
    let data_root = state.config.data_root.clone();
    save_succeeded_job(&state, BUSY);
    let mut queued = JobSnapshot::new(QUEUED.into(), CreateJobInput::default(), vec!["python".into()]);
    queued.request_payload.source.artifact_job_id = BUSY.into();
    queued.status = JobStatusKind::Queued;
    queued.sync_runtime_state();
    state.db.save_job(&queued).expect("save queued job");

    run_cleanup_once(&all_off(), &state.db, &data_root).expect("sweep");

    let job_dir = data_root.join("jobs").join(BUSY);
    assert!(job_dir.join("ocr/mineru_bundle.zip").exists());
    assert!(job_dir.join("rendered/paper-translated.previous.pdf").exists());
    assert!(state.db.get_job(BUSY).unwrap().artifacts.unwrap().provider_zip.is_some());
}

#[test]
fn old_download_bundles_are_removed_and_fresh_ones_kept() {
    let state = test_state("job-intermediates-downloads");
    let data_root = state.config.data_root.clone();
    let old = data_root.join("downloads").join(format!("{DONE}.zip"));
    let fresh = data_root.join("downloads").join(format!("{BUSY}.zip"));
    write(&old, Duration::from_secs(2 * 3600));
    write(&fresh, Duration::from_secs(60));

    run_cleanup_once(&all_off(), &state.db, &data_root).expect("sweep");

    assert!(!old.exists());
    assert!(fresh.exists(), "may be about to be sent");
}
