use axum::extract::{Path as AxumPath, Query, State};
use axum::http::HeaderMap;
use axum::Json;

use crate::error::AppError;
use crate::models::{
    ApiResponse, ListTranslationItemsQuery, TranslationDebugItemView, TranslationDebugListView,
    TranslationDiagnosticsView, TranslationReplayView,
};
use crate::AppState;

use super::common::build_jobs_route_deps;
use super::query_adapter::{
    replay_translation_item_response, translation_diagnostics_response, translation_item_response,
    translation_items_response,
};

pub async fn get_translation_diagnostics(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    _headers: HeaderMap,
) -> Result<Json<ApiResponse<TranslationDiagnosticsView>>, AppError> {
    translation_diagnostics_response(build_jobs_route_deps(&state), &job_id)
}

pub async fn list_translation_items(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    Query(query): Query<ListTranslationItemsQuery>,
) -> Result<Json<ApiResponse<TranslationDebugListView>>, AppError> {
    translation_items_response(build_jobs_route_deps(&state), &job_id, &query)
}

pub async fn get_translation_item(
    State(state): State<AppState>,
    AxumPath((job_id, item_id)): AxumPath<(String, String)>,
) -> Result<Json<ApiResponse<TranslationDebugItemView>>, AppError> {
    translation_item_response(build_jobs_route_deps(&state), &job_id, &item_id)
}

pub async fn replay_translation_item_route(
    State(state): State<AppState>,
    AxumPath((job_id, item_id)): AxumPath<(String, String)>,
) -> Result<Json<ApiResponse<TranslationReplayView>>, AppError> {
    replay_translation_item_response(build_jobs_route_deps(&state), &job_id, &item_id).await
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::fs;
    use std::sync::Arc;

    use axum::body::{to_bytes, Body};
    use axum::http::{Request, StatusCode};
    use serde_json::json;
    use tower::util::ServiceExt;

    use crate::app::{build_app, build_state};
    use crate::config::AppConfig;
    use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

    fn test_state(test_name: &str) -> crate::AppState {
        let root = std::env::temp_dir().join(format!(
            "rust-api-translation-routes-{test_name}-{}",
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
        fs::create_dir_all(scripts_dir.join("devtools")).expect("create devtools dir");

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
            provider_limits: crate::config::ProviderLimitsConfig::default(),
            provider_runtime: crate::config::ProviderRuntimeConfig::default(),
            job_runner: crate::config::JobRunnerConfig::default(),
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

    #[tokio::test]
    async fn translation_debug_routes_redact_secrets() {
        let state = test_state("debug-redaction");
        let job_root = state.config.output_root.join("job-translation-debug");
        let artifacts_dir = job_root.join("artifacts");
        let translated_dir = job_root.join("translated");
        fs::create_dir_all(&artifacts_dir).expect("artifacts dir");
        fs::create_dir_all(&translated_dir).expect("translated dir");
        fs::write(
            artifacts_dir.join("translation_diagnostics.json"),
            serde_json::to_vec_pretty(&json!({
                "api_key": "sk-debug-secret",
                "message": "contains sk-debug-secret"
            }))
            .expect("diagnostics json"),
        )
        .expect("write diagnostics");
        fs::write(
            translated_dir.join("page-1.json"),
            serde_json::to_vec_pretty(&json!([
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "source_text": "English sk-debug-secret",
                    "api_key": "sk-debug-secret"
                }
            ]))
            .expect("page json"),
        )
        .expect("write page");
        fs::write(
            translated_dir.join("translation-manifest.json"),
            serde_json::to_vec_pretty(&json!({
                "pages": [{"page_index": 0, "path": "page-1.json"}]
            }))
            .expect("manifest json"),
        )
        .expect("write manifest");
        fs::write(
            state
                .config
                .scripts_dir
                .join("devtools")
                .join("replay_translation_item.py"),
            r#"#!/usr/bin/env python3
import json
print(json.dumps({"api_key": "sk-debug-secret", "message": "replay sk-debug-secret"}))
"#,
        )
        .expect("write replay script");

        let mut input = CreateJobInput::default();
        input.translation.api_key = "sk-debug-secret".to_string();
        let mut job = JobSnapshot::new(
            "job-translation-debug".to_string(),
            input,
            vec!["python".to_string()],
        );
        job.artifacts = Some(JobArtifacts {
            job_root: Some(job_root.to_string_lossy().to_string()),
            translations_dir: Some(translated_dir.to_string_lossy().to_string()),
            ..JobArtifacts::default()
        });
        state.db.save_job(&job).expect("save job");

        let app = build_app(state);

        let diagnostics_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/jobs/job-translation-debug/translation/diagnostics")
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("diagnostics request"),
            )
            .await
            .expect("diagnostics response");
        assert_eq!(diagnostics_response.status(), StatusCode::OK);
        let diagnostics_json = read_json(diagnostics_response).await;
        assert_eq!(diagnostics_json["data"]["summary"]["api_key"], "");
        assert_eq!(
            diagnostics_json["data"]["summary"]["message"],
            "contains [REDACTED]"
        );

        let item_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/jobs/job-translation-debug/translation/items/p001-b001")
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("item request"),
            )
            .await
            .expect("item response");
        assert_eq!(item_response.status(), StatusCode::OK);
        let item_json = read_json(item_response).await;
        assert_eq!(item_json["data"]["item"]["api_key"], "");
        assert_eq!(
            item_json["data"]["item"]["source_text"],
            "English [REDACTED]"
        );

        let replay_response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/jobs/job-translation-debug/translation/items/p001-b001/replay")
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("replay request"),
            )
            .await
            .expect("replay response");
        assert_eq!(replay_response.status(), StatusCode::OK);
        let replay_json = read_json(replay_response).await;
        assert_eq!(replay_json["data"]["payload"]["api_key"], "");
        assert_eq!(
            replay_json["data"]["payload"]["message"],
            "replay [REDACTED]"
        );
    }
}
