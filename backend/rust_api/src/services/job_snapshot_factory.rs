use std::path::{Path, PathBuf};

use crate::config::JobSnapshotRuntimeConfig;
use crate::error::AppError;
use crate::models::{JobSnapshot, ResolvedJobSpec, UploadRecord};
use crate::ocr_provider::{ensure_provider_diagnostics, parse_provider_kind};
use crate::storage_paths::{attach_job_paths, build_job_paths};
use crate::worker_command::build_ocr_command;

pub fn build_job_snapshot(
    config: &JobSnapshotRuntimeConfig<'_>,
    request: ResolvedJobSpec,
    command_kind: JobCommandKind,
    init: JobInit,
) -> Result<JobSnapshot, AppError> {
    let job_id = request.job_id.clone();
    let provider_kind = parse_provider_kind(&request.ocr.provider);
    let job_paths = build_job_paths(config.output_root, &job_id)?;
    let command = command_kind.build(config, &request, &job_paths);
    let mut job = JobSnapshot::new(job_id, request, command);
    if let Some(artifacts) = job.artifacts.as_mut() {
        let _ = ensure_provider_diagnostics(artifacts, provider_kind);
    }
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
    write_render_config_snapshot(&mut job, &job_paths)?;
    if let Some(stage) = init.stage {
        job.stage = Some(stage.to_string());
    }
    if let Some(stage_detail) = init.stage_detail {
        job.stage_detail = Some(stage_detail.to_string());
    }
    Ok(job)
}

fn write_render_config_snapshot(
    job: &mut JobSnapshot,
    job_paths: &crate::storage_paths::JobPaths,
) -> Result<(), AppError> {
    let path = job_paths.artifacts_dir.join("render_config.json");
    let payload = serde_json::json!({
        "schema_version": "render_config.v1",
        "source": "rust_api_resolved_job_spec",
        "job_id": job.job_id,
        "workflow": job.workflow,
        "render": job.request_payload.render,
    });
    write_json_pretty(&path, &payload)?;
    if let Some(artifacts) = job.artifacts.as_mut() {
        artifacts.render_config_json = Some(path.to_string_lossy().to_string());
    }
    Ok(())
}

fn write_json_pretty(path: &Path, payload: &serde_json::Value) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| {
            AppError::internal(format!(
                "create render config parent dir failed: {}: {err}",
                parent.display()
            ))
        })?;
    }
    let content = serde_json::to_string_pretty(payload)
        .map_err(|err| AppError::internal(format!("serialize render config failed: {err}")))?;
    std::fs::write(path, content).map_err(|err| {
        AppError::internal(format!(
            "write render config failed: {}: {err}",
            path.display()
        ))
    })
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
    Ocr { upload_path: Option<PathBuf> },
    Deferred { label: &'static str },
}

impl JobCommandKind {
    fn build(
        &self,
        config: &JobSnapshotRuntimeConfig<'_>,
        request: &ResolvedJobSpec,
        job_paths: &crate::storage_paths::JobPaths,
    ) -> Vec<String> {
        match self {
            JobCommandKind::Ocr { upload_path } => build_ocr_command(
                &config.worker_command,
                upload_path.as_deref(),
                request,
                job_paths,
            ),
            JobCommandKind::Deferred { label } => vec![(*label).to_string()],
        }
    }
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

    pub fn book_default() -> Self {
        Self {
            use_ocr_trace_id: false,
            trace_id: None,
            schema_version: None,
            stage: Some("queued"),
            stage_detail: Some("全流程任务已创建，等待 Rust 编排 OCR/翻译/渲染阶段"),
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
