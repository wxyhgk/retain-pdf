use std::fs;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

#[tokio::test]
async fn reader_regions_route_maps_translated_items_to_source_blocks() {
    let state = test_state("reader-regions");
    let job_root = state.config.output_root.join("reader-region-job");
    let normalized_path = job_root.join("ocr/normalized/document.v1.json");
    let translated_dir = job_root.join("translated");
    fs::create_dir_all(normalized_path.parent().unwrap()).expect("normalized dir");
    fs::create_dir_all(&translated_dir).expect("translated dir");
    fs::write(
        &normalized_path,
        serde_json::to_vec(&json!({
            "assets": {
                "asset-figure": {"uri": "md/images/page-8/imgs/chart a.png"}
            },
            "pages": [{
                "page_index": 7,
                "blocks": [
                    {
                        "block_id": "p008-b0009",
                        "bbox": [72.1, 132.4, 310.8, 186.2],
                        "source_text": "The source text",
                        "block_kind": "text"
                    },
                    {
                        "block_id": "p008-b0010",
                        "bbox": [90.0, 210.0, 410.0, 390.0],
                        "source_text": "",
                        "type": "image",
                        "content": {
                            "kind": "image",
                            "asset_id": "asset-figure",
                            "asset_ids": ["asset-figure"]
                        }
                    }
                ]
            }]
        }))
        .expect("normalized json"),
    )
    .expect("write normalized");
    let image_path = job_root.join("md/images/page-8/imgs/chart a.png");
    fs::create_dir_all(image_path.parent().unwrap()).expect("image dir");
    fs::write(&image_path, b"image").expect("image");
    fs::write(
        translated_dir.join("page-008-deepseek.json"),
        serde_json::to_vec(&json!([
            {
                "item_id": "p008-b009",
                "page_idx": 7,
                "bbox": [74.0, 130.0, 330.0, 190.0],
                "translated_text": "译文",
                "render_markdown": "译文 markdown"
            }
        ]))
        .expect("page json"),
    )
    .expect("write translation page");
    fs::write(
        translated_dir.join("translation-manifest.json"),
        serde_json::to_vec(&json!({
            "pages": [{
                "page_index": 7,
                "path": "page-008-deepseek.json"
            }]
        }))
        .expect("manifest json"),
    )
    .expect("write manifest");

    let mut input = CreateJobInput::default();
    input.runtime.job_id = "reader-region-job".to_string();
    let mut job = JobSnapshot::new(
        "reader-region-job".to_string(),
        input,
        vec!["python".to_string()],
    );
    job.artifacts = Some(JobArtifacts {
        job_root: Some("jobs/reader-region-job".to_string()),
        normalized_document_json: Some(
            "jobs/reader-region-job/ocr/normalized/document.v1.json".to_string(),
        ),
        translations_dir: Some("jobs/reader-region-job/translated".to_string()),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");

    let app = build_app(state);
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/reader-region-job/reader/regions")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("regions request"),
        )
        .await
        .expect("regions response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["items"][0]["item_id"], "p008-b009");
    assert_eq!(payload["data"]["items"][0]["source"]["page"], 8);
    assert_eq!(payload["data"]["items"][0]["translated"]["page"], 8);
    assert_eq!(
        payload["data"]["items"][0]["source"]["bbox"],
        json!([72.1, 132.4, 310.8, 186.2])
    );
    assert_eq!(
        payload["data"]["items"][0]["translated"]["bbox"],
        json!([74.0, 130.0, 330.0, 190.0])
    );
    assert_eq!(
        payload["data"]["items"][0]["source"]["text"],
        "The source text"
    );
    assert_eq!(payload["data"]["items"][0]["translated"]["text"], "译文");
    assert_eq!(payload["data"]["items"][0]["markdown"], "译文 markdown");
    assert_eq!(payload["data"]["items"][0]["region_type"], "text");
    assert_eq!(payload["data"]["items"][0]["status"], "translated");
    assert_eq!(payload["data"]["items"].as_array().unwrap().len(), 2);
    assert_eq!(payload["data"]["items"][1]["item_id"], "p008-b0010");
    assert_eq!(payload["data"]["items"][1]["region_type"], "image");
    assert_eq!(payload["data"]["items"][1]["status"], "source_only");
    assert_eq!(
        payload["data"]["items"][1]["asset_ids"],
        json!(["asset-figure"])
    );
    assert_eq!(
        payload["data"]["items"][1]["asset_urls"],
        json!(["/api/v1/jobs/reader-region-job/markdown/images/page-8/imgs/chart%20a.png"])
    );

    let image_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/reader-region-job/markdown/images/page-8/imgs/chart%20a.png")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("asset request"),
        )
        .await
        .expect("asset response");
    assert_eq!(image_response.status(), StatusCode::OK);
}

#[tokio::test]
async fn reader_regions_route_returns_normalized_source_blocks_without_translation() {
    let state = test_state("reader-regions-source-only");
    let job_root = state
        .config
        .output_root
        .join("reader-region-source-only-job");
    let normalized_path = job_root.join("ocr/normalized/document.v1.json");
    fs::create_dir_all(normalized_path.parent().unwrap()).expect("normalized dir");
    fs::write(
        &normalized_path,
        serde_json::to_vec(&json!({
            "assets": {
                "asset-source-only": {"uri": "images/page-1/imgs/source-only.png"}
            },
            "pages": [{
                "page_index": 0,
                "blocks": [
                    {
                        "block_id": "p001-b0000",
                        "bbox": [20.0, 30.0, 220.0, 60.0],
                        "geometry": {"bbox": [20.0, 30.0, 220.0, 60.0]},
                        "text": "OCR source text",
                        "type": "text"
                    },
                    {
                        "block_id": "p001-b0001",
                        "bbox": [40.0, 80.0, 300.0, 240.0],
                        "geometry": {"bbox": [40.0, 80.0, 300.0, 240.0]},
                        "text": "",
                        "type": "image",
                        "content": {
                            "kind": "image",
                            "asset_ids": ["asset-source-only"]
                        }
                    }
                ]
            }]
        }))
        .expect("normalized json"),
    )
    .expect("write normalized");
    let image_path = job_root.join("md/images/page-1/imgs/source-only.png");
    fs::create_dir_all(image_path.parent().unwrap()).expect("image dir");
    fs::write(&image_path, b"image").expect("image");

    let mut input = CreateJobInput::default();
    input.runtime.job_id = "reader-region-source-only-job".to_string();
    let mut job = JobSnapshot::new(
        "reader-region-source-only-job".to_string(),
        input,
        vec!["python".to_string()],
    );
    job.artifacts = Some(JobArtifacts {
        job_root: Some("jobs/reader-region-source-only-job".to_string()),
        normalized_document_json: Some(
            "jobs/reader-region-source-only-job/ocr/normalized/document.v1.json".to_string(),
        ),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/reader-region-source-only-job/reader/regions")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("regions request"),
        )
        .await
        .expect("regions response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["items"].as_array().unwrap().len(), 2);
    assert_eq!(payload["data"]["items"][0]["item_id"], "p001-b0000");
    assert_eq!(
        payload["data"]["items"][0]["source"]["text"],
        "OCR source text"
    );
    assert_eq!(
        payload["data"]["items"][0]["translated"]["text"],
        Value::Null
    );
    assert_eq!(payload["data"]["items"][0]["status"], "source_only");
    assert_eq!(payload["data"]["items"][1]["region_type"], "image");
    assert_eq!(
        payload["data"]["items"][1]["asset_ids"],
        json!(["asset-source-only"])
    );
    assert_eq!(
        payload["data"]["items"][1]["asset_urls"],
        json!(["/api/v1/jobs/reader-region-source-only-job/markdown/images/page-1/imgs/source-only.png"])
    );
}
