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
    assert_eq!(payload["data"]["items"][0]["item_id"], "p008-b0009");
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
    assert!(payload["data"]["items"][0].get("asset_ids").is_some());
    assert!(payload["data"]["items"][0].get("asset_urls").is_some());
    assert_eq!(payload["data"]["items"][0]["asset_ids"], json!([]));
    assert_eq!(payload["data"]["items"][0]["asset_urls"], json!([]));
    // Reader wire convention: pages are one-based and boxes are top-left PDF points.
    assert_eq!(payload["data"]["items"][0]["source"]["unit"], "pdf_point");
    assert_eq!(payload["data"]["items"][0]["source"]["origin"], "top_left");
    assert_eq!(payload["data"]["items"][0]["translated"]["unit"], "pdf_point");
    assert_eq!(payload["data"]["items"][0]["translated"]["origin"], "top_left");
    assert_eq!(payload["data"]["items"][0]["source"]["page"], 8);
    assert_eq!(payload["data"]["items"][0]["translated"]["page"], 8);
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
        json!(["/api/v1/jobs/reader-region-job/files/output/ocr/images/page-8/imgs/chart%20a.png"])
    );

    // One block for quoting a paragraph: the same entry as in the list. The translation's
    // three-digit spelling (p008-b009) and the reader's four-digit one name the same block.
    for item_id in ["p008-b0009", "p008-b009"] {
        let (status, one) = get_region(&app, item_id).await;
        assert_eq!(status, StatusCode::OK, "{item_id}: {one}");
        assert_eq!(one["data"], payload["data"]["items"][0], "{item_id}");
    }
    let (status, figure) = get_region(&app, "p008-b0010").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(figure["data"], payload["data"]["items"][1]);
    let (status, missing) = get_region(&app, "p008-b0099").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(missing["error"]["details"], json!({}));
    assert_eq!(missing["message"], "reader region not found: p008-b0099");

    let image_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/reader-region-job/files/output/ocr/images/page-8/imgs/chart%20a.png")
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
        json!(["/api/v1/jobs/reader-region-source-only-job/files/output/ocr/images/page-1/imgs/source-only.png"])
    );
}

async fn get_region(app: &axum::Router, item_id: &str) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/jobs/reader-region-job/reader/regions/{item_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("region request"),
        )
        .await
        .expect("region response");
    let status = response.status();
    (status, read_json(response).await)
}

