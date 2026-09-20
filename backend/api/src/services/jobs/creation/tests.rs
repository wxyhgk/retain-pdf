use std::collections::HashSet;
use std::sync::Arc;

use retain_data::credentials::resolve_credential;
use tokio::sync::{RwLock, Semaphore};

use crate::config::AppConfig;
use crate::db::Db;
use crate::error::AppError;
use crate::models::{now_iso, CreateJobInput, JobSnapshot, UploadRecord, WorkflowKind};
use crate::services::credentials::api::{create_credential, CreateCredentialInput};
use crate::services::job_launcher::JobLaunchDeps;
use crate::services::runtime_gateway::JobRuntimeLauncher;
use crate::AppState;

use super::bundle::create_translation_bundle_job;
use super::job_builders::{build_ocr_job_snapshot, build_translation_job_snapshot};
use super::submit::create_translation_job;
use crate::services::jobs::deps::{JobSubmitDeps, SnapshotBuildDeps};
use crate::services::uploads::UploadedPdfInput;

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
        uploads_dir,
        downloads_dir,
        jobs_db_path: data_root.join("db").join("jobs.db"),
        output_root,
        python_bin: "python".to_string(),
        pipeline_command: "retainpdf-pipeline".to_string(),
        bind_host: "127.0.0.1".to_string(),
        port: 41000,
        simple_port: 41001,
        upload_max_bytes: 0,
        upload_max_pages: 0,
        upload_processing: Default::default(),
        api_keys: HashSet::new(),
        max_running_jobs: 1,
        provider_limits: crate::config::ProviderLimitsConfig::default(),
        provider_runtime: crate::config::ProviderRuntimeConfig::default(),
        job_runner: crate::config::JobRunnerConfig::default(),
        ai_service: crate::config::AiServiceConfig::default(),
        jobs_service: crate::config::JobsServiceConfig::default(),
        asset: crate::config::AssetConfig::default(),
        cleanup: crate::config::CleanupConfig::default(),
        db: crate::config::DbConfig::default(),
        ai_proxy: crate::config::AiProxyConfig::default(),
        reader_llm: crate::config::ReaderLlmConfig::default(),
        rag: crate::config::RagConfig::default(),
    });

    let db = Arc::new(Db::new(
        config.jobs_db_path.clone(),
        config.data_root.clone(),
    ));
    let uploads = Arc::new(crate::services::uploads::UploadService::new(
        db.clone(),
        crate::services::uploads::UploadServiceConfig {
            uploads_dir: config.uploads_dir.clone(),
            python_bin: config.python_bin.clone(),
            upload_max_bytes: config.upload_max_bytes,
            upload_max_pages: config.upload_max_pages,
            processing: config.upload_processing.clone(),
        },
    ));
    AppState {
        ai_gateway: Arc::new(
            crate::services::ai::AiGateway::new(
                &config.ai_proxy,
                config.ai_service.base_url(),
                || 0,
            )
            .unwrap(),
        ),
        model_executor: None,
        config: config.clone(),
        db,
        uploads,
        download_generation: Arc::default(),
        query_execution: Arc::default(),
        canceled_jobs: Arc::new(RwLock::new(HashSet::new())),
        job_slots: Arc::new(Semaphore::new(1)),
        job_drivers: Arc::default(),
        job_runtime: Arc::new(crate::services::runtime_gateway::JobRuntime::in_process(
            Arc::new(RwLock::new(HashSet::new())),
        )),
        agent_capabilities: Arc::new(
            crate::services::agent_capabilities::AgentCapabilityAuthority::new_random()
                .expect("agent capability authority"),
        ),
    }
}

fn snapshot_context<'a>(state: &'a AppState) -> SnapshotBuildDeps<'a> {
    SnapshotBuildDeps::new(state.db.as_ref(), state.config.job_snapshot_runtime())
}

fn submit_context<'a>(state: &'a AppState) -> JobSubmitDeps<'a> {
    JobSubmitDeps::new(
        snapshot_context(state),
        state.uploads.as_ref(),
        JobLaunchDeps::new(
            state.db.as_ref(),
            &state.config.data_root,
            &state.config.output_root,
            JobRuntimeLauncher::new(Arc::new(|_| {})),
        ),
    )
}

