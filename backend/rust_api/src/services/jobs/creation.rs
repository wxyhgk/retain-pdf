use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;

use crate::db::Db;
use lopdf::Document;
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;

use crate::error::AppError;
use crate::models::WorkflowKind;
use crate::models::{
    build_job_id, now_iso, CreateJobInput, JobSnapshot, ResolvedJobSpec, UploadRecord,
};
use crate::services::artifacts::build_bundle_for_job;
use crate::services::glossaries::resolve_task_glossary_request;
use crate::services::job_factory::{
    build_job_snapshot, require_upload_path, start_job_execution, JobCommandKind, JobInit,
};
use crate::services::jobs::{
    validate_mineru_upload_limits, validate_ocr_provider_request, validate_provider_credentials,
    wait_for_terminal_job,
};
use crate::config::AppConfig;
use crate::AppState;

#[derive(Debug)]
pub struct UploadedPdfInput {
    pub filename: String,
    pub bytes: Vec<u8>,
    pub developer_mode: bool,
}

#[derive(Debug)]
pub struct BundleArtifact {
    pub job_id: String,
    pub zip_path: PathBuf,
}

struct CreationContext<'a> {
    db: &'a Db,
    config: &'a AppConfig,
}

impl<'a> CreationContext<'a> {
    fn from_state(state: &'a AppState) -> Self {
        Self {
            db: state.db.as_ref(),
            config: state.config.as_ref(),
        }
    }
}

struct BundleBuildContext<'a> {
    creation: CreationContext<'a>,
    downloads_lock: &'a Arc<Mutex<()>>,
}

impl<'a> BundleBuildContext<'a> {
    fn from_state(state: &'a AppState) -> Self {
        Self {
            creation: CreationContext::from_state(state),
            downloads_lock: &state.downloads_lock,
        }
    }
}

fn load_upload_or_404(db: &Db, upload_id: &str) -> Result<UploadRecord, AppError> {
    db.get_upload(upload_id)
        .map_err(|_| AppError::not_found(format!("upload not found: {upload_id}")))
}

pub fn create_translation_job(
    state: &AppState,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    let ctx = CreationContext::from_state(state);
    let job = build_translation_job_snapshot(&ctx, input)?;
    start_job_execution(state, job)
}

fn build_translation_job_snapshot(
    ctx: &CreationContext<'_>,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    match input.workflow {
        WorkflowKind::Ocr => {
            return Err(AppError::bad_request(
                "use /api/v1/ocr/jobs for workflow=ocr",
            ));
        }
        WorkflowKind::Render => return build_render_job_snapshot(ctx, input),
        WorkflowKind::Translate => return build_translate_only_job_snapshot(ctx, input),
        WorkflowKind::Mineru => {}
    }
    build_full_pipeline_job_snapshot(ctx, input)
}

fn build_full_pipeline_job_snapshot(
    ctx: &CreationContext<'_>,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    let input = resolve_task_glossary_request(ctx.db, input)?;
    if input.source.upload_id.trim().is_empty() {
        return Err(AppError::bad_request("upload_id is required"));
    }
    validate_provider_credentials(&input)?;
    let upload = load_upload_or_404(ctx.db, &input.source.upload_id)?;
    validate_mineru_upload_limits(&input, &upload)?;
    let spec = ResolvedJobSpec::from_input(input);
    let upload_path = require_upload_path(&upload)?;
    build_job_snapshot(
        ctx.config,
        spec,
        JobCommandKind::TranslationFromUpload { upload_path },
        JobInit::default(),
    )
}

fn build_translate_only_job_snapshot(
    ctx: &CreationContext<'_>,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    let input = resolve_task_glossary_request(ctx.db, input)?;
    if input.source.upload_id.trim().is_empty() {
        return Err(AppError::bad_request("upload_id is required"));
    }
    validate_provider_credentials(&input)?;
    let upload = load_upload_or_404(ctx.db, &input.source.upload_id)?;
    validate_mineru_upload_limits(&input, &upload)?;
    let mut spec = ResolvedJobSpec::from_input(input);
    spec.workflow = WorkflowKind::Translate;
    build_job_snapshot(
        ctx.config,
        spec,
        JobCommandKind::Deferred {
            label: "translate-workflow-pending-ocr",
        },
        JobInit::translate_default(),
    )
}