/// 一本 `blocks` 块的书（够大，响应过 8KB 会压缩）；返回改译文用的那页文件。
fn write_big_job(state: &crate::AppState, job_id: &str, blocks: usize, text: &str) -> std::path::PathBuf {
    let job_root = state.config.output_root.join(job_id);
    let normalized_path = job_root.join("ocr/normalized/document.v1.json");
    let translated_dir = job_root.join("translated");
    fs::create_dir_all(normalized_path.parent().unwrap()).expect("normalized dir");
    fs::create_dir_all(&translated_dir).expect("translated dir");
    let source_blocks: Vec<Value> = (0..blocks)
        .map(|index| json!({
            "block_id": format!("p001-b{index:04}"),
            "bbox": [10.0, 10.0 + index as f64, 300.0, 20.0 + index as f64],
            "source_text": format!("Source paragraph number {index} with some words"),
            "block_kind": "text"
        }))
        .collect();
    fs::write(
        &normalized_path,
        serde_json::to_vec(&json!({"pages": [{"page_index": 0, "blocks": source_blocks}]})).unwrap(),
    )
    .expect("write normalized");
    let page_path = translated_dir.join("page-001.json");
    write_translated_page(&page_path, blocks, text);
    fs::write(
        translated_dir.join("translation-manifest.json"),
        serde_json::to_vec(&json!({"pages": [{"page_index": 0, "path": "page-001.json"}]})).unwrap(),
    )
    .expect("write manifest");
    let mut input = CreateJobInput::default();
    input.runtime.job_id = job_id.to_string();
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()]);
    job.artifacts = Some(JobArtifacts {
        job_root: Some(format!("jobs/{job_id}")),
        normalized_document_json: Some(format!("jobs/{job_id}/ocr/normalized/document.v1.json")),
        translations_dir: Some(format!("jobs/{job_id}/translated")),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");
    page_path
}

fn write_translated_page(path: &std::path::Path, blocks: usize, text: &str) {
    let items: Vec<Value> = (0..blocks)
        .map(|index| json!({
            "item_id": format!("p001-b{index:03}"),
            "page_idx": 0,
            "bbox": [10.0, 10.0 + index as f64, 300.0, 20.0 + index as f64],
            "translated_text": format!("{text} {index}")
        }))
        .collect();
    fs::write(path, serde_json::to_vec(&items).unwrap()).expect("write translation page");
}

async fn get_regions(app: &axum::Router, job_id: &str, extra: &[(&str, &str)]) -> axum::response::Response {
    let mut request = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/jobs/{job_id}/reader/regions"))
        .header("X-API-Key", "test-key");
    for (name, value) in extra {
        request = request.header(*name, *value);
    }
    app.clone().oneshot(request.body(Body::empty()).unwrap()).await.expect("regions response")
}

#[tokio::test]
async fn reader_regions_answer_not_modified_until_a_translation_changes() {
    let state = test_state("reader-regions-etag");
    let page_path = write_big_job(&state, "regions-etag-job", 3, "第一版");
    let app = build_app(state);

    let first = get_regions(&app, "regions-etag-job", &[]).await;
    assert_eq!(first.status(), StatusCode::OK);
    assert_eq!(first.headers()["cache-control"], "private, no-cache");
    let etag = first.headers()["etag"].to_str().unwrap().to_string();
    assert!(etag.starts_with("W/\""), "{etag}");
    assert_eq!(read_json(first).await["data"]["items"][0]["translated"]["text"], "第一版 0");

    // 浏览器带着上次的 ETag 来、文件没变：304、不带数据
    let again = get_regions(&app, "regions-etag-job", &[("If-None-Match", &etag)]).await;
    assert_eq!(again.status(), StatusCode::NOT_MODIFIED);
    assert_eq!(again.headers()["etag"], etag.as_str());
    let body = axum::body::to_bytes(again.into_body(), usize::MAX).await.unwrap();
    assert!(body.is_empty());

    // 重译了一页：新 ETag、新数据（内存里算好的那份不能再用）
    std::thread::sleep(std::time::Duration::from_millis(20));
    write_translated_page(&page_path, 3, "第二版");
    let changed = get_regions(&app, "regions-etag-job", &[("If-None-Match", &etag)]).await;
    assert_eq!(changed.status(), StatusCode::OK);
    assert_ne!(changed.headers()["etag"], etag.as_str());
    assert_eq!(read_json(changed).await["data"]["items"][0]["translated"]["text"], "第二版 0");
}

#[tokio::test]
async fn large_json_responses_are_gzipped_only_when_the_client_accepts_it() {
    let state = test_state("reader-regions-gzip");
    write_big_job(&state, "regions-gzip-job", 200, "译文");
    let app = build_app(state);

    let plain = get_regions(&app, "regions-gzip-job", &[]).await;
    assert!(plain.headers().get("content-encoding").is_none());
    let plain_size = axum::body::to_bytes(plain.into_body(), usize::MAX).await.unwrap().len();
    assert!(plain_size > 8 * 1024, "{plain_size}");

    let gzipped = get_regions(&app, "regions-gzip-job", &[("Accept-Encoding", "gzip")]).await;
    assert_eq!(gzipped.status(), StatusCode::OK);
    assert_eq!(gzipped.headers()["content-encoding"], "gzip");
    let gzipped_size = axum::body::to_bytes(gzipped.into_body(), usize::MAX).await.unwrap().len();
    assert!(gzipped_size * 4 < plain_size, "{gzipped_size} vs {plain_size}");

    // 小响应不压
    let small = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/jobs/regions-gzip-job/reader/regions/p001-b0001")
                .header("X-API-Key", "test-key")
                .header("Accept-Encoding", "gzip")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(small.status(), StatusCode::OK);
    assert!(small.headers().get("content-encoding").is_none());
}

/// 同一任务并发取两个不同的区块，各拿各的（以前合并并发请求的键没带区块编号，后到的请求拿到先到的那一块；
/// AI 并行调 read_passage 时会静默拿错原文）。
///
/// 反证方式：把 `get_reader_region` 的键改回 `reader-region:{job_id}`，这个测试必须变红。
#[tokio::test]
async fn concurrent_single_region_requests_each_get_their_own_block() {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    let state = test_state("reader-region-concurrent");
    write_big_job(&state, "reader-region-job", 3, "译文"); // get_region 取的是这个任务
    let app = build_app(state.clone());

    // 先把读请求的两个槽占住，让两个区块请求同时排在里面（确保它们「同时在跑」）。
    let started = Arc::new(AtomicUsize::new(0));
    let mut releases = Vec::new();
    let mut holders = Vec::new();
    for index in 0..2 {
        let (release, wait) = std::sync::mpsc::channel::<()>();
        releases.push(release);
        let started = started.clone();
        let state = state.clone();
        holders.push(tokio::spawn(async move {
            crate::routes::common::run_job_query_once(&state, format!("hold-region-slot-{index}"), move |_| {
                started.fetch_add(1, Ordering::SeqCst);
                let _ = wait.recv();
                Ok(())
            })
            .await
        }));
    }
    for _ in 0..200 {
        if started.load(Ordering::SeqCst) == 2 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    assert_eq!(started.load(Ordering::SeqCst), 2, "两个槽都应该被占住");

    let first = tokio::spawn({
        let app = app.clone();
        async move { get_region(&app, "p001-b0000").await }
    });
    let second = tokio::spawn({
        let app = app.clone();
        async move { get_region(&app, "p001-b0002").await }
    });
    tokio::time::sleep(Duration::from_millis(100)).await;
    for release in releases {
        let _ = release.send(());
    }
    for holder in holders {
        holder.await.expect("holder task").expect("holder query");
    }
    let (status, first) = first.await.expect("first request");
    assert_eq!(status, StatusCode::OK);
    let (status, second) = second.await.expect("second request");
    assert_eq!(status, StatusCode::OK);
    assert_eq!(first["data"]["item_id"], "p001-b0000");
    assert_eq!(second["data"]["item_id"], "p001-b0002");
    assert_eq!(second["data"]["translated"]["text"], "译文 2");
}
