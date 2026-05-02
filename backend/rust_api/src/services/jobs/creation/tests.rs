use std::collections::HashSet;
use std::sync::Arc;

use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};
use tokio::sync::{Mutex, RwLock, Semaphore};

use crate::config::AppConfig;
use crate::db::Db;
use crate::error::AppError;
use crate::models::{now_iso, CreateJobInput, JobSnapshot, UploadRecord, WorkflowKind};
use crate::services::job_launcher::JobLaunchDeps;
use crate::services::runtime_gateway::JobRuntimeLauncher;
use crate::AppState;

use super::context::{JobSubmitDeps, SnapshotBuildDeps, UploadStoreDeps};
use super::job_builders::{build_ocr_job_snapshot, build_translation_job_snapshot};
use super::submit::create_translation_job;
use super::upload::{store_pdf_upload, UploadedPdfInput};

fn test_state(test_name: &str) -> AppState {
    let root = std::env::temp_dir().join(format!(
        "rust-api-creation-{test_name}-{}",
        fastrand::u64(..)
    ));
    let data_root = root.join("data");
    let output_root = data_root.join("jobs");
    let downloads_dir = data_root.join("downloads");
    let uploads_dir = data_root.join("uploads");
    let rust_api_root = root.join("rust_api");
    let scripts_dir = root.join("scripts");
    std::fs::create_dir_all(&output_root).expect("create output root");
    std::fs::create_dir_all(&downloads_dir).expect("create downloads dir");
    std::fs::create_dir_all(&uploads_dir).expect("create uploads dir");
    std::fs::create_dir_all(&rust_api_root).expect("create rust_api root");
    std::fs::create_dir_all(&scripts_dir).expect("create scripts dir");

    let config = Arc::new(AppConfig {
        project_root: root.clone(),
        rust_api_root,
        data_root: data_root.clone(),
        scripts_dir: scripts_dir.clone(),
        run_provider_case_script: scripts_dir.join("run_provider_case.py"),
        run_provider_ocr_script: scripts_dir.join("run_provider_ocr.py"),
        run_normalize_ocr_script: scripts_dir.join("run_normalize_ocr.py"),
        run_translate_from_ocr_script: scripts_dir.join("run_translate_from_ocr.py"),
        run_translate_only_script: scripts_dir.join("run_translate_only.py"),
        run_render_only_script: scripts_dir.join("run_render_only.py"),
        run_failure_ai_diagnosis_script: scripts_dir.join("diagnose_failure_with_ai.py"),
        uploads_dir,
        downloads_dir,
        jobs_db_path: data_root.join("db").join("jobs.db"),
        output_root,
        python_bin: "python".to_string(),
        bind_host: "127.0.0.1".to_string(),
        port: 41000,
        simple_port: 41001,
        upload_max_bytes: 0,
        upload_max_pages: 0,
        api_keys: HashSet::new(),
        max_running_jobs: 1,
    });

    AppState {
        config: config.clone(),
        db: Arc::new(Db::new(
            config.jobs_db_path.clone(),
            config.data_root.clone(),
        )),
        downloads_lock: Arc::new(Mutex::new(())),
        canceled_jobs: Arc::new(RwLock::new(HashSet::new())),
        job_slots: Arc::new(Semaphore::new(1)),
    }
}

fn snapshot_context<'a>(state: &'a AppState) -> SnapshotBuildDeps<'a> {
    SnapshotBuildDeps::new(state.db.as_ref(), state.config.as_ref())
}

fn submit_context<'a>(state: &'a AppState) -> JobSubmitDeps<'a> {
    JobSubmitDeps::new(
        snapshot_context(state),
        UploadStoreDeps::new(
            state.db.as_ref(),
            &state.config.uploads_dir,
            state.config.upload_max_bytes,
            state.config.upload_max_pages,
            &state.config.python_bin,
        ),
        JobLaunchDeps::new(
            state.db.as_ref(),
            &state.config.data_root,
            &state.config.output_root,
            JobRuntimeLauncher::new(Arc::new(|_| {})),
        ),
    )
}

