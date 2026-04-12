use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::models::{
    build_artifact_links, build_job_actions, build_job_links_with_workflow, job_to_detail,
    ArtifactLinksView, JobArtifactManifestView, JobDetailView, JobEventListView, JobSnapshot,
    JobStatusKind, JobSubmissionView, ListJobEventsQuery, WorkflowKind,
};
use crate::services::artifacts::list_registry_for_job;
use crate::services::jobs::{ensure_supported_job_layout, load_job_or_404};
use crate::AppState;
use axum::body::Body;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use tokio_util::io::ReaderStream;

pub fn request_base_url(headers: &HeaderMap, state: &AppState) -> String {
    let scheme = forwarded_header(headers, "x-forwarded-proto")
        .or_else(|| forwarded_header(headers, "x-scheme"))
        .unwrap_or_else(|| "http".to_string());
    let mut host = forwarded_header(headers, "x-forwarded-host")
        .or_else(|| forwarded_header(headers, header::HOST.as_str()))
        .unwrap_or_else(|| format!("127.0.0.1:{}", state.config.port));
    let forwarded_port = forwarded_header(headers, "x-forwarded-port");
    if !host.contains(':') {
        if let Some(port) = forwarded_port.filter(|value| !value.is_empty()) {
            host = format!("{host}:{port}");
        }
    }
    format!("{scheme}://{host}")
}

pub fn build_submission_view(
    job: &JobSnapshot,
    status: JobStatusKind,
    workflow: WorkflowKind,
    base_url: &str,
) -> JobSubmissionView {
    let mut view_job = job.clone();
    view_job.workflow = workflow.clone();
    JobSubmissionView {
        job_id: job.job_id.clone(),
        status,
        workflow: workflow.clone(),
        links: build_job_links_with_workflow(&job.job_id, &workflow, base_url),
        actions: build_job_actions(&view_job, base_url, false, false, false),
    }
}