fn build_render_job_snapshot(
    ctx: &CreationContext<'_>,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    if input.source.artifact_job_id.trim().is_empty() {
        return Err(AppError::bad_request(
            "source.artifact_job_id is required for render workflow",
        ));
    }
    if ctx.db.get_job(&input.source.artifact_job_id).is_err() {
        return Err(AppError::not_found(format!(
            "artifact job not found: {}",
            input.source.artifact_job_id
        )));
    }
    let mut spec = ResolvedJobSpec::from_input(input.clone());
    spec.workflow = WorkflowKind::Render;
    build_job_snapshot(
        ctx.config,
        spec,
        JobCommandKind::Deferred {
            label: "render-workflow-pending-artifacts",
        },
        JobInit::render_default(),
    )
}

pub fn create_ocr_job(
    state: &AppState,
    input: &CreateJobInput,
    upload: Option<&UploadRecord>,
) -> Result<JobSnapshot, AppError> {
    let ctx = CreationContext::from_state(state);
    let job = build_ocr_job_snapshot(&ctx, input, upload)?;
    start_job_execution(state, job)
}

fn build_ocr_job_snapshot(
    ctx: &CreationContext<'_>,
    input: &CreateJobInput,
    upload: Option<&UploadRecord>,
) -> Result<JobSnapshot, AppError> {
    validate_ocr_provider_request(input)?;
    if upload.is_none() && input.source.source_url.trim().is_empty() {
        return Err(AppError::bad_request(
            "either file or source_url is required",
        ));
    }

    let mut resolved = ResolvedJobSpec::from_input(input.clone());
    resolved.workflow = crate::models::WorkflowKind::Ocr;
    if let Some(upload) = upload {
        resolved.source.upload_id = upload.upload_id.clone();
        validate_mineru_upload_limits(input, upload)?;
    }
    let upload_path = upload.map(require_upload_path).transpose()?;
    build_job_snapshot(
        ctx.config,
        resolved,
        JobCommandKind::Ocr { upload_path },
        JobInit::ocr_default(),
    )
}

pub async fn store_pdf_upload(
    db: &Db,
    uploads_dir: &Path,
    upload_max_bytes: u64,
    upload_max_pages: u32,
    upload: UploadedPdfInput,
) -> Result<UploadRecord, AppError> {
    if !upload.filename.to_lowercase().ends_with(".pdf") {
        return Err(AppError::bad_request("uploaded file must be a PDF"));
    }
    let byte_count = upload.bytes.len() as u64;
    let upload_id = build_job_id();
    let upload_dir = uploads_dir.join(&upload_id);
    tokio::fs::create_dir_all(&upload_dir).await?;
    let upload_path: PathBuf = upload_dir.join(&upload.filename);
    let mut f = tokio::fs::File::create(&upload_path).await?;
    f.write_all(&upload.bytes).await?;
    f.flush().await?;

    let page_count = Document::load(&upload_path)
        .map(|doc| doc.get_pages().len() as u32)
        .map_err(|e| AppError::bad_request(format!("invalid pdf: {e}")))?;

    if upload_max_bytes > 0 && byte_count > upload_max_bytes {
        return Err(AppError::bad_request(format!(
            "当前服务限制：PDF 文件大小必须不超过 {:.2}MB",
            upload_max_bytes as f64 / 1024.0 / 1024.0
        )));
    }
    if upload_max_pages > 0 && page_count > upload_max_pages {
        return Err(AppError::bad_request(format!(
            "当前服务限制：PDF 页数必须不超过 {} 页",
            upload_max_pages
        )));
    }

    let record = UploadRecord {
        upload_id,
        filename: upload.filename,
        stored_path: upload_path.to_string_lossy().to_string(),
        bytes: byte_count,
        page_count,
        uploaded_at: now_iso(),
        developer_mode: upload.developer_mode,
    };
    db.save_upload(&record)?;
    Ok(record)
}

pub async fn create_ocr_job_from_upload(
    state: &AppState,
    input: &CreateJobInput,
    upload: Option<UploadedPdfInput>,
) -> Result<JobSnapshot, AppError> {
    let ctx = CreationContext::from_state(state);
    let stored = match upload {
        Some(upload) => Some(
            store_pdf_upload(
                ctx.db,
                &ctx.config.uploads_dir,
                ctx.config.upload_max_bytes,
                ctx.config.upload_max_pages,
                upload,
            )
            .await?,
        ),
        None => None,
    };
    let job = build_ocr_job_snapshot(&ctx, input, stored.as_ref())?;
    start_job_execution(state, job)
}