use crate::test_support::pdf::build_test_pdf_bytes;

fn base_translation_input(workflow: WorkflowKind) -> CreateJobInput {
    let mut input = CreateJobInput::default();
    input.workflow = workflow;
    input.translation.api_key = "sk-test".to_string();
    input.translation.model = "deepseek-flash".to_string();
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
        content_hash: String::new(),
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

fn seed_ocr_checkpoint_source_job(state: &AppState, job_id: &str) {
    let source_root = state.config.output_root.join("source-job");
    let source_pdf = source_root.join("source/input.pdf");
    let normalized_json = source_root.join("ocr/normalized/document.v1.json");
    let report_json = source_root.join("ocr/normalized/document.v1.report.json");
    let layout_json = source_root.join("ocr/layout.json");
    std::fs::create_dir_all(source_pdf.parent().unwrap()).expect("source dir");
    std::fs::create_dir_all(normalized_json.parent().unwrap()).expect("normalized dir");
    std::fs::write(&source_pdf, build_test_pdf_bytes()).expect("write source pdf");
    std::fs::write(&normalized_json, b"{}").expect("write normalized json");
    std::fs::write(&report_json, b"{}").expect("write report json");
    std::fs::write(&layout_json, b"{}").expect("write layout json");

    let mut input = base_translation_input(WorkflowKind::Ocr);
    input.runtime.job_id = job_id.to_string();
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["noop".to_string()]);
    job.status = crate::models::JobStatusKind::Succeeded;
    if let Some(artifacts) = job.artifacts.as_mut() {
        artifacts.source_pdf = Some(source_pdf.to_string_lossy().to_string());
        artifacts.normalized_document_json = Some(normalized_json.to_string_lossy().to_string());
        artifacts.normalization_report_json = Some(report_json.to_string_lossy().to_string());
        artifacts.layout_json = Some(layout_json.to_string_lossy().to_string());
    }
    state.db.save_job(&job).expect("save source job");
}

