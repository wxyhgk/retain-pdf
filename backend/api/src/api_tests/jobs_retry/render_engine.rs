//! `render.engine`（typst | rpr）在原地重渲染路径上必须原样保留：rerun、retry-stage render
//! （含 overrides 切换引擎）都只改 workflow / 凭据，不能把引擎重置回默认值。
//! render.spec.json 里 params.engine 的写出由 retain-data 的
//! `render_spec_carries_render_engine` 钉住，这里钉的是落库的任务配置。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{JobArtifacts, JobStatusKind, WorkflowKind};

use super::common::{seed_translation_result_files, source_job_with_artifacts};

fn seed_rpr_job(state: &crate::AppState, job_id: &str) {
    let mut job = source_job_with_artifacts(
        job_id,
        JobArtifacts {
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            translations_dir: Some("jobs/source/translated".to_string()),
            output_pdf: Some("jobs/source/output/old.pdf".to_string()),
            ..JobArtifacts::default()
        },
    );
    job.status = JobStatusKind::Succeeded;
    job.request_payload.render.engine = "rpr".to_string();
    seed_translation_result_files(state, &job);
    state.db.save_job(&job).expect("save source job");
}

async fn post(state: &crate::AppState, uri: String, body: Option<Value>) -> axum::response::Response {
    let builder = Request::builder()
        .method("POST")
        .uri(uri)
        .header("X-API-Key", "test-key");
    let request = match body {
        Some(body) => builder
            .header("Content-Type", "application/json")
            .body(Body::from(body.to_string())),
        None => builder.body(Body::empty()),
    }
    .expect("request");
    build_app(state.clone())
        .oneshot(request)
        .await
        .expect("response")
}

#[tokio::test]
async fn rerun_in_place_render_keeps_rpr_engine() {
    let state = test_state("render-engine-rerun");
    let id = "job-render-engine-rerun";
    seed_rpr_job(&state, id);

    let response = post(&state, format!("/api/v1/jobs/{id}/rerun"), None).await;
    assert_eq!(response.status(), StatusCode::OK);
    let job = state.db.get_job(id).expect("rerun job");
    assert_eq!(job.workflow, WorkflowKind::Render);
    assert_eq!(job.request_payload.render.engine, "rpr");
}

#[tokio::test]
async fn retry_stage_in_place_render_keeps_rpr_engine() {
    let state = test_state("render-engine-retry-render");
    let id = "job-render-engine-retry-render";
    seed_rpr_job(&state, id);

    let response = post(
        &state,
        format!("/api/v1/jobs/{id}/retry-stage"),
        Some(json!({"stage": "render", "create_new_job": false})),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let job = state.db.get_job(id).expect("retry job");
    assert_eq!(job.workflow, WorkflowKind::Render);
    assert_eq!(job.request_payload.render.engine, "rpr");
}

#[tokio::test]
async fn retry_stage_render_override_can_switch_engine_but_rejects_unknown() {
    let state = test_state("render-engine-retry-override");
    let id = "job-render-engine-retry-override";
    seed_rpr_job(&state, id);

    let response = post(
        &state,
        format!("/api/v1/jobs/{id}/retry-stage"),
        Some(json!({
            "stage": "render",
            "create_new_job": false,
            "overrides": {"render": {"engine": "bogus"}}
        })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let payload = read_json(response).await;
    assert!(payload["message"]
        .as_str()
        .unwrap_or_default()
        .contains("render.engine must be one of"));
    assert_eq!(
        state.db.get_job(id).expect("job").request_payload.render.engine,
        "rpr",
        "被拒绝的 override 不落库"
    );

    let response = post(
        &state,
        format!("/api/v1/jobs/{id}/retry-stage"),
        Some(json!({
            "stage": "render",
            "create_new_job": false,
            "overrides": {"render": {"engine": "typst"}}
        })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        state.db.get_job(id).expect("job").request_payload.render.engine,
        "typst"
    );
}

#[tokio::test]
async fn create_job_rejects_unknown_render_engine() {
    let state = test_state("render-engine-create-invalid");
    let response = post(
        &state,
        "/api/v1/jobs".to_string(),
        Some(json!({
            "workflow": "book",
            "source": {"upload_id": "upload-missing"},
            "translation": {
                "model": "deepseek-flash",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            },
            "render": {"engine": "bogus"}
        })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let payload = read_json(response).await;
    assert!(
        payload["message"]
            .as_str()
            .unwrap_or_default()
            .contains("render.engine must be one of"),
        "{payload}"
    );
}