fn build_test_pdf_bytes() -> Vec<u8> {
    let dir = std::env::temp_dir().join(format!("rust-api-creation-pdf-{}", fastrand::u64(..)));
    std::fs::create_dir_all(&dir).expect("create temp dir");
    let path = dir.join("test.pdf");
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Courier",
    });
    let resources_id = doc.add_object(dictionary! {
        "Font" => dictionary! { "F1" => font_id, },
    });
    let content = Content {
        operations: vec![
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec!["F1".into(), 18.into()]),
            Operation::new("Td", vec![72.into(), 720.into()]),
            Operation::new("Tj", vec![Object::string_literal("Hello")]),
            Operation::new("ET", vec![]),
        ],
    };
    let content_id = doc.add_object(Stream::new(
        dictionary! {},
        content.encode().expect("encode content"),
    ));
    let page_id = doc.add_object(dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "Contents" => content_id,
    });
    let pages = dictionary! {
        "Type" => "Pages",
        "Kids" => vec![Object::Reference(page_id)],
        "Count" => 1,
        "Resources" => resources_id,
        "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
    };
    doc.objects.insert(pages_id, Object::Dictionary(pages));
    let catalog_id = doc.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    doc.trailer.set("Root", catalog_id);
    doc.compress();
    doc.save(&path).expect("save test pdf");
    std::fs::read(path).expect("read test pdf")
}

fn build_pdf_with_bad_xref_bytes() -> Vec<u8> {
    let mut bytes = build_test_pdf_bytes();
    let marker = b"startxref\n";
    let startxref_pos = bytes
        .windows(marker.len())
        .rposition(|window| window == marker)
        .expect("startxref marker");
    let value_start = startxref_pos + marker.len();
    let value_end = value_start
        + bytes[value_start..]
            .iter()
            .position(|byte| *byte == b'\n')
            .expect("startxref newline");
    let original_startxref = std::str::from_utf8(&bytes[value_start..value_end])
        .expect("utf8 startxref")
        .trim()
        .parse::<usize>()
        .expect("parse startxref");
    let replacement = format!(
        "{:0width$}",
        original_startxref.saturating_sub(4),
        width = value_end - value_start
    );
    bytes.splice(value_start..value_end, replacement.bytes());
    if bytes.ends_with(b"%%EOF\n") {
        bytes.truncate(bytes.len() - 2);
    }
    bytes
}

fn base_translation_input(workflow: WorkflowKind) -> CreateJobInput {
    let mut input = CreateJobInput::default();
    input.workflow = workflow;
    input.translation.api_key = "sk-test".to_string();
    input.translation.model = "deepseek-chat".to_string();
    input.translation.base_url = "https://api.deepseek.com/v1".to_string();
    input.ocr.mineru_token = "mineru-token".to_string();
    input
}

fn seed_upload(state: &AppState, upload_id: &str) -> UploadRecord {
    let upload_dir = state.config.uploads_dir.join(upload_id);
    std::fs::create_dir_all(&upload_dir).expect("create upload dir");
    let upload_path = upload_dir.join("input.pdf");
    std::fs::write(&upload_path, build_test_pdf_bytes()).expect("write upload pdf");
    let upload = UploadRecord {
        upload_id: upload_id.to_string(),
        filename: "input.pdf".to_string(),
        stored_path: upload_path.to_string_lossy().to_string(),
        bytes: std::fs::metadata(&upload_path).expect("metadata").len(),
        page_count: 1,
        uploaded_at: now_iso(),
        developer_mode: false,
    };
    state.db.save_upload(&upload).expect("save upload");
    upload
}

fn seed_render_source_job(state: &AppState, job_id: &str) {
    let mut input = base_translation_input(WorkflowKind::Book);
    input.runtime.job_id = job_id.to_string();
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["noop".to_string()]);
    if let Some(artifacts) = job.artifacts.as_mut() {
        artifacts.translations_dir = Some("jobs/source-job/translated".to_string());
        artifacts.source_pdf = Some("jobs/source-job/source/input.pdf".to_string());
    }
    state.db.save_job(&job).expect("save source job");
}

