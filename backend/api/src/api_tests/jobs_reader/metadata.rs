use std::fs;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

#[tokio::test]
async fn reader_metadata_route_returns_pdf_page_dimensions_when_ready() {
    let state = test_state("reader-metadata");
    let job_root = state.config.output_root.join("reader-metadata-job");
    let source_dir = job_root.join("source");
    let rendered_dir = job_root.join("rendered");
    fs::create_dir_all(&source_dir).expect("source dir");
    fs::create_dir_all(&rendered_dir).expect("rendered dir");
    let source_pdf = source_dir.join("source.pdf");
    let translated_pdf = rendered_dir.join("translated.pdf");
    fs::write(&source_pdf, minimal_pdf_bytes(595, 842)).expect("source pdf");
    fs::write(&translated_pdf, minimal_pdf_bytes(612, 792)).expect("translated pdf");

    let mut input = CreateJobInput::default();
    input.runtime.job_id = "reader-metadata-job".to_string();
    let mut job = JobSnapshot::new(
        "reader-metadata-job".to_string(),
        input,
        vec!["python".to_string()],
    );
    job.artifacts = Some(JobArtifacts {
        job_root: Some("jobs/reader-metadata-job".to_string()),
        source_pdf: Some("jobs/reader-metadata-job/source/source.pdf".to_string()),
        output_pdf: Some("jobs/reader-metadata-job/rendered/translated.pdf".to_string()),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/reader-metadata-job/reader/metadata")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("metadata request"),
        )
        .await
        .expect("metadata response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["source"]["page_count"], 1);
    assert_eq!(payload["data"]["source"]["pages"][0]["width"], 595.0);
    assert_eq!(payload["data"]["source"]["pages"][0]["height"], 842.0);
    assert_eq!(payload["data"]["translated"]["pages"][0]["width"], 612.0);
    assert_eq!(payload["data"]["translated"]["pages"][0]["height"], 792.0);
}