fn seed_ocr_checkpoint_source_job_with_missing_files(state: &AppState, job_id: &str) {
    let mut input = base_translation_input(WorkflowKind::Ocr);
    input.runtime.job_id = job_id.to_string();
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["noop".to_string()]);
    job.status = crate::models::JobStatusKind::Succeeded;
    if let Some(artifacts) = job.artifacts.as_mut() {
        artifacts.source_pdf = Some(format!("jobs/{job_id}/source/input.pdf"));
        artifacts.normalized_document_json =
            Some(format!("jobs/{job_id}/ocr/normalized/document.v1.json"));
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
fn create_translation_job_allows_translate_workflow_from_existing_artifact_job() {
    let state = test_state("translate-artifact-source");
    seed_ocr_checkpoint_source_job(&state, "ocr-source-job");
    let mut input = base_translation_input(WorkflowKind::Translate);
    input.source.artifact_job_id = "ocr-source-job".to_string();

    let job = create_translation_job(&submit_context(&state), &input)
        .expect("create translate job from artifact source");

    assert_eq!(job.workflow, WorkflowKind::Translate);
    assert_eq!(job.request_payload.source.artifact_job_id, "ocr-source-job");
    assert_eq!(
        job.command,
        vec!["translate-workflow-pending-ocr".to_string()]
    );
}

#[test]
fn create_translation_job_persists_reference_instead_of_translation_secret() {
    let state = test_state("translate-credential-reference");
    seed_ocr_checkpoint_source_job(&state, "ocr-source-job");
    let secret = "sk-vault-only";
    let created = create_credential(
        &state.config.data_root,
        CreateCredentialInput {
            kind: "translation_api_key".to_string(),
            provider: "deepseek".to_string(),
            label: "test".to_string(),
            secret: secret.to_string(),
            expected_revision: Some(0),
        },
    )
    .expect("create credential");
    let credential_ref = created.credential.credential_ref;
    let mut input = base_translation_input(WorkflowKind::Translate);
    input.source.artifact_job_id = "ocr-source-job".to_string();
    input.translation.api_key.clear();
    input.translation.credential_ref = credential_ref.clone();

    let job = create_translation_job(&submit_context(&state), &input)
        .expect("create translate job with credential reference");

    assert_eq!(
        job.request_payload.translation.credential_ref,
        credential_ref
    );
    assert!(job.request_payload.translation.api_key.is_empty());
    let persisted = state.db.get_job(&job.job_id).expect("persisted job");
    let encoded = serde_json::to_string(&persisted).expect("encode persisted job");
    assert!(!encoded.contains(secret));
}

#[test]
fn create_translation_job_imports_legacy_translation_secret_before_persistence() {
    let state = test_state("translate-import-legacy-translation-secret");
    seed_ocr_checkpoint_source_job(&state, "ocr-source-job-inline-translation");
    let secret = "sk-legacy-translation-vault-only";
    let mut input = base_translation_input(WorkflowKind::Translate);
    input.source.artifact_job_id = "ocr-source-job-inline-translation".to_string();
    input.translation.api_key = secret.to_string();
    input.translation.credential_ref.clear();

    let job = create_translation_job(&submit_context(&state), &input)
        .expect("create translate job with legacy inline credential");

    assert!(job.request_payload.translation.api_key.is_empty());
    let credential_ref = job.request_payload.translation.credential_ref.clone();
    assert!(credential_ref.starts_with("cred_"));
    let resolved = resolve_credential(
        &state.config.data_root,
        &credential_ref,
        "translation_api_key",
    )
    .expect("resolve imported translation credential");
    assert_eq!(resolved.provider, "openai_compatible");
    assert_eq!(resolved.secret, secret);

    let persisted = state
        .db
        .get_job(&job.job_id)
        .expect("persisted translate job");
    let encoded = serde_json::to_string(&persisted).expect("encode persisted job");
    assert!(!encoded.contains(secret));
}

#[test]
fn repeated_legacy_translation_secret_reuses_managed_credential() {
    let state = test_state("translate-reuse-managed-translation-secret");
    seed_ocr_checkpoint_source_job(&state, "ocr-source-job-managed-translation");
    let mut input = base_translation_input(WorkflowKind::Translate);
    input.source.artifact_job_id = "ocr-source-job-managed-translation".to_string();
    input.translation.api_key = "sk-shared-legacy-translation".to_string();

    let first = create_translation_job(&submit_context(&state), &input)
        .expect("create first translated job");
    let second = create_translation_job(&submit_context(&state), &input)
        .expect("create second translated job");

    assert_eq!(
        first.request_payload.translation.credential_ref,
        second.request_payload.translation.credential_ref
    );
    assert!(first.request_payload.translation.api_key.is_empty());
    assert!(second.request_payload.translation.api_key.is_empty());
}

#[test]
fn create_book_job_imports_legacy_ocr_secret_before_persistence() {
    let state = test_state("book-import-legacy-ocr-secret");
    seed_upload(&state, "upload-book-legacy-ocr-secret");
    let secret = "legacy-mineru-vault-only";
    let mut input = base_translation_input(WorkflowKind::Book);
    input.source.upload_id = "upload-book-legacy-ocr-secret".to_string();
    input.ocr.provider = "mineru".to_string();
    input.ocr.mineru_token = secret.to_string();

    let job = create_translation_job(&submit_context(&state), &input)
        .expect("create book job with legacy OCR credential");

    assert!(job.request_payload.ocr.mineru_token.is_empty());
    assert!(job.request_payload.ocr.paddle_token.is_empty());
    let credential_ref = job.request_payload.ocr.credential_ref.clone();
    assert!(credential_ref.starts_with("cred_"));
    let resolved = resolve_credential(
        &state.config.data_root,
        &credential_ref,
        "ocr_provider_token",
    )
    .expect("resolve imported OCR credential");
    assert_eq!(resolved.provider, "mineru");
    assert_eq!(resolved.secret, secret);

    let persisted = state.db.get_job(&job.job_id).expect("persisted book job");
    let encoded = serde_json::to_string(&persisted).expect("encode persisted job");
    assert!(!encoded.contains(secret));
}

#[test]
fn artifact_reuse_discards_unused_ocr_secret() {
    let state = test_state("artifact-reuse-discards-ocr-secret");
    seed_ocr_checkpoint_source_job(&state, "ocr-source-with-artifacts");
    let mut input = base_translation_input(WorkflowKind::Translate);
    input.source.artifact_job_id = "ocr-source-with-artifacts".to_string();
    input.ocr.mineru_token = "unused-legacy-ocr-secret".to_string();

    let job = create_translation_job(&submit_context(&state), &input)
        .expect("create translation job that reuses OCR artifacts");

    assert!(job.request_payload.ocr.credential_ref.is_empty());
    assert!(job.request_payload.ocr.mineru_token.is_empty());
    assert!(job.request_payload.ocr.paddle_token.is_empty());
    let persisted = state.db.get_job(&job.job_id).expect("persisted reuse job");
    let encoded = serde_json::to_string(&persisted).expect("encode persisted job");
    assert!(!encoded.contains("unused-legacy-ocr-secret"));
}

#[test]
fn render_job_discards_all_unused_provider_credentials_before_persistence() {
    let state = test_state("render-discards-provider-credentials");
    seed_render_source_job(&state, "render-source-with-artifacts");
    let mut input = base_translation_input(WorkflowKind::Render);
    input.source.artifact_job_id = "render-source-with-artifacts".to_string();
    input.translation.api_key = "unused-render-translation-secret".to_string();
    input.translation.credential_ref = "cred_invalid_but_unused".to_string();
    input.ocr.credential_ref = "cred_invalid_ocr_but_unused".to_string();
    input.ocr.mineru_token = "unused-render-ocr-secret".to_string();

    let job = create_translation_job(&submit_context(&state), &input)
        .expect("create render job without resolving unused credentials");

    assert!(job.request_payload.translation.api_key.is_empty());
    assert!(job.request_payload.translation.credential_ref.is_empty());
    assert!(job.request_payload.ocr.credential_ref.is_empty());
    assert!(job.request_payload.ocr.mineru_token.is_empty());
    let persisted = state.db.get_job(&job.job_id).expect("persisted render job");
    let encoded = serde_json::to_string(&persisted).expect("encode persisted render job");
    assert!(!encoded.contains("unused-render-translation-secret"));
    assert!(!encoded.contains("unused-render-ocr-secret"));
}

#[test]
fn create_translation_job_rejects_paddle_cli_artifact_source() {
    let state = test_state("translate-paddle-cli-artifact-source");
    seed_ocr_checkpoint_source_job(&state, "paddle-cli-source-job");
    let mut source_job = state
        .db
        .get_job("paddle-cli-source-job")
        .expect("load source job");
    source_job.request_payload.ocr.provider = "paddle".to_string();
    source_job.request_payload.ocr.options.insert(
        "transport".to_string(),
        serde_json::Value::String("official_cli".to_string()),
    );
    state.db.save_job(&source_job).expect("save CLI source job");

    let mut input = base_translation_input(WorkflowKind::Translate);
    input.source.artifact_job_id = "paddle-cli-source-job".to_string();
    let err = create_translation_job(&submit_context(&state), &input)
        .expect_err("CLI OCR artifact must not feed translation/render");

    match err {
        AppError::OcrArtifactReuse { code, reason, .. } => {
            assert_eq!(code, "OCR_ARTIFACT_NOT_REUSABLE");
            assert_eq!(reason, "unsupported_provider_artifact");
        }
        other => panic!("unexpected error: {other:?}"),
    }
}

#[test]
fn build_render_job_rejects_paddle_cli_artifact_source() {
    let state = test_state("render-paddle-cli-artifact-source");
    seed_ocr_checkpoint_source_job(&state, "paddle-cli-render-source");
    let mut source_job = state
        .db
        .get_job("paddle-cli-render-source")
        .expect("load source job");
    source_job.request_payload.ocr.provider = "paddle".to_string();
    source_job.request_payload.ocr.options.insert(
        "transport".to_string(),
        serde_json::Value::String("official_cli".to_string()),
    );
    state.db.save_job(&source_job).expect("save CLI source job");

    let mut input = base_translation_input(WorkflowKind::Render);
    input.source.artifact_job_id = "paddle-cli-render-source".to_string();
    let err = build_translation_job_snapshot(&snapshot_context(&state), &input)
        .expect_err("CLI OCR artifact must not feed render");

    match err {
        AppError::BadRequest(message) => {
            assert!(message.contains("PaddleOCR official_cli"));
            assert!(message.contains("bbox/prunedResult"));
        }
        other => panic!("unexpected error: {other:?}"),
    }
}

#[test]
fn create_translation_job_rejects_artifact_job_with_missing_ocr_files() {
    let state = test_state("translate-artifact-source-missing-files");
    seed_ocr_checkpoint_source_job_with_missing_files(&state, "missing-ocr-source-job");
    let mut input = base_translation_input(WorkflowKind::Translate);
    input.source.artifact_job_id = "missing-ocr-source-job".to_string();

    let err = create_translation_job(&submit_context(&state), &input)
        .expect_err("missing OCR files should fail before launch");
    match err {
        AppError::OcrArtifactReuse { code, reason, .. } => {
            assert_eq!(code, "OCR_ARTIFACT_MISSING");
            assert_eq!(reason, "missing_normalized_document_json");
        }
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
async fn create_translation_bundle_job_returns_queued_job_without_waiting() {
    let state = test_state("bundle-job-async");
    let mut input = base_translation_input(WorkflowKind::Book);
    input.ocr.poll_timeout = 1;

    let job = create_translation_bundle_job(
        &crate::services::jobs::deps::BundleBuildDeps {
            submit: submit_context(&state),
        },
        input,
        UploadedPdfInput {
            filename: "input.pdf".to_string(),
            bytes: build_test_pdf_bytes(),
            developer_mode: false,
        },
    )
    .await
    .expect("bundle endpoint should create async job");

    assert_eq!(job.workflow, WorkflowKind::Book);
    assert_eq!(job.status, crate::models::JobStatusKind::Queued);
    assert!(job.finished_at.is_none());
    assert!(state
        .db
        .get_job(&job.job_id)
        .expect("persisted job")
        .finished_at
        .is_none());
    assert!(!state
        .config
        .downloads_dir
        .join(format!("{}.zip", job.job_id))
        .exists());
}

#[tokio::test]
async fn bundle_job_failure_preserves_published_upload() {
    let state = test_state("bundle-failure-preserves-upload");
    let bytes = build_test_pdf_bytes();
    let hash = crate::db::documents::sha256_hex(&bytes);
    let error = create_translation_bundle_job(
        &crate::services::jobs::deps::BundleBuildDeps {
            submit: submit_context(&state),
        },
        base_translation_input(WorkflowKind::Ocr),
        UploadedPdfInput {
            filename: "published.pdf".into(),
            bytes,
            developer_mode: false,
        },
    )
    .await
    .expect_err("bundle rejects OCR workflow after publication");
    assert_eq!(error.to_string(), "use /api/v1/ocr/jobs for workflow=ocr");
    let entries = std::fs::read_dir(&state.config.uploads_dir)
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(entries.len(), 1);
    let upload_id = entries[0].file_name().into_string().unwrap();
    let record = state
        .db
        .get_upload(&upload_id)
        .expect("published upload survives");
    assert_eq!(record.content_hash, hash);
    assert!(std::path::Path::new(&record.stored_path).is_file());
    assert!(state.db.get_document(&hash).is_ok());
    assert!(state.db.list_jobs(10, 0, None, None).unwrap().is_empty());
    assert_eq!(
        std::fs::read_dir(&state.config.output_root)
            .unwrap()
            .count(),
        0
    );
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
    assert_eq!(
        job.command,
        vec!["book-workflow-rust-orchestrated".to_string()]
    );
    assert_eq!(job.stage.as_deref(), Some("queued"));
    let render_config_path = job
        .artifacts
        .as_ref()
        .and_then(|a| a.render_config_json.as_ref())
        .expect("render config path");
    let render_config: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(render_config_path).expect("read render config"),
    )
    .expect("parse render config");
    assert_eq!(render_config["schema_version"], "render_config.v1");
    assert_eq!(render_config["source"], "rust_api_resolved_job_spec");
    // 这个用例不显式给 render_mode,断言的就是默认值。曾经是 "typst",
    // 和 RENDER_OPTIONS_CONTRACT.md 写的 auto 对不上 —— 也就是说这条断言
    // 把那个漂移固化住了。
    assert_eq!(render_config["render"]["render_mode"], "auto");
    assert_eq!(
        render_config["render"]["source_cleanup_strategy"],
        "pikepdf_text_strip"
    );
}

#[test]
fn build_translation_job_snapshot_for_book_succeeds_with_existing_ocr_artifact_job() {
    let state = test_state("book-artifact-source");
    seed_ocr_checkpoint_source_job(&state, "ocr-source-job");
    let mut input = base_translation_input(WorkflowKind::Book);
    input.source.artifact_job_id = "ocr-source-job".to_string();
    input.ocr.mineru_token = String::new();

    let job = build_translation_job_snapshot(&snapshot_context(&state), &input)
        .expect("build book snapshot from artifact source");

    assert_eq!(job.workflow, WorkflowKind::Book);
    assert_eq!(job.request_payload.source.artifact_job_id, "ocr-source-job");
    assert_eq!(
        job.command,
        vec!["book-workflow-pending-artifacts".to_string()]
    );
    assert_eq!(job.stage.as_deref(), Some("queued"));
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
fn non_positive_timeout_is_rejected_on_every_creation_path() {
    // `timeout_seconds` 的校验原先只写在 `validate_ocr_provider_request` 里，
    // 而那个函数只被 OCR-only 的 prepare 调用。full pipeline / translate-only /
    // render-only 三条路径从不校验，multipart 的 parse_i64_like 也没有范围检查。
    //
    // 后果不是"参数不合法"这么轻：runner 的
    // job_runner/process_runner/execution.rs 是 `if timeout_secs > 0 { timeout(..) }
    // else { child.wait().await? }`——0 会落进 else，走**完全没有超时**的裸等待，
    // 进程可以永远挂着，没有任何机制把它收掉。
    //
    // 所以四条路径都必须拒绝，缺一条就等于那条路径上的超时保护不存在。
    let state = test_state("runtime-timeout-guard");

    for workflow in [
        WorkflowKind::Book,
        WorkflowKind::Translate,
        WorkflowKind::Render,
    ] {
        for timeout_seconds in [0, -1] {
            let mut input = base_translation_input(workflow.clone());
            input.runtime.timeout_seconds = timeout_seconds;
            let error = build_translation_job_snapshot(&snapshot_context(&state), &input)
                .expect_err(&format!(
                    "workflow={workflow:?} timeout_seconds={timeout_seconds} 必须被拒绝"
                ));
            assert!(
                format!("{error:?}").contains("timeout_seconds"),
                "workflow={workflow:?} 的报错应指明 timeout_seconds，实际: {error:?}"
            );
        }
    }

    for timeout_seconds in [0, -1] {
        let mut input = base_translation_input(WorkflowKind::Ocr);
        input.source.source_url = "https://example.com/input.pdf".to_string();
        input.runtime.timeout_seconds = timeout_seconds;
        let error = build_ocr_job_snapshot(&snapshot_context(&state), &input, None).expect_err(
            &format!("workflow=Ocr timeout_seconds={timeout_seconds} 必须被拒绝"),
        );
        assert!(
            format!("{error:?}").contains("timeout_seconds"),
            "OCR 路径的报错应指明 timeout_seconds，实际: {error:?}"
        );
    }

    // 正数仍然放行（回归保护：新校验不得误伤正常提交）。
    // 用 OCR 路径做这条，因为它接受 source_url、不需要预先 seed upload。
    let mut ok_input = base_translation_input(WorkflowKind::Ocr);
    ok_input.source.source_url = "https://example.com/input.pdf".to_string();
    ok_input.runtime.timeout_seconds = 1;
    build_ocr_job_snapshot(&snapshot_context(&state), &ok_input, None)
        .expect("正数 timeout_seconds 必须放行");
}

#[test]
fn negative_no_output_timeout_is_rejected_but_zero_means_disabled() {
    // `no_output_timeout_seconds` 与 `timeout_seconds` 的合法域不同:0 是
    // "关闭空闲检测",是默认值也是绝大多数提交的取值,必须放行。负数则没有
    // 任何解释,只可能是调用方算错了(例如拿两个时间戳相减写反了顺序),
    // 放过去会让空闲检测静默失效——`no_output_secs > 0` 的判断直接跳过它。
    let state = test_state("no-output-timeout-guard");

    for workflow in [
        WorkflowKind::Book,
        WorkflowKind::Translate,
        WorkflowKind::Render,
    ] {
        let mut input = base_translation_input(workflow.clone());
        input.runtime.no_output_timeout_seconds = -1;
        let error = build_translation_job_snapshot(&snapshot_context(&state), &input).expect_err(
            &format!("workflow={workflow:?} 的负数 no_output_timeout_seconds 必须被拒绝"),
        );
        assert!(
            format!("{error:?}").contains("no_output_timeout_seconds"),
            "workflow={workflow:?} 的报错应指明 no_output_timeout_seconds，实际: {error:?}"
        );
    }

    let mut ocr_input = base_translation_input(WorkflowKind::Ocr);
    ocr_input.source.source_url = "https://example.com/input.pdf".to_string();
    ocr_input.runtime.no_output_timeout_seconds = -1;
    let error = build_ocr_job_snapshot(&snapshot_context(&state), &ocr_input, None)
        .expect_err("OCR 路径的负数 no_output_timeout_seconds 必须被拒绝");
    assert!(
        format!("{error:?}").contains("no_output_timeout_seconds"),
        "OCR 路径的报错应指明 no_output_timeout_seconds，实际: {error:?}"
    );

    // 0(关闭)与正数都必须放行。
    for value in [0, 30] {
        let mut ok_input = base_translation_input(WorkflowKind::Ocr);
        ok_input.source.source_url = "https://example.com/input.pdf".to_string();
        ok_input.runtime.no_output_timeout_seconds = value;
        build_ocr_job_snapshot(&snapshot_context(&state), &ok_input, None).unwrap_or_else(
            |error| panic!("no_output_timeout_seconds={value} 必须放行: {error:?}"),
        );
    }
}

#[test]
fn build_ocr_job_snapshot_supports_source_url_without_upload() {
    let state = test_state("ocr-source-url");
    let mut input = base_translation_input(WorkflowKind::Ocr);
    input.source.source_url = "https://example.com/input.pdf".to_string();

    let job = build_ocr_job_snapshot(&snapshot_context(&state), &input, None)
        .expect("build ocr snapshot");

    assert_eq!(job.workflow, WorkflowKind::Ocr);
    assert_eq!(job.command, vec!["ocr-workflow-pending-provider"]);
    assert_eq!(
        job.request_payload.source.source_url,
        "https://example.com/input.pdf"
    );
}

#[test]
fn build_ocr_job_snapshot_supports_upload_id_without_file() {
    let state = test_state("ocr-upload-id");
    let upload = seed_upload(&state, "upload-ocr-id");
    let mut input = base_translation_input(WorkflowKind::Ocr);
    input.source.upload_id = upload.upload_id.clone();
    // 前端仅 OCR 时通过 upload_id 复用已上传文件，后端应吸怪：无需 file 字节也能建任务
    let job = build_ocr_job_snapshot(&snapshot_context(&state), &input, None)
        .expect("build ocr snapshot from upload_id");

    assert_eq!(job.workflow, WorkflowKind::Ocr);
    assert_eq!(job.request_payload.source.upload_id, upload.upload_id);
    assert_eq!(job.command, vec!["ocr-workflow-pending-provider"]);
}

#[test]
fn build_ocr_job_snapshot_rejects_missing_file_and_source() {
    let state = test_state("ocr-missing-source");
    let input = base_translation_input(WorkflowKind::Ocr);

    let err = build_ocr_job_snapshot(&snapshot_context(&state), &input, None)
        .expect_err("missing file/upload_id/source_url should fail");
    match err {
        AppError::BadRequest(msg) => assert!(
            msg.contains("either file, upload_id, or source_url is required"),
            "unexpected message: {msg}"
        ),
        other => panic!("unexpected error: {other:?}"),
    }
}