pub fn build_job_detail_view(
    job: &JobSnapshot,
    base_url: &str,
    data_root: &Path,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> JobDetailView {
    job_to_detail(
        job,
        base_url,
        data_root,
        pdf_ready,
        markdown_ready,
        bundle_ready,
    )
}

pub fn build_artifact_links_view(
    job: &JobSnapshot,
    base_url: &str,
    data_root: &Path,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> ArtifactLinksView {
    build_artifact_links(
        job,
        base_url,
        data_root,
        pdf_ready,
        markdown_ready,
        bundle_ready,
    )
}

pub fn build_artifact_manifest_view(
    state: &AppState,
    job: &JobSnapshot,
    base_url: &str,
) -> Result<JobArtifactManifestView, AppError> {
    let items = list_registry_for_job(state, job)?;
    Ok(crate::models::build_artifact_manifest(
        job, base_url, &items,
    ))
}

pub fn load_job_events_view(
    state: &AppState,
    job_id: &str,
    query: &ListJobEventsQuery,
) -> Result<JobEventListView, AppError> {
    let limit = query.limit.clamp(1, 500);
    let items = state.db.list_job_events(job_id, limit, query.offset)?;
    Ok(JobEventListView {
        items,
        limit,
        offset: query.offset,
    })
}

pub fn load_supported_job(state: &AppState, job_id: &str) -> Result<JobSnapshot, AppError> {
    let job = load_job_or_404(state, job_id)?;
    ensure_supported_job_layout(state, &job)?;
    Ok(job)
}

pub fn load_ocr_job_or_404(state: &AppState, job_id: &str) -> Result<JobSnapshot, AppError> {
    let job = load_job_or_404(state, job_id)?;
    if !matches!(job.workflow, WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    Ok(job)
}

pub fn load_ocr_job_with_supported_layout(
    state: &AppState,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    let job = load_ocr_job_or_404(state, job_id)?;
    ensure_supported_job_layout(state, &job)?;
    Ok(job)
}

pub fn ensure_cancelable(job: &JobSnapshot) -> Result<(), AppError> {
    if !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(AppError::conflict(format!(
            "job is not cancelable in status {:?}",
            job.status
        )));
    }
    Ok(())
}

pub async fn stream_file(
    path: PathBuf,
    content_type: &str,
    download_name: Option<String>,
) -> Result<Response, AppError> {
    if !path.exists() || !path.is_file() {
        return Err(AppError::not_found(format!(
            "file not found: {}",
            path.display()
        )));
    }
    let file = tokio::fs::File::open(&path).await?;
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);
    let mut response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .body(body)
        .map_err(|e| AppError::internal(e.to_string()))?;
    if let Some(name) = download_name {
        let value = format!("attachment; filename=\"{name}\"");
        response.headers_mut().insert(
            header::CONTENT_DISPOSITION,
            HeaderValue::from_str(&value).map_err(|e| AppError::internal(e.to_string()))?,
        );
    }
    Ok(response)
}

fn forwarded_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').next().unwrap_or(v).trim().to_string())
        .filter(|v| !v.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AppConfig;
    use crate::db::Db;
    use crate::models::{CreateJobInput, JobSnapshot};
    use axum::body::to_bytes;
    use std::collections::HashSet;
    use std::sync::Arc;
    use tokio::sync::{Mutex, RwLock, Semaphore};

    fn test_state() -> AppState {
        let root =
            std::env::temp_dir().join(format!("rust-api-job-helpers-{}", std::process::id()));
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

    fn build_job() -> JobSnapshot {
        JobSnapshot::new(
            "job-helpers-test".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        )
    }

    #[test]
    fn request_base_url_prefers_forwarded_headers() {
        let state = test_state();
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("https"));
        headers.insert("x-forwarded-host", HeaderValue::from_static("example.com"));
        headers.insert("x-forwarded-port", HeaderValue::from_static("8443"));

        let base_url = request_base_url(&headers, &state);
        assert_eq!(base_url, "https://example.com:8443");
    }

    #[test]
    fn ensure_cancelable_rejects_succeeded_jobs() {
        let mut job = build_job();
        job.status = JobStatusKind::Succeeded;

        let err = ensure_cancelable(&job).expect_err("should reject succeeded job");
        assert!(err.to_string().contains("not cancelable"));
    }

    #[test]
    fn submission_view_uses_declared_workflow_for_contract_links() {
        let job = build_job();

        let view = build_submission_view(
            &job,
            JobStatusKind::Queued,
            WorkflowKind::Ocr,
            "https://api.example",
        );

        assert_eq!(view.workflow, WorkflowKind::Ocr);
        assert_eq!(view.links.self_path, "/api/v1/ocr/jobs/job-helpers-test");
        assert_eq!(
            view.actions.open_job.path,
            "/api/v1/ocr/jobs/job-helpers-test"
        );
        assert!(view.actions.cancel.enabled);
    }

    #[tokio::test]
    async fn stream_file_sets_content_disposition_when_download_name_provided() {
        let temp_path = std::env::temp_dir().join(format!(
            "job-helpers-stream-{}-{}.txt",
            std::process::id(),
            fastrand::u64(..)
        ));
        tokio::fs::write(&temp_path, b"hello world")
            .await
            .expect("write temp file");

        let response = stream_file(
            temp_path.clone(),
            "text/plain",
            Some("result.txt".to_string()),
        )
        .await
        .expect("stream response");

        let content_type = response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok());
        let content_disposition = response
            .headers()
            .get(header::CONTENT_DISPOSITION)
            .and_then(|value| value.to_str().ok());
        assert_eq!(content_type, Some("text/plain"));
        assert_eq!(
            content_disposition,
            Some("attachment; filename=\"result.txt\"")
        );

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read response body");
        assert_eq!(body.as_ref(), b"hello world");

        let _ = tokio::fs::remove_file(temp_path).await;
    }
}
