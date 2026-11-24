use std::fs;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

#[tokio::test]
async fn reader_metadata_route_returns_pdf_page_dimensions_when_ready() {
    assert_metadata_route(
        "reader-metadata",
        minimal_pdf_bytes(595, 842),
        minimal_pdf_bytes(612, 792),
        (595.0, 842.0),
        (612.0, 792.0),
    )
    .await;
}

#[tokio::test]
async fn reader_metadata_route_uses_visible_cropped_and_rotated_page_dimensions() {
    // Same geometry as the reported book: the OCR coordinates use the cropped
    // page, not the 468 x 720 MediaBox. The translated pane shares this reader.
    let mut document = lopdf::Document::load_mem(&minimal_pdf_bytes(468, 720)).unwrap();
    let page_id = document.get_pages()[&1];
    document
        .get_object_mut(page_id)
        .unwrap()
        .as_dict_mut()
        .unwrap()
        .set(
            "CropBox",
            lopdf::Object::Array(vec![
                4.32001.into(),
                11.52.into(),
                419.759979.into(),
                696.23999.into(),
            ]),
        );
    let mut source = Vec::new();
    document.save_to(&mut source).unwrap();
    document
        .get_object_mut(page_id)
        .unwrap()
        .as_dict_mut()
        .unwrap()
        .set("Rotate", 90);
    let mut translated = Vec::new();
    document.save_to(&mut translated).unwrap();
    assert_metadata_route(
        "reader-metadata-cropped",
        source,
        translated,
        (415.439969, 684.71999),
        (684.71999, 415.439969),
    )
    .await;
}

async fn assert_metadata_route(
    test_name: &str,
    source_bytes: Vec<u8>,
    translated_bytes: Vec<u8>,
    source_size: (f64, f64),
    translated_size: (f64, f64),
) {
    let state = test_state(test_name);
    let job_id = format!("{test_name}-job");
    let job_root = state.config.output_root.join(&job_id);
    let source_dir = job_root.join("source");
    let rendered_dir = job_root.join("rendered");
    fs::create_dir_all(&source_dir).expect("source dir");
    fs::create_dir_all(&rendered_dir).expect("rendered dir");
    let source_pdf = source_dir.join("source.pdf");
    let translated_pdf = rendered_dir.join("translated.pdf");
    fs::write(&source_pdf, source_bytes).expect("source pdf");
    fs::write(&translated_pdf, translated_bytes).expect("translated pdf");

    let mut input = CreateJobInput::default();
    input.runtime.job_id = job_id.clone();
    let mut job = JobSnapshot::new(job_id.clone(), input, vec!["python".to_string()]);
    job.artifacts = Some(JobArtifacts {
        job_root: Some(format!("jobs/{job_id}")),
        source_pdf: Some(format!("jobs/{job_id}/source/source.pdf")),
        output_pdf: Some(format!("jobs/{job_id}/rendered/translated.pdf")),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/jobs/{job_id}/reader/metadata"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("metadata request"),
        )
        .await
        .expect("metadata response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    // 契约 reader-data.v1 的 ReaderMetadataView（2026-11-24 起对真实返回钉键集合）。
    use crate::api_tests::job_view_contract::assert_reader_view;
    assert_reader_view(&payload["data"], "ReaderMetadataView", "metadata");
    for pane in ["source", "translated"] {
        assert_reader_view(&payload["data"][pane], "ReaderDocumentMetadata", &format!("metadata.{pane}"));
        assert_reader_view(&payload["data"][pane]["pages"][0], "ReaderPageMetadata", &format!("metadata.{pane}.pages[0]"));
    }
    for (pane, (width, height)) in [("source", source_size), ("translated", translated_size)] {
        assert_eq!(payload["data"][pane]["page_count"], 1);
        let page = &payload["data"][pane]["pages"][0];
        assert_eq!(page["page"], 1);
        assert!(
            (page["width"].as_f64().unwrap() - width).abs() < 0.001,
            "{pane}: {page}"
        );
        assert!(
            (page["height"].as_f64().unwrap() - height).abs() < 0.001,
            "{pane}: {page}"
        );
    }
}

#[tokio::test]
async fn reader_metadata_route_keeps_missing_pdfs_nullable() {
    let state = test_state("reader-metadata-missing");
    let mut input = CreateJobInput::default();
    input.runtime.job_id = "reader-metadata-missing-job".to_string();
    let job = JobSnapshot::new(
        "reader-metadata-missing-job".to_string(),
        input,
        vec!["python".to_string()],
    );
    state.db.save_job(&job).expect("save job");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/reader-metadata-missing-job/reader/metadata")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("metadata request"),
        )
        .await
        .expect("metadata response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert!(payload["data"]["source"].is_null());
    assert!(payload["data"]["translated"].is_null());
}