#[test]
fn create_translation_job_rejects_missing_upload_id_for_translate_workflow() {
    let state = test_state("translate-missing-upload");
    let input = base_translation_input(WorkflowKind::Translate);

    let err = create_translation_job(&submit_context(&state), &input)
        .expect_err("missing upload should fail");
    match err {
        AppError::BadRequest(message) => assert_eq!(message, "upload_id is required"),
        other => panic!("unexpected error: {other:?}"),
    }
}

#[test]
fn create_translation_job_rejects_missing_artifact_job_for_render_workflow() {
    let state = test_state("render-missing-artifact");
    let input = base_translation_input(WorkflowKind::Render);

    let err = create_translation_job(&submit_context(&state), &input)
        .expect_err("missing artifact job should fail");
    match err {
        AppError::BadRequest(message) => assert_eq!(
            message,
            "source.artifact_job_id is required for render workflow"
        ),
        other => panic!("unexpected error: {other:?}"),
    }
}

#[tokio::test]
async fn store_pdf_upload_rejects_non_pdf_filename() {
    let state = test_state("store-upload-non-pdf");
    let err = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        0,
        0,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "notes.txt".to_string(),
            bytes: b"not a pdf".to_vec(),
            developer_mode: false,
        },
    )
    .await
    .expect_err("non-pdf filename should fail");
    match err {
        AppError::BadRequest(message) => {
            assert_eq!(message, "uploaded file must be a PDF")
        }
        other => panic!("unexpected error: {other:?}"),
    }
}

#[tokio::test]
async fn store_pdf_upload_repairs_bad_xref_pdf() {
    let state = test_state("store-upload-repair-bad-xref");
    let upload = store_pdf_upload(
        state.db.as_ref(),
        &state.config.uploads_dir,
        0,
        0,
        &state.config.python_bin,
        UploadedPdfInput {
            filename: "bad-xref.pdf".to_string(),
            bytes: build_pdf_with_bad_xref_bytes(),
            developer_mode: false,
        },
    )
    .await
    .expect("bad xref pdf should be repaired");

    assert_eq!(upload.page_count, 1);
    let repaired_doc = Document::load(&upload.stored_path).expect("repaired pdf is valid");
    assert_eq!(repaired_doc.get_pages().len(), 1);
}

#[test]
fn build_translation_job_snapshot_for_full_pipeline_succeeds() {
    let state = test_state("full-pipeline-success");
    let upload = seed_upload(&state, "upload-full");
    let mut input = base_translation_input(WorkflowKind::Book);
    input.source.upload_id = upload.upload_id.clone();

    let job = build_translation_job_snapshot(&snapshot_context(&state), &input)
        .expect("build full pipeline snapshot");

    assert_eq!(job.workflow, WorkflowKind::Book);
    assert!(job.command.iter().any(|arg| arg == "--spec"));
    assert!(job
        .artifacts
        .as_ref()
        .and_then(|a| a.job_root.as_ref())
        .is_some());
}

#[test]
fn build_translation_job_snapshot_for_render_succeeds_with_existing_artifact_job() {
    let state = test_state("render-success");
    seed_render_source_job(&state, "artifact-source-job");
    let mut input = base_translation_input(WorkflowKind::Render);
    input.source.artifact_job_id = "artifact-source-job".to_string();

    let job = build_translation_job_snapshot(&snapshot_context(&state), &input)
        .expect("build render snapshot");

    assert_eq!(job.workflow, WorkflowKind::Render);
    assert_eq!(
        job.command,
        vec!["render-workflow-pending-artifacts".to_string()]
    );
    assert_eq!(job.stage.as_deref(), Some("queued"));
}

#[test]
fn build_ocr_job_snapshot_supports_source_url_without_upload() {
    let state = test_state("ocr-source-url");
    let mut input = base_translation_input(WorkflowKind::Ocr);
    input.source.source_url = "https://example.com/input.pdf".to_string();

    let job = build_ocr_job_snapshot(&snapshot_context(&state), &input, None)
        .expect("build ocr snapshot");

    assert_eq!(job.workflow, WorkflowKind::Ocr);
    assert!(job.command.iter().any(|arg| arg == "--file-url"));
    assert!(job
        .command
        .iter()
        .any(|arg| arg == "https://example.com/input.pdf"));
}