pub async fn build_translation_bundle_artifact(
    state: &AppState,
    mut request: CreateJobInput,
    upload: UploadedPdfInput,
) -> Result<BundleArtifact, AppError> {
    let ctx = BundleBuildContext::from_state(state);
    build_translation_bundle_artifact_with_resources(&ctx, state, &mut request, upload).await
}

async fn build_translation_bundle_artifact_with_resources(
    ctx: &BundleBuildContext<'_>,
    state: &AppState,
    request: &mut CreateJobInput,
    upload: UploadedPdfInput,
) -> Result<BundleArtifact, AppError> {
    let stored = store_pdf_upload(
        ctx.creation.db,
        &ctx.creation.config.uploads_dir,
        ctx.creation.config.upload_max_bytes,
        ctx.creation.config.upload_max_pages,
        upload,
    )
    .await?;
    request.source.upload_id = stored.upload_id.clone();
    validate_mineru_upload_limits(request, &stored)?;
    let job = build_translation_job_snapshot(&ctx.creation, request)?;
    let job = start_job_execution(state, job)?;
    let finished_job =
        wait_for_terminal_job(ctx.creation.db, &job.job_id, request.ocr.poll_timeout).await?;

    let _guard = ctx.downloads_lock.lock().await;
    let zip_path = build_bundle_for_job(
        ctx.creation.db,
        &ctx.creation.config.data_root,
        &ctx.creation.config.downloads_dir,
        &finished_job,
    )?;
    Ok(BundleArtifact {
        job_id: finished_job.job_id.clone(),
        zip_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AppConfig;
    use crate::db::Db;
    use crate::models::JobSnapshot;
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Object, Stream};
    use std::collections::HashSet;
    use std::sync::Arc;
    use tokio::sync::{Mutex, RwLock, Semaphore};

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
            run_mineru_case_script: scripts_dir.join("run_mineru_case.py"),
            run_ocr_job_script: scripts_dir.join("run_ocr_job.py"),
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

    fn creation_context<'a>(state: &'a AppState) -> CreationContext<'a> {
        CreationContext::from_state(state)
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
        let mut input = base_translation_input(WorkflowKind::Mineru);
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

        let err = create_translation_job(&state, &input).expect_err("missing upload should fail");
        match err {
            AppError::BadRequest(message) => assert_eq!(message, "upload_id is required"),
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[test]
    fn create_translation_job_rejects_missing_artifact_job_for_render_workflow() {
        let state = test_state("render-missing-artifact");
        let input = base_translation_input(WorkflowKind::Render);

        let err =
            create_translation_job(&state, &input).expect_err("missing artifact job should fail");
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

    #[test]
    fn build_translation_job_snapshot_for_full_pipeline_succeeds() {
        let state = test_state("full-pipeline-success");
        let upload = seed_upload(&state, "upload-full");
        let mut input = base_translation_input(WorkflowKind::Mineru);
        input.source.upload_id = upload.upload_id.clone();

        let job = build_translation_job_snapshot(&creation_context(&state), &input)
            .expect("build full pipeline snapshot");

        assert_eq!(job.workflow, WorkflowKind::Mineru);
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

        let job = build_translation_job_snapshot(&creation_context(&state), &input)
            .expect("build render snapshot");

        assert_eq!(job.workflow, WorkflowKind::Render);
        assert_eq!(job.command, vec!["render-workflow-pending-artifacts".to_string()]);
        assert_eq!(job.stage.as_deref(), Some("queued"));
    }

    #[test]
    fn build_ocr_job_snapshot_supports_source_url_without_upload() {
        let state = test_state("ocr-source-url");
        let mut input = base_translation_input(WorkflowKind::Ocr);
        input.source.source_url = "https://example.com/input.pdf".to_string();

        let job = build_ocr_job_snapshot(&creation_context(&state), &input, None)
            .expect("build ocr snapshot");

        assert_eq!(job.workflow, WorkflowKind::Ocr);
        assert!(job.command.iter().any(|arg| arg == "--file-url"));
        assert!(job.command.iter().any(|arg| arg == "https://example.com/input.pdf"));
    }
}
