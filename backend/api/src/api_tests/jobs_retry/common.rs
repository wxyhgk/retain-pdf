use std::fs;

use crate::api_tests::jobs_common::minimal_pdf_bytes;
use crate::db::{PipelineDispatchBegin, PipelineDispatchIntent};
use crate::models::{now_iso, CreateJobInput, JobArtifacts, JobSnapshot, UploadRecord};

pub(super) fn source_job_with_artifacts(job_id: &str, mut artifacts: JobArtifacts) -> JobSnapshot {
    if artifacts.source_pdf.is_some() && artifacts.normalized_document_json.is_some() {
        artifacts
            .layout_json
            .get_or_insert_with(|| format!("jobs/{job_id}/ocr/layout.json"));
        artifacts
            .ocr_status
            .get_or_insert(crate::models::JobStatusKind::Succeeded);
    }
    let mut input = CreateJobInput::default();
    input.runtime.job_id = job_id.to_string();
    input.translation.api_key = "sk-rerun-test".to_string();
    input.translation.model = "deepseek-v4-flash".to_string();
    input.translation.base_url = "https://api.deepseek.com/v1".to_string();
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()]);
    job.artifacts = Some(artifacts);
    job
}

pub(super) fn seed_ocr_upload(state: &crate::AppState, upload_id: &str) -> UploadRecord {
    let upload_dir = state.config.uploads_dir.join(upload_id);
    fs::create_dir_all(&upload_dir).expect("upload dir");
    let upload_path = upload_dir.join("input.pdf");
    fs::write(&upload_path, minimal_pdf_bytes(595, 842)).expect("upload pdf");
    let upload = UploadRecord {
        upload_id: upload_id.to_string(),
        filename: "input.pdf".to_string(),
        stored_path: upload_path.to_string_lossy().into_owned(),
        bytes: fs::metadata(&upload_path).expect("upload metadata").len(),
        page_count: 1,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: String::new(),
    };
    state.db.save_upload(&upload).expect("save upload");
    upload
}

pub(super) fn seed_ambiguous_ocr_dispatch(
    state: &crate::AppState,
    job_id: &str,
    provider: &str,
    operation: &str,
) {
    let cursor = state
        .db
        .acquire_pipeline_attempt(job_id, "worker-before-crash", "ocr", 0)
        .expect("OCR attempt");
    let intent = PipelineDispatchIntent {
        dispatch_key: "ocr-submit".to_string(),
        provider: provider.to_string(),
        operation: operation.to_string(),
        request_hash: "a".repeat(64),
    };
    assert!(matches!(
        state
            .db
            .begin_pipeline_dispatch(&cursor, &intent)
            .expect("dispatch intent"),
        PipelineDispatchBegin::Send { .. }
    ));
    let recovered = state
        .db
        .acquire_pipeline_attempt(job_id, "worker-after-crash", "ocr", 0)
        .expect("restart claim");
    assert!(matches!(
        state
            .db
            .begin_pipeline_dispatch(&recovered, &intent)
            .expect("ambiguous dispatch"),
        PipelineDispatchBegin::Ambiguous { .. }
    ));
    state
        .db
        .finish_latest_pipeline_attempt(job_id, "failed")
        .expect("close source attempt");
}

pub(super) fn seed_ocr_checkpoint_files(state: &crate::AppState, job: &JobSnapshot) {
    let artifacts = job.artifacts.as_ref().expect("job artifacts");
    if let Some(path) = artifacts.source_pdf.as_deref() {
        let path = state.config.data_root.join(path);
        fs::create_dir_all(path.parent().expect("source pdf parent")).expect("source pdf dir");
        fs::write(path, minimal_pdf_bytes(595, 842)).expect("source pdf file");
    }
    if let Some(path) = artifacts.normalized_document_json.as_deref() {
        let path = state.config.data_root.join(path);
        fs::create_dir_all(path.parent().expect("normalized parent")).expect("normalized dir");
        fs::write(path, br#"{"pages":[]}"#).expect("normalized file");
    }
    if let Some(path) = artifacts.layout_json.as_deref() {
        let path = state.config.data_root.join(path);
        fs::create_dir_all(path.parent().expect("layout parent")).expect("layout dir");
        fs::write(path, br#"{"layoutParsingResults":[]}"#).expect("layout file");
    }
}

pub(super) fn seed_translation_result_files(state: &crate::AppState, job: &JobSnapshot) {
    seed_ocr_checkpoint_files(state, job);
    let artifacts = job.artifacts.as_ref().expect("job artifacts");
    let translated_dir = artifacts
        .translations_dir
        .as_deref()
        .map(|path| state.config.data_root.join(path))
        .expect("translations dir artifact");
    fs::create_dir_all(&translated_dir).expect("translations dir");
    fs::write(
        translated_dir.join("translation-manifest.json"),
        br#"{"schema":"translation_manifest_v1","schema_version":1,"status":"complete"}"#,
    )
    .expect("translation manifest");
}

pub(super) fn seed_partial_translation_checkpoint(state: &crate::AppState, job: &JobSnapshot) {
    seed_ocr_checkpoint_files(state, job);
    let artifacts = job.artifacts.as_ref().expect("job artifacts");
    let checkpoint = artifacts
        .translation_checkpoint_json
        .as_deref()
        .map(|path| state.config.data_root.join(path))
        .expect("translation checkpoint artifact");
    let translated_dir = checkpoint.parent().expect("checkpoint parent");
    fs::create_dir_all(translated_dir).expect("translated dir");
    fs::write(translated_dir.join("page-001-deepseek.json"), br#"[]"#).expect("translation page");
    fs::write(
        checkpoint,
        br#"{"schema":"translation_checkpoint_v1","schema_version":1,"status":"in_progress","fingerprint":"test-fingerprint","pages":[{"path":"page-001-deepseek.json"}]}"#,
    )
    .expect("translation checkpoint");
}

pub(super) fn seed_ambiguous_translation_request_journal(
    state: &crate::AppState,
    job: &JobSnapshot,
) {
    let job_root = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.job_root.as_deref())
        .map(|path| state.config.data_root.join(path))
        .expect("job root artifact");
    let translated_dir = job_root.join("translated");
    fs::create_dir_all(&translated_dir).expect("translated dir");
    fs::write(
        translated_dir.join("translation-request-journal.v1.jsonl"),
        br#"{"schema":"translation_request_journal_v1","schema_version":1,"event":"dispatch","request_token":"token-a","request_key":"key-a"}
"#,
    )
    .expect("request journal");
}
