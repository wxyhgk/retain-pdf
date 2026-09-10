use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

#[tokio::test]
async fn job_detail_route_exposes_stage_contract_readiness() {
    let state = test_state("detail-stage-contracts");
    let job_id = "job-route-stage-contracts";
    let job_root: PathBuf = state.config.data_root.join("jobs").join(job_id);
    let source_pdf = job_root.join("source/input.pdf");
    let translations_dir = job_root.join("translated");
    fs::create_dir_all(source_pdf.parent().expect("source parent")).expect("source dir");
    fs::create_dir_all(&translations_dir).expect("translations dir");
    fs::write(&source_pdf, b"%PDF").expect("source pdf");

    let mut job = JobSnapshot::new(
        job_id.to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.artifacts = Some(JobArtifacts {
        job_root: Some(job_root.to_string_lossy().to_string()),
        source_pdf: Some(source_pdf.to_string_lossy().to_string()),
        translations_dir: Some(translations_dir.to_string_lossy().to_string()),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");

    let app = build_app(state.clone());
    let detail_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{job_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(detail_response.status(), StatusCode::OK);
    let detail_json = read_json(detail_response).await;
    assert_eq!(
        detail_json["data"]["contracts"]["schema_version"],
        "job_stage_contracts.v1"
    );
    let stages = detail_json["data"]["contracts"]["stages"]
        .as_array()
        .expect("contract stages");
    let translation_stage = stages
        .iter()
        .find(|item| item["stage"] == "translation_ready_for_render")
        .expect("translation contract");
    assert_eq!(translation_stage["ready"], false);
    let manifest = translation_stage["artifacts"]
        .as_array()
        .expect("artifacts")
        .iter()
        .find(|item| item["artifact_key"] == "translation_manifest_json")
        .expect("manifest artifact");
    assert_eq!(manifest["required"], true);
    assert_eq!(manifest["ready"], false);
}
