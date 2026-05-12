use axum::http::{header, HeaderMap};

use crate::error::AppError;
use crate::models::{
    build_job_actions, build_job_links_with_workflow, JobSnapshot, JobStatusKind,
    JobSubmissionView, WorkflowKind,
};
pub(crate) fn request_base_url(headers: &HeaderMap, default_port: u16) -> String {
    let scheme = forwarded_header(headers, "x-forwarded-proto")
        .or_else(|| forwarded_header(headers, "x-scheme"))
        .unwrap_or_else(|| "http".to_string());
    let host = forwarded_header(headers, "x-forwarded-host")
        .or_else(|| forwarded_header(headers, header::HOST.as_str()))
        .unwrap_or_else(|| format!("127.0.0.1:{default_port}"));
    let forwarded_port = forwarded_header(headers, "x-forwarded-port")
        .filter(|value| !value.is_empty());
    let (hostname, host_port) = split_host_port(&host);
    let candidate_port = host_port.or(forwarded_port);
    let normalized_host = match candidate_port {
        Some(port) if should_omit_port_for_scheme(&scheme, &port) => hostname,
        Some(port) => format!("{hostname}:{port}"),
        None => hostname,
    };
    format!("{scheme}://{normalized_host}")
}

pub(crate) fn build_submission_view(
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

pub(crate) fn ensure_cancelable(job: &JobSnapshot) -> Result<(), AppError> {
    if !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(AppError::conflict(format!(
            "job is not cancelable in status {:?}",
            job.status
        )));
    }
    Ok(())
}

fn forwarded_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').next().unwrap_or(v).trim().to_string())
        .filter(|v| !v.is_empty())
}

fn split_host_port(host: &str) -> (String, Option<String>) {
    let trimmed = host.trim();
    if trimmed.is_empty() {
        return (String::new(), None);
    }
    if trimmed.starts_with('[') {
        return (trimmed.to_string(), None);
    }
    if let Some((name, port)) = trimmed.rsplit_once(':') {
        if !name.is_empty() && !port.is_empty() && port.chars().all(|ch| ch.is_ascii_digit()) {
            return (name.to_string(), Some(port.to_string()));
        }
    }
    (trimmed.to_string(), None)
}

fn should_omit_port_for_scheme(scheme: &str, port: &str) -> bool {
    match scheme {
        "https" => port == "443",
        "http" => port == "80",
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AppConfig;
    use crate::db::Db;
    use crate::models::{CreateJobInput, JobSnapshot};
    use crate::AppState;
    use axum::http::HeaderValue;
    use std::collections::HashSet;
    use std::sync::Arc;
    use tokio::sync::{Mutex, RwLock, Semaphore};

    fn test_state() -> AppState {
        let root =
            std::env::temp_dir().join(format!("rust-api-jobs-support-{}", std::process::id()));
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

    fn build_job() -> JobSnapshot {
        JobSnapshot::new(
            "jobs-support-test".to_string(),
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

        let base_url = request_base_url(&headers, state.config.port);
        assert_eq!(base_url, "https://example.com:8443");
    }

    #[test]
    fn request_base_url_prefers_port_embedded_in_forwarded_host() {
        let state = test_state();
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("http"));
        headers.insert("x-forwarded-host", HeaderValue::from_static("qzlab:40001"));
        headers.insert("x-forwarded-port", HeaderValue::from_static("80"));

        let base_url = request_base_url(&headers, state.config.port);
        assert_eq!(base_url, "http://qzlab:40001");
    }

    #[test]
    fn request_base_url_omits_default_https_port() {
        let state = test_state();
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("https"));
        headers.insert("x-forwarded-host", HeaderValue::from_static("example.com"));
        headers.insert("x-forwarded-port", HeaderValue::from_static("443"));

        let base_url = request_base_url(&headers, state.config.port);
        assert_eq!(base_url, "https://example.com");
    }

    #[test]
    fn request_base_url_omits_default_http_port() {
        let state = test_state();
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("http"));
        headers.insert("x-forwarded-host", HeaderValue::from_static("example.com"));
        headers.insert("x-forwarded-port", HeaderValue::from_static("80"));

        let base_url = request_base_url(&headers, state.config.port);
        assert_eq!(base_url, "http://example.com");
    }

    #[test]
    fn request_base_url_omits_default_port_embedded_in_forwarded_host() {
        let state = test_state();
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("https"));
        headers.insert("x-forwarded-host", HeaderValue::from_static("example.com:443"));

        let base_url = request_base_url(&headers, state.config.port);
        assert_eq!(base_url, "https://example.com");
    }

    #[test]
    fn request_base_url_keeps_non_default_https_port() {
        let state = test_state();
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("https"));
        headers.insert("x-forwarded-host", HeaderValue::from_static("example.com"));
        headers.insert("x-forwarded-port", HeaderValue::from_static("80"));

        let base_url = request_base_url(&headers, state.config.port);
        assert_eq!(base_url, "https://example.com:80");
    }

    #[test]
    fn request_base_url_keeps_non_default_http_port() {
        let state = test_state();
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("http"));
        headers.insert("x-forwarded-host", HeaderValue::from_static("example.com"));
        headers.insert("x-forwarded-port", HeaderValue::from_static("443"));

        let base_url = request_base_url(&headers, state.config.port);
        assert_eq!(base_url, "http://example.com:443");
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
        assert_eq!(view.links.self_path, "/api/v1/ocr/jobs/jobs-support-test");
        assert_eq!(
            view.actions.open_job.path,
            "/api/v1/ocr/jobs/jobs-support-test"
        );
        assert!(view.actions.cancel.enabled);
    }
}
