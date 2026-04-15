use std::path::PathBuf;

use crate::config::AppConfig;
use crate::error::AppError;
use crate::job_events::persist_job;
use crate::job_runner::{build_command, build_ocr_command, spawn_job};
use crate::models::{JobSnapshot, ResolvedJobSpec, UploadRecord};
use crate::storage_paths::{attach_job_paths, build_job_paths};
use crate::AppState;

pub fn build_job_snapshot(
    config: &AppConfig,
    request: ResolvedJobSpec,
    command_kind: JobCommandKind,
    init: JobInit,
) -> Result<JobSnapshot, AppError> {
    let job_id = request.job_id.clone();
    let job_paths = build_job_paths(&config.output_root, &job_id)?;
    let command = match &command_kind {
        JobCommandKind::TranslationFromUpload { upload_path } => {
            build_command(config, upload_path, &request, &job_paths)
        }
        JobCommandKind::Ocr { upload_path } => {
            build_ocr_command(config, upload_path.as_deref(), &request, &job_paths)
        }
        JobCommandKind::Deferred { label } => vec![(*label).to_string()],
    };
    let mut job = JobSnapshot::new(job_id, request, command);
    attach_job_paths(&mut job, &job_paths);
    let job_trace_id = if init.use_ocr_trace_id {
        Some(build_ocr_trace_id(&job.job_id))
    } else {
        init.trace_id.clone()
    };
    if let Some(artifacts) = job.artifacts.as_mut() {
        if let Some(trace_id) = job_trace_id {
            artifacts.trace_id = Some(trace_id);
        }
        if let Some(schema_version) = init.schema_version.as_ref() {
            artifacts.schema_version = Some(schema_version.clone());
        }
    }
    if let Some(stage) = init.stage {
        job.stage = Some(stage.to_string());
    }
    if let Some(stage_detail) = init.stage_detail {
        job.stage_detail = Some(stage_detail.to_string());
    }
    Ok(job)
}

pub fn start_job_execution(state: &AppState, job: JobSnapshot) -> Result<JobSnapshot, AppError> {
    persist_job(state, &job)?;
    spawn_job(state.clone(), job.job_id.clone());
    Ok(job)
}

pub fn build_and_start_job(
    state: &AppState,
    request: ResolvedJobSpec,
    command_kind: JobCommandKind,
    init: JobInit,
) -> Result<JobSnapshot, AppError> {
    let job = build_job_snapshot(state.config.as_ref(), request, command_kind, init)?;
    start_job_execution(state, job)
}

pub fn require_upload_path(upload: &UploadRecord) -> Result<PathBuf, AppError> {
    let upload_path = PathBuf::from(&upload.stored_path);
    if !upload_path.exists() {
        return Err(AppError::not_found(format!(
            "uploaded file missing: {}",
            upload.stored_path
        )));
    }
    Ok(upload_path)
}

fn build_ocr_trace_id(job_id: &str) -> String {
    format!("ocr-{job_id}")
}

pub enum JobCommandKind {
    TranslationFromUpload { upload_path: PathBuf },
    Ocr { upload_path: Option<PathBuf> },
    Deferred { label: &'static str },
}

#[derive(Default)]
pub struct JobInit {
    use_ocr_trace_id: bool,
    trace_id: Option<String>,
    schema_version: Option<String>,
    stage: Option<&'static str>,
    stage_detail: Option<&'static str>,
}

impl JobInit {
    pub fn ocr_default() -> Self {
        Self {
            use_ocr_trace_id: true,
            trace_id: None,
            schema_version: Some("document.v1".to_string()),
            stage: Some("queued"),
            stage_detail: Some("OCR 任务已创建，等待可用执行槽位"),
        }
    }

    pub fn translate_default() -> Self {
        Self {
            use_ocr_trace_id: false,
            trace_id: None,
            schema_version: None,
            stage: Some("queued"),
            stage_detail: Some("翻译任务已创建，等待 OCR 子任务"),
        }
    }

