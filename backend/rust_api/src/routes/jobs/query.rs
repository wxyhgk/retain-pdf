use crate::error::AppError;
use crate::models::{
    ApiResponse, ArtifactLinksView, JobArtifactManifestView, JobDetailView, JobEventListView,
    JobListView, ListJobEventsQuery, ListJobsQuery,
};
use crate::AppState;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::HeaderMap;
use axum::Json;

use super::common::build_jobs_route_deps;
use super::query_adapter::{
    job_artifact_manifest_response, job_artifacts_response, job_detail_response,
    job_events_response, list_jobs_response, rerun_job_response,
};

pub async fn list_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ListJobsQuery>,
) -> Result<Json<ApiResponse<JobListView>>, AppError> {
    list_jobs_response(build_jobs_route_deps(&state), &headers, &query)
}

pub async fn list_ocr_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(mut query): Query<ListJobsQuery>,
) -> Result<Json<ApiResponse<JobListView>>, AppError> {
    query.workflow = Some(crate::models::WorkflowKind::Ocr);
    list_jobs(State(state), headers, Query(query)).await
}

pub async fn get_ocr_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    job_detail_response(build_jobs_route_deps(&state), &headers, &job_id, true)
}

pub async fn get_ocr_job_events(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    Query(query): Query<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    job_events_response(build_jobs_route_deps(&state), &job_id, &query, true)
}

pub async fn get_ocr_job_artifacts(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    job_artifacts_response(build_jobs_route_deps(&state), &headers, &job_id, true)
}

pub async fn get_ocr_job_artifacts_manifest(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobArtifactManifestView>>, AppError> {
    job_artifact_manifest_response(build_jobs_route_deps(&state), &headers, &job_id, true)
}

pub async fn get_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    job_detail_response(build_jobs_route_deps(&state), &headers, &job_id, false)
}

pub async fn get_job_events(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    Query(query): Query<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    job_events_response(build_jobs_route_deps(&state), &job_id, &query, false)
}

pub async fn rerun_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<crate::models::JobSubmissionView>>, AppError> {
    rerun_job_response(build_jobs_route_deps(&state), &headers, &job_id)
}

pub async fn get_job_artifacts(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    job_artifacts_response(build_jobs_route_deps(&state), &headers, &job_id, false)
}