    pub fn render_default() -> Self {
        Self {
            use_ocr_trace_id: false,
            trace_id: None,
            schema_version: None,
            stage: Some("queued"),
            stage_detail: Some("渲染任务已创建，等待可用执行槽位"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AppConfig;
    use crate::db::Db;
    use crate::models::{CreateJobInput, WorkflowKind};
    use std::collections::HashSet;
    use std::sync::Arc;
    use tokio::sync::{Mutex, RwLock, Semaphore};

    fn test_state() -> AppState {
        let root =
            std::env::temp_dir().join(format!("rust-api-job-factory-{}", std::process::id()));
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

    fn build_input(job_id: &str) -> CreateJobInput {
        let mut input = CreateJobInput::default();
        input.runtime.job_id = job_id.to_string();
        input.source.upload_id = "upload-1".to_string();
        input.translation.api_key = "sk-test".to_string();
        input.translation.model = "deepseek-chat".to_string();
        input.translation.base_url = "https://api.deepseek.com/v1".to_string();
        input.ocr.mineru_token = "mineru-token".to_string();
        input
    }

    #[test]
    fn build_job_snapshot_for_ocr_sets_trace_schema_and_stage() {
        let state = test_state();
        let mut input = build_input("job-ocr-test");
        input.workflow = WorkflowKind::Ocr;
        let mut spec = ResolvedJobSpec::from_input(input);
        spec.workflow = WorkflowKind::Ocr;

        let job = build_job_snapshot(
            state.config.as_ref(),
            spec,
            JobCommandKind::Ocr { upload_path: None },
            JobInit::ocr_default(),
        )
        .expect("build ocr job snapshot");

        let artifacts = job.artifacts.as_ref().expect("artifacts");
        assert_eq!(artifacts.trace_id.as_deref(), Some("ocr-job-ocr-test"));
        assert_eq!(artifacts.schema_version.as_deref(), Some("document.v1"));
        assert_eq!(job.stage.as_deref(), Some("queued"));
        assert_eq!(
            job.stage_detail.as_deref(),
            Some("OCR 任务已创建，等待可用执行槽位")
        );
        assert!(job.command.iter().any(|arg| arg == "--job-root"));
    }

    #[test]
    fn build_job_snapshot_for_translation_uses_upload_path_command() {
        let state = test_state();
        let spec = ResolvedJobSpec::from_input(build_input("job-translation-test"));
        let upload_path = state.config.data_root.join("uploads").join("input.pdf");

        let job = build_job_snapshot(
            state.config.as_ref(),
            spec,
            JobCommandKind::TranslationFromUpload {
                upload_path: upload_path.clone(),
            },
            JobInit::default(),
        )
        .expect("build translation job snapshot");

        assert_eq!(job.job_id, "job-translation-test");
        assert!(job.command.iter().any(|arg| arg == "--spec"));
        assert!(job
            .command
            .iter()
            .any(|arg| arg.ends_with("mineru.spec.json")));
        let artifacts = job.artifacts.as_ref().expect("artifacts");
        assert!(artifacts
            .job_root
            .as_deref()
            .is_some_and(|path| path.contains("job-translation-test")));
    }

    #[test]
    fn build_job_snapshot_for_translate_workflow_can_defer_until_ocr_finishes() {
        let state = test_state();
        let mut input = build_input("job-translate-only-test");
        input.workflow = WorkflowKind::Translate;
        let mut spec = ResolvedJobSpec::from_input(input);
        spec.workflow = WorkflowKind::Translate;

        let job = build_job_snapshot(
            state.config.as_ref(),
            spec,
            JobCommandKind::Deferred {
                label: "translate-workflow-pending-ocr",
            },
            JobInit::translate_default(),
        )
        .expect("build translate job snapshot");

        assert_eq!(job.workflow, WorkflowKind::Translate);
        assert_eq!(
            job.command,
            vec!["translate-workflow-pending-ocr".to_string()]
        );
        assert_eq!(job.stage.as_deref(), Some("queued"));
        assert_eq!(
            job.stage_detail.as_deref(),
            Some("翻译任务已创建，等待 OCR 子任务")
        );
    }

    #[test]
    fn build_job_snapshot_for_render_workflow_can_defer_until_artifacts_resolve() {
        let state = test_state();
        let mut input = build_input("job-render-only-test");
        input.workflow = WorkflowKind::Render;
        input.source.artifact_job_id = "job-source".to_string();
        let mut spec = ResolvedJobSpec::from_input(input);
        spec.workflow = WorkflowKind::Render;

        let job = build_job_snapshot(
            state.config.as_ref(),
            spec,
            JobCommandKind::Deferred {
                label: "render-workflow-pending-artifacts",
            },
            JobInit::render_default(),
        )
        .expect("build render job snapshot");

        assert_eq!(job.workflow, WorkflowKind::Render);
        assert_eq!(
            job.command,
            vec!["render-workflow-pending-artifacts".to_string()]
        );
        assert_eq!(job.request_payload.source.artifact_job_id, "job-source");
        assert_eq!(job.stage.as_deref(), Some("queued"));
        assert_eq!(
            job.stage_detail.as_deref(),
            Some("渲染任务已创建，等待可用执行槽位")
        );
    }
}