pub async fn get_job_artifacts_manifest(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobArtifactManifestView>>, AppError> {
    job_artifact_manifest_response(build_jobs_route_deps(&state), &headers, &job_id, false)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::Arc;

    use axum::body::{to_bytes, Body};
    use axum::http::{Request, StatusCode};
    use serde_json::json;
    use tower::util::ServiceExt;

    use crate::app::{build_app, build_state};
    use crate::config::AppConfig;
    use crate::models::{CreateJobInput, JobArtifacts, JobFailureInfo, JobSnapshot, JobStatusKind};

    fn test_state(test_name: &str) -> crate::AppState {
        let root = std::env::temp_dir().join(format!(
            "rust-api-query-routes-{test_name}-{}",
            fastrand::u64(..)
        ));
        let data_root = root.join("data");
        let output_root = data_root.join("jobs");
        let downloads_dir = data_root.join("downloads");
        let uploads_dir = data_root.join("uploads");
        let rust_api_root = root.join("rust_api");
        let scripts_dir = root.join("scripts");
        fs::create_dir_all(&output_root).expect("create output root");
        fs::create_dir_all(&downloads_dir).expect("create downloads dir");
        fs::create_dir_all(&uploads_dir).expect("create uploads dir");
        fs::create_dir_all(&rust_api_root).expect("create rust_api root");
        fs::create_dir_all(&scripts_dir).expect("create scripts dir");

        build_state(Arc::new(AppConfig {
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
            python_bin: "python3".to_string(),
            bind_host: "127.0.0.1".to_string(),
            port: 41000,
            simple_port: 42000,
            upload_max_bytes: 0,
            upload_max_pages: 0,
            api_keys: HashSet::from(["test-key".to_string()]),
            max_running_jobs: 1,
        }))
        .expect("build state")
    }

    async fn read_json(response: axum::response::Response) -> serde_json::Value {
        serde_json::from_slice(
            &to_bytes(response.into_body(), usize::MAX)
                .await
                .expect("read body"),
        )
        .expect("parse json")
    }

    fn source_job_with_artifacts(job_id: &str, artifacts: JobArtifacts) -> JobSnapshot {
        let mut input = CreateJobInput::default();
        input.runtime.job_id = job_id.to_string();
        input.translation.api_key = "sk-rerun-test".to_string();
        input.translation.model = "deepseek-v4-flash".to_string();
        input.translation.base_url = "https://api.deepseek.com/v1".to_string();
        let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()]);
        job.artifacts = Some(artifacts);
        job
    }

    #[tokio::test]
    async fn rerun_route_prefers_render_when_translations_are_available() {
        let state = test_state("rerun-render");
        let source_job = source_job_with_artifacts(
            "job-rerun-render-source",
            JobArtifacts {
                source_pdf: Some("jobs/source/source/input.pdf".to_string()),
                normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
                translations_dir: Some("jobs/source/translated".to_string()),
                ..JobArtifacts::default()
            },
        );
        state.db.save_job(&source_job).expect("save source job");

        let response = build_app(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/jobs/job-rerun-render-source/rerun")
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("rerun request"),
            )
            .await
            .expect("rerun response");

        assert_eq!(response.status(), StatusCode::OK);
        let payload = read_json(response).await;
        assert_eq!(payload["data"]["workflow"], "render");
        let rerun_job_id = payload["data"]["job_id"].as_str().expect("job id");
        let rerun_job = state.db.get_job(rerun_job_id).expect("rerun job");
        assert_eq!(rerun_job.workflow, crate::models::WorkflowKind::Render);
        assert_eq!(
            rerun_job.request_payload.source.artifact_job_id,
            "job-rerun-render-source"
        );
        assert!(rerun_job.request_payload.runtime.job_id.is_empty());
    }

    #[tokio::test]
    async fn rerun_route_uses_book_when_only_ocr_checkpoint_is_available() {
        let state = test_state("rerun-book");
        let source_job = source_job_with_artifacts(
            "job-rerun-book-source",
            JobArtifacts {
                source_pdf: Some("jobs/source/source/input.pdf".to_string()),
                normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
                ..JobArtifacts::default()
            },
        );
        state.db.save_job(&source_job).expect("save source job");

        let response = build_app(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/jobs/job-rerun-book-source/rerun")
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("rerun request"),
            )
            .await
            .expect("rerun response");

        assert_eq!(response.status(), StatusCode::OK);
        let payload = read_json(response).await;
        assert_eq!(payload["data"]["workflow"], "book");
        let rerun_job_id = payload["data"]["job_id"].as_str().expect("job id");
        let rerun_job = state.db.get_job(rerun_job_id).expect("rerun job");
        assert_eq!(rerun_job.workflow, crate::models::WorkflowKind::Book);
        assert_eq!(
            rerun_job.request_payload.source.artifact_job_id,
            "job-rerun-book-source"
        );
    }

    #[tokio::test]
    async fn job_detail_and_events_routes_redact_secrets() {
        let state = test_state("detail-events-redaction");
        let mut input = CreateJobInput::default();
        input.translation.api_key = "sk-route-secret".to_string();
        input.ocr.mineru_token = "mineru-route-secret".to_string();
        let mut job = JobSnapshot::new(
            "job-route-redaction".to_string(),
            input,
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Failed;
        job.error = Some("upstream said sk-route-secret".to_string());
        job.log_tail = vec!["mineru-route-secret appeared in log".to_string()];
        state.db.save_job(&job).expect("save job");
        state
            .db
            .append_event(
                &job.job_id,
                "error",
                Some("failed".to_string()),
                Some("failure classified".to_string()),
                Some("mineru".to_string()),
                Some("provider_failed".to_string()),
                "failure_classified",
                Some("failure_classified".to_string()),
                "message contains sk-route-secret",
                Some(1),
                Some(2),
                Some(json!({
                    "api_key": "sk-route-secret",
                    "note": "mineru-route-secret in payload"
                })),
                Some(0),
                Some(1234),
            )
            .expect("append event");

        let app = build_app(state.clone());

        let detail_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/jobs/{}", job.job_id))
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("detail request"),
            )
            .await
            .expect("detail response");
        assert_eq!(detail_response.status(), StatusCode::OK);
        let detail_json = read_json(detail_response).await;
        assert_eq!(
            detail_json["data"]["request_payload"]["translation"]["api_key"],
            ""
        );
        assert_eq!(
            detail_json["data"]["request_payload"]["ocr"]["mineru_token"],
            ""
        );
        assert_eq!(detail_json["data"]["error"], "upstream said [REDACTED]");
        assert_eq!(
            detail_json["data"]["log_tail"][0],
            "[REDACTED] appeared in log"
        );

        let events_response = app
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/jobs/{}/events", job.job_id))
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("events request"),
            )
            .await
            .expect("events response");
        assert_eq!(events_response.status(), StatusCode::OK);
        let events_json = read_json(events_response).await;
        assert_eq!(
            events_json["data"]["items"][0]["message"],
            "message contains [REDACTED]"
        );
        assert_eq!(
            events_json["data"]["items"][0]["event_type"],
            "failure_classified"
        );
        assert_eq!(events_json["data"]["items"][0]["provider"], "mineru");
        assert_eq!(
            events_json["data"]["items"][0]["provider_stage"],
            "provider_failed"
        );
        assert_eq!(
            events_json["data"]["items"][0]["stage_detail"],
            "failure classified"
        );
        assert_eq!(events_json["data"]["items"][0]["payload"]["api_key"], "");
        assert_eq!(
            events_json["data"]["items"][0]["payload"]["note"],
            "[REDACTED] in payload"
        );
    }

    #[tokio::test]
    async fn job_detail_route_prefers_formal_failure_fields() {
        let state = test_state("detail-formal-failure");
        let mut job = JobSnapshot::new(
            "job-route-formal-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Failed;
        job.failure = Some(crate::models::JobFailureInfo {
            stage: "failed".to_string(),
            category: "legacy_provider_failed".to_string(),
            code: Some("LEGACY-001".to_string()),
            failed_stage: Some("translation_prepare".to_string()),
            failure_code: Some("auth_failed".to_string()),
            failure_category: Some("auth".to_string()),
            provider_stage: Some("mineru_processing".to_string()),
            provider_code: Some("A0211".to_string()),
            summary: "鉴权失败".to_string(),
            root_cause: Some("token expired".to_string()),
            retryable: false,
            upstream_host: Some("mineru.example.test".to_string()),
            provider: Some("mineru".to_string()),
            suggestion: Some("检查 provider token".to_string()),
            last_log_line: Some("token expired during mineru_processing".to_string()),
            raw_excerpt: Some("token expired".to_string()),
            raw_error_excerpt: Some("legacy raw excerpt".to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
        });
        state.db.save_job(&job).expect("save job");

        let app = build_app(state.clone());
        let detail_response = app
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/jobs/{}", job.job_id))
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("detail request"),
            )
            .await
            .expect("detail response");
        assert_eq!(detail_response.status(), StatusCode::OK);
        let detail_json = read_json(detail_response).await;

        assert_eq!(
            detail_json["data"]["failure"]["failed_stage"],
            "translation_prepare"
        );
        assert_eq!(
            detail_json["data"]["failure"]["failure_code"],
            "auth_failed"
        );
        assert_eq!(detail_json["data"]["failure"]["failure_category"], "auth");
        assert_eq!(
            detail_json["data"]["failure"]["provider_stage"],
            "mineru_processing"
        );
        assert_eq!(detail_json["data"]["failure"]["provider_code"], "A0211");
        assert_eq!(
            detail_json["data"]["failure"]["raw_excerpt"],
            "token expired"
        );
        assert_eq!(
            detail_json["data"]["failure_diagnostic"]["failed_stage"],
            "translation_prepare"
        );
        assert_eq!(
            detail_json["data"]["failure_diagnostic"]["error_kind"],
            "auth_failed"
        );
    }

    #[tokio::test]
    async fn job_events_route_merges_pipeline_jsonl_events() {
        let state = test_state("events-jsonl-merge");
        let mut job = JobSnapshot::new(
            "job-route-events-jsonl".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
        fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
        job.artifacts
            .get_or_insert_with(crate::models::JobArtifacts::default)
            .job_root = Some(job_root.to_string_lossy().to_string());
        state.db.save_job(&job).expect("save job");
        state
            .db
            .append_event(
                &job.job_id,
                "info",
                Some("queued".to_string()),
                Some("db created".to_string()),
                None,
                None,
                "job_created",
                Some("job_created".to_string()),
                "db created",
                Some(0),
                None,
                Some(json!({"origin": "db"})),
                Some(0),
                Some(5),
            )
            .expect("append db event");
        fs::write(
            job_root.join("logs").join("pipeline_events.jsonl"),
            r#"{"job_id":"job-route-events-jsonl","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"translating","stage_detail":"batch done","provider":"paddle","provider_stage":"","event_type":"stage_progress","message":"batch done","progress_current":2,"progress_total":5,"retry_count":0,"elapsed_ms":1000,"payload":{"origin":"python"}}"#,
        )
        .expect("write pipeline events");

        let app = build_app(state.clone());
        let events_response = app
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/jobs/{}/events", job.job_id))
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("events request"),
            )
            .await
            .expect("events response");
        assert_eq!(events_response.status(), StatusCode::OK);
        let events_json = read_json(events_response).await;
        let items = events_json["data"]["items"]
            .as_array()
            .expect("events items array");
        assert_eq!(items.len(), 2);
        assert!(items.iter().any(|item| item["event"] == "job_created"));
        let pipeline_item = items
            .iter()
            .find(|item| item["event_type"] == "stage_progress")
            .expect("pipeline event item");
        assert_eq!(pipeline_item["provider"], "paddle");
        assert_eq!(pipeline_item["progress_current"], 2);
        assert_eq!(pipeline_item["payload"]["origin"], "python");
    }

    #[tokio::test]
    async fn job_events_route_keeps_rendering_page_progress_events() {
        let state = test_state("events-render-progress");
        let mut job = JobSnapshot::new(
            "job-route-render-progress".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
        fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
        job.artifacts
            .get_or_insert_with(crate::models::JobArtifacts::default)
            .job_root = Some(job_root.to_string_lossy().to_string());
        state.db.save_job(&job).expect("save job");
        fs::write(
            job_root.join("logs").join("pipeline_events.jsonl"),
            concat!(
                r#"{"job_id":"job-route-render-progress","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"rendering","stage_detail":"正在渲染第 1/3 页","provider":"","provider_stage":"","event_type":"stage_progress","message":"正在渲染第 1/3 页","progress_current":1,"progress_total":3,"retry_count":0,"elapsed_ms":1000,"payload":{"page_index":0,"render_stage":"book_overlay"}}"#,
                "\n",
                r#"{"job_id":"job-route-render-progress","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"saving","stage_detail":"最终 PDF 已发布","provider":"","provider_stage":"","event_type":"artifact_published","message":"最终 PDF 已发布","progress_current":null,"progress_total":null,"retry_count":0,"elapsed_ms":1100,"payload":{"artifact_key":"output_pdf"}}"#,
                "\n"
            ),
        )
        .expect("write pipeline events");

        let app = build_app(state.clone());
        let detail_response = app
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/jobs/{}", job.job_id))
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("detail request"),
            )
            .await
            .expect("detail response");
        assert_eq!(detail_response.status(), StatusCode::OK);
        let detail_json = read_json(detail_response).await;
        assert_eq!(detail_json["data"]["stage"], "rendering");
        assert_eq!(detail_json["data"]["stage_detail"], "正在渲染第 1/3 页");
        assert_eq!(detail_json["data"]["progress"]["current"], 1);
        assert_eq!(detail_json["data"]["progress"]["total"], 3);
    }

    #[tokio::test]
    async fn job_events_route_prefers_formal_failure_fields() {
        let state = test_state("events-formal-failure");
        let mut job = JobSnapshot::new(
            "job-route-events-formal-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.replace_failure_info(Some(JobFailureInfo {
            stage: "translation".to_string(),
            category: "upstream_timeout".to_string(),
            code: Some("timeout_504".to_string()),
            failed_stage: Some("translation_prepare".to_string()),
            failure_code: Some("upstream_timeout".to_string()),
            failure_category: Some("timeout".to_string()),
            provider_stage: Some("llm_request".to_string()),
            provider_code: Some("timeout_504".to_string()),
            summary: "请求超时".to_string(),
            root_cause: Some("LLM upstream timed out".to_string()),
            retryable: true,
            upstream_host: Some("api.deepseek.com".to_string()),
            provider: Some("deepseek".to_string()),
            suggestion: Some("稍后重试".to_string()),
            last_log_line: Some("timeout".to_string()),
            raw_excerpt: Some("deadline exceeded".to_string()),
            raw_error_excerpt: Some("deadline exceeded".to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
        }));
        state.db.save_job(&job).expect("save job");
        state
            .db
            .append_event(
                &job.job_id,
                "error",
                Some("failed".to_string()),
                None,
                None,
                None,
                "failure_classified",
                Some("failure_classified".to_string()),
                "",
                None,
                None,
                Some(json!({
                    "stage": "translation",
                    "category": "upstream_timeout",
                    "code": "timeout_504",
                    "summary": "请求超时"
                })),
                Some(0),
                Some(100),
            )
            .expect("append failure event");
        state
            .db
            .append_event(
                &job.job_id,
                "error",
                Some("failed".to_string()),
                None,
                None,
                None,
                "job_terminal",
                Some("job_terminal".to_string()),
                "",
                None,
                None,
                Some(json!({
                    "status": "failed"
                })),
                Some(0),
                Some(120),
            )
            .expect("append terminal event");

        let app = build_app(state.clone());
        let response = app
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/jobs/{}/events", job.job_id))
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("events request"),
            )
            .await
            .expect("events response");
        assert_eq!(response.status(), StatusCode::OK);
        let events_json = read_json(response).await;
        let items = events_json["data"]["items"]
            .as_array()
            .expect("items array");
        let failure_item = items
            .iter()
            .find(|item| item["event"] == "failure_classified")
            .expect("failure event");
        assert_eq!(failure_item["stage"], "translation_prepare");
        assert_eq!(failure_item["provider"], "deepseek");
        assert_eq!(failure_item["provider_stage"], "llm_request");
        assert_eq!(
            failure_item["payload"]["failed_stage"],
            "translation_prepare"
        );
        assert_eq!(failure_item["payload"]["failure_code"], "upstream_timeout");
        assert_eq!(failure_item["payload"]["failure_category"], "timeout");
        assert_eq!(failure_item["payload"]["provider_code"], "timeout_504");

        let terminal_item = items
            .iter()
            .find(|item| item["event"] == "job_terminal")
            .expect("terminal event");
        assert_eq!(terminal_item["stage"], "translation_prepare");
        assert_eq!(terminal_item["provider"], "deepseek");
        assert_eq!(terminal_item["provider_stage"], "llm_request");
        assert_eq!(terminal_item["payload"]["status"], "failed");
        assert_eq!(
            terminal_item["payload"]["failed_stage"],
            "translation_prepare"
        );
        assert_eq!(terminal_item["payload"]["failure_code"], "upstream_timeout");
        assert_eq!(terminal_item["payload"]["failure_category"], "timeout");
    }

    #[tokio::test]
    async fn job_detail_route_prefers_live_pipeline_stage_snapshot() {
        let state = test_state("detail-live-stage");
        let mut job = JobSnapshot::new(
            "job-route-live-stage".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.stage = Some("queued".to_string());
        job.stage_detail = Some("old queued detail".to_string());
        let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
        fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
        job.artifacts
            .get_or_insert_with(crate::models::JobArtifacts::default)
            .job_root = Some(job_root.to_string_lossy().to_string());
        state.db.save_job(&job).expect("save job");
        fs::write(
            job_root.join("logs").join("pipeline_events.jsonl"),
            concat!(
                r#"{"job_id":"job-route-live-stage","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"translating","stage_detail":"已完成第 2/5 批翻译","provider":"","provider_stage":"","event_type":"stage_progress","message":"已完成第 2/5 批翻译","progress_current":2,"progress_total":5,"retry_count":0,"elapsed_ms":1000,"payload":{}}"#,
                "\n",
                r#"{"job_id":"job-route-live-stage","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"saving","stage_detail":"最终 PDF 已发布","provider":"","provider_stage":"","event_type":"artifact_published","message":"最终 PDF 已发布","progress_current":null,"progress_total":null,"retry_count":0,"elapsed_ms":1100,"payload":{"artifact_key":"output_pdf"}}"#,
                "\n"
            ),
        )
        .expect("write pipeline events");

        let app = build_app(state.clone());
        let detail_response = app
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/jobs/{}", job.job_id))
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("detail request"),
            )
            .await
            .expect("detail response");
        assert_eq!(detail_response.status(), StatusCode::OK);
        let detail_json = read_json(detail_response).await;
        assert_eq!(detail_json["data"]["stage"], "translating");
        assert_eq!(detail_json["data"]["stage_detail"], "已完成第 2/5 批翻译");
        assert_eq!(detail_json["data"]["progress"]["current"], 2);
        assert_eq!(detail_json["data"]["progress"]["total"], 5);
    }

    #[tokio::test]
    async fn jobs_list_route_prefers_live_pipeline_stage_snapshot() {
        let state = test_state("list-live-stage");
        let mut job = JobSnapshot::new(
            "job-route-list-live-stage".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.stage = Some("queued".to_string());
        let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
        fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
        job.artifacts
            .get_or_insert_with(crate::models::JobArtifacts::default)
            .job_root = Some(job_root.to_string_lossy().to_string());
        state.db.save_job(&job).expect("save job");
        fs::write(
            job_root.join("logs").join("pipeline_events.jsonl"),
            concat!(
                r#"{"job_id":"job-route-list-live-stage","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"translating","stage_detail":"已完成第 3/8 批翻译","provider":"","provider_stage":"","event_type":"stage_progress","message":"已完成第 3/8 批翻译","progress_current":3,"progress_total":8,"retry_count":0,"elapsed_ms":900,"payload":{}}"#,
                "\n",
                r#"{"job_id":"job-route-list-live-stage","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"saving","stage_detail":"最终 PDF 已发布","provider":"","provider_stage":"","event_type":"artifact_published","message":"最终 PDF 已发布","progress_current":null,"progress_total":null,"retry_count":0,"elapsed_ms":1000,"payload":{"artifact_key":"output_pdf"}}"#,
                "\n"
            ),
        )
        .expect("write pipeline events");

        let app = build_app(state.clone());
        let list_response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/jobs")
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("list request"),
            )
            .await
            .expect("list response");
        assert_eq!(list_response.status(), StatusCode::OK);
        let list_json = read_json(list_response).await;
        let items = list_json["data"]["items"].as_array().expect("items array");
        let item = items
            .iter()
            .find(|item| item["job_id"] == "job-route-list-live-stage")
            .expect("job item");
        assert_eq!(item["stage"], "translating");
    }

    #[tokio::test]
    async fn job_detail_list_and_events_share_pipeline_event_priority() {
        let state = test_state("shared-live-stage-priority");
        let mut job = JobSnapshot::new(
            "job-route-shared-live-stage".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.stage = Some("queued".to_string());
        job.stage_detail = Some("stale queued detail".to_string());
        let job_root: PathBuf = state.config.data_root.join("jobs").join(&job.job_id);
        fs::create_dir_all(job_root.join("logs")).expect("create logs dir");
        job.artifacts
            .get_or_insert_with(crate::models::JobArtifacts::default)
            .job_root = Some(job_root.to_string_lossy().to_string());
        state.db.save_job(&job).expect("save job");
        fs::write(
            job_root.join("logs").join("pipeline_events.jsonl"),
            concat!(
                r#"{"job_id":"job-route-shared-live-stage","seq":1,"ts":"2026-04-24T01:00:00Z","level":"info","stage":"translating","stage_detail":"已完成第 4/9 批翻译","provider":"","provider_stage":"","event":"stage_progress","message":"已完成第 4/9 批翻译","progress_current":4,"progress_total":9,"retry_count":0,"elapsed_ms":900,"payload":{"origin":"python"}}"#,
                "\n",
                r#"{"job_id":"job-route-shared-live-stage","seq":2,"ts":"2026-04-24T01:00:01Z","level":"info","stage":"saving","stage_detail":"最终 PDF 已发布","provider":"","provider_stage":"","event":"artifact_published","message":"最终 PDF 已发布","progress_current":null,"progress_total":null,"retry_count":0,"elapsed_ms":1000,"payload":{"artifact_key":"output_pdf"}}"#,
                "\n"
            ),
        )
        .expect("write pipeline events");

        let app = build_app(state.clone());

        let detail_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/jobs/{}", job.job_id))
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("detail request"),
            )
            .await
            .expect("detail response");
        assert_eq!(detail_response.status(), StatusCode::OK);
        let detail_json = read_json(detail_response).await;
        assert_eq!(detail_json["data"]["stage"], "translating");
        assert_eq!(detail_json["data"]["stage_detail"], "已完成第 4/9 批翻译");
        assert_eq!(detail_json["data"]["progress"]["current"], 4);
        assert_eq!(detail_json["data"]["progress"]["total"], 9);

        let list_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/jobs")
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("list request"),
            )
            .await
            .expect("list response");
        assert_eq!(list_response.status(), StatusCode::OK);
        let list_json = read_json(list_response).await;
        let list_item = list_json["data"]["items"]
            .as_array()
            .expect("list items")
            .iter()
            .find(|item| item["job_id"] == "job-route-shared-live-stage")
            .expect("job item");
        assert_eq!(list_item["stage"], "translating");

        let events_response = app
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/jobs/{}/events", job.job_id))
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("events request"),
            )
            .await
            .expect("events response");
        assert_eq!(events_response.status(), StatusCode::OK);
        let events_json = read_json(events_response).await;
        let items = events_json["data"]["items"]
            .as_array()
            .expect("events items");
        let stage_progress = items
            .iter()
            .find(|item| item["event"] == "stage_progress")
            .expect("stage_progress event");
        let artifact_published = items
            .iter()
            .find(|item| item["event"] == "artifact_published")
            .expect("artifact_published event");
        assert_eq!(stage_progress["event_type"], "stage_progress");
        assert_eq!(artifact_published["event_type"], "artifact_published");
        assert_eq!(artifact_published["stage"], "saving");
    }
}
