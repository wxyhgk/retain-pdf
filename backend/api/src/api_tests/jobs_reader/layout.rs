//! `/jobs/:id/reader/layout`：rpr_fit 排的版面清单和按页取（2026-11-28）。版面由渲染（Python
//! `render/output/rpr_fit/reader_layout.py`）存在译文 PDF 旁边的 `reader-layout/`，这里照它的格式造一份。

use std::fs;
use std::io::Write;
use std::path::Path;

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::job_view_contract::assert_reader_view;
use crate::api_tests::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot, JobStatusKind};

fn page_json() -> Value {
    json!({
        "index": 1, "width": 612.0, "height": 792.0,
        "covers": [{"block": "p002-b0002", "rect": [46.4, 586.8, 295.9, 733.2], "fill": [1, 1, 1]}],
        "blocks": [{"id": "p002-b0002", "fontSize": 10.4, "weight": "regular", "color": [0, 0, 0],
            "lines": [{"text": "我们 $x$", "x": 50.2, "baseline": 600.1, "width": 240.0, "justified": true,
                "items": [{"x": 50.2, "t": "我"}, {"x": 60.7, "t": "们"}, {"x": 71.1, "t": "1.", "mode": "dflt"},
                          {"x": 80.0, "tex": "x", "display": false, "w": 0.57, "h": 0.44, "d": 0.01}]}]}]
    })
}

fn write_layout(rendered: &Path) {
    let dir = rendered.join("reader-layout");
    fs::create_dir_all(dir.join("pages")).unwrap();
    let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(page_json().to_string().as_bytes()).unwrap();
    fs::write(dir.join("pages/00001.json.gz"), encoder.finish().unwrap()).unwrap();
    let manifest = json!({
        "schema": "reader_layout_v1", "layout_schema": "rpr_layout_v1",
        "engine_version": "0.3.0", "engine_commit": "417a441", "output_pdf": "translated.pdf",
        "background": {"file": "background.pdf", "pages": [1]},
        "fonts": [
            {"key": "SourceHanSerifSC-Regular", "postscript": "SourceHanSerifSC-Regular", "family": "Source Han Serif SC",
             "weight": 400, "mono": false, "file": "fonts/SourceHanSerifSC-Regular.woff2", "etag": "aaaabbbbccccdddd"},
            // 文件名对不上 key 的：不认
            {"key": "Evil", "family": "x", "weight": 400, "file": "../translated.pdf", "etag": "0"}
        ],
        "pages": [
            {"index": 1, "width": 612.0, "height": 792.0, "etag": "0123456789abcdef", "blocks": 1, "file": "pages/00001.json.gz"},
            // 清单里写着跳出目录的文件名：不认
            {"index": 2, "width": 612.0, "height": 792.0, "etag": "fedcba9876543210", "blocks": 1, "file": "../translated.pdf"}
        ]
    });
    fs::write(dir.join("manifest.json"), manifest.to_string()).unwrap();
    fs::write(dir.join("background.pdf"), minimal_pdf_bytes(612, 792)).unwrap();
    fs::create_dir_all(dir.join("fonts")).unwrap();
    fs::write(dir.join("fonts/SourceHanSerifSC-Regular.woff2"), b"wOF2fake").unwrap();
    fs::write(dir.join("fonts/Unlisted.woff2"), b"wOF2fake").unwrap();
    fs::create_dir_all(dir.join("math")).unwrap();
    fs::write(dir.join("math/00112233aabbccdd.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"/>").unwrap();
}

struct Setup {
    job_id: String,
    rendered: std::path::PathBuf,
}

fn seed(state: &crate::AppState, name: &str, with_pdf: bool, configure: impl FnOnce(&mut JobSnapshot)) -> Setup {
    let job_id = format!("{name}-job");
    let rendered = state.config.output_root.join(&job_id).join("rendered");
    fs::create_dir_all(&rendered).unwrap();
    let mut input = CreateJobInput::default();
    input.runtime.job_id = job_id.clone();
    let mut job = JobSnapshot::new(job_id.clone(), input, vec!["python".to_string()]);
    if with_pdf {
        fs::write(rendered.join("translated.pdf"), minimal_pdf_bytes(612, 792)).unwrap();
        job.artifacts = Some(JobArtifacts {
            job_root: Some(format!("jobs/{job_id}")),
            output_pdf: Some(format!("jobs/{job_id}/rendered/translated.pdf")),
            ..JobArtifacts::default()
        });
    }
    job.status = JobStatusKind::Succeeded;
    configure(&mut job);
    state.db.save_job(&job).unwrap();
    Setup { job_id, rendered }
}

async fn get(app: &axum::Router, uri: &str, etag: Option<&str>) -> axum::response::Response {
    let mut request = Request::builder().uri(uri).header("X-API-Key", "test-key");
    if let Some(etag) = etag {
        request = request.header(header::IF_NONE_MATCH, etag);
    }
    app.clone().oneshot(request.body(Body::empty()).unwrap()).await.unwrap()
}

#[tokio::test]
async fn reader_layout_lists_the_kept_pages_and_serves_one_page_with_an_etag() {
    let state = test_state("reader-layout");
    let setup = seed(&state, "reader-layout", true, |_| {});
    write_layout(&setup.rendered);
    let app = build_app(state);
    let job_id = &setup.job_id;

    let response = get(&app, &format!("/api/v1/jobs/{job_id}/reader/layout"), None).await;
    assert_eq!(response.status(), StatusCode::OK);
    let data = read_json(response).await["data"].clone();
    assert_reader_view(&data, "ReaderLayoutView", "layout");
    assert_eq!(data["available"], true);
    assert_eq!(data["reason"], Value::Null);
    assert_eq!(data["generate"], Value::Null);
    assert_eq!(data["schema"], "rpr_layout_v1");
    assert_eq!(data["engine_commit"], "417a441");
    let fonts = data["fonts"].as_array().unwrap();
    assert_eq!(fonts.len(), 1, "{fonts:?}");
    assert_reader_view(&fonts[0], "ReaderLayoutFont", "layout.fonts[0]");
    assert_eq!(fonts[0]["key"], "SourceHanSerifSC-Regular");
    assert_eq!(fonts[0]["family"], "Source Han Serif SC");
    assert_eq!(fonts[0]["weight"], 400);
    assert!(fonts[0]["url"]
        .as_str()
        .unwrap()
        .ends_with(&format!("/api/v1/jobs/{job_id}/reader/layout/fonts/SourceHanSerifSC-Regular.woff2?v=aaaabbbbccccdddd")));
    assert_reader_view(&data["background"], "ReaderLayoutBackground", "layout.background");
    assert_eq!(data["background"]["pages"], json!([1]));
    let background_url = data["background"]["url"].as_str().unwrap().to_string();
    assert!(background_url.ends_with(&format!("/api/v1/jobs/{job_id}/reader/layout/background")));
    // 跳出目录的那页不认
    assert_eq!(data["page_count"], 1);
    let entry = &data["pages"][0];
    assert_reader_view(entry, "ReaderLayoutPageEntry", "layout.pages[0]");
    assert_eq!(entry["index"], 1);
    assert_eq!(entry["etag"], "0123456789abcdef");
    assert!(entry["url"].as_str().unwrap().ends_with(&format!("/api/v1/jobs/{job_id}/reader/layout/pages/1")));

    let uri = format!("/api/v1/jobs/{job_id}/reader/layout/pages/1");
    let response = get(&app, &uri, None).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::ETAG], "W/\"0123456789abcdef\"");
    let page = read_json(response).await["data"].clone();
    assert_eq!(page, page_json(), "the page is returned as the engine wrote it");
    use crate::api_tests::job_view_contract::assert_reader_definition;
    assert_reader_definition(&page, "ReaderLayoutPage", "layout page");

    let response = get(&app, &uri, Some("W/\"0123456789abcdef\"")).await;
    assert_eq!(response.status(), StatusCode::NOT_MODIFIED);

    let response = get(&app, &format!("/api/v1/jobs/{job_id}/reader/layout/background"), None).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::CONTENT_TYPE], "application/pdf");
    assert_eq!(response.headers()[header::ACCEPT_RANGES], "bytes");

    let response = get(&app, &format!("/api/v1/jobs/{job_id}/reader/layout/fonts/SourceHanSerifSC-Regular.woff2"), None).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::CONTENT_TYPE], "font/woff2");
    assert_eq!(response.headers()[header::CACHE_CONTROL], "private, max-age=31536000, immutable");
    let response = get(&app, &format!("/api/v1/jobs/{job_id}/reader/layout/math/00112233aabbccdd.svg"), None).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::CONTENT_TYPE], "image/svg+xml");
    assert_eq!(response.headers()[header::CONTENT_SECURITY_POLICY], "sandbox");
    for missing in [
        "fonts/Unlisted.woff2",
        "fonts/Evil.woff2",
        "math/00112233aabbccd.svg",
        "math/ffffffffffffffff.svg",
    ] {
        let response = get(&app, &format!("/api/v1/jobs/{job_id}/reader/layout/{missing}"), None).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{missing}");
    }

    for missing in [2, 7] {
        let response = get(&app, &format!("/api/v1/jobs/{job_id}/reader/layout/pages/{missing}"), None).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "page {missing}");
    }
}

#[tokio::test]
async fn reader_layout_says_why_there_is_none_and_how_to_generate_it() {
    let state = test_state("reader-layout-missing");
    let kept_not = seed(&state, "layout-not-kept", true, |_| {});
    let typst = seed(&state, "layout-typst", true, |job| {
        job.request_payload.render.engine = "typst".to_string();
    });
    let running = seed(&state, "layout-running", true, |job| job.status = JobStatusKind::Running);
    let dual = seed(&state, "layout-dual", true, |job| {
        job.request_payload.render.render_mode = "dual".to_string();
    });
    let no_pdf = seed(&state, "layout-no-pdf", false, |_| {});
    let app = build_app(state);

    let view = |setup: &Setup| format!("/api/v1/jobs/{}/reader/layout", setup.job_id);
    let data = read_json(get(&app, &view(&kept_not), None).await).await["data"].clone();
    assert_reader_view(&data, "ReaderLayoutView", "layout");
    assert_eq!(data["available"], false);
    assert_eq!(data["reason"], "not_kept");
    assert_eq!(data["pages"], json!([]));
    assert_eq!(data["generate"]["method"], "POST");
    assert!(data["generate"]["url"]
        .as_str()
        .unwrap()
        .ends_with(&format!("/api/v1/jobs/{}/actions/retry-stage", kept_not.job_id)));
    assert_eq!(data["generate"]["body"], json!({"stage": "render"}));

    assert_eq!(data["background"], Value::Null);
    let response = get(&app, &format!("/api/v1/jobs/{}/reader/layout/background", kept_not.job_id), None).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let data = read_json(get(&app, &view(&typst), None).await).await["data"].clone();
    assert_eq!(data["reason"], "not_engine_route");
    assert_eq!(
        data["generate"]["body"],
        json!({"stage": "render", "overrides": {"render": {"engine": "rpr_fit"}}})
    );

    let data = read_json(get(&app, &view(&running), None).await).await["data"].clone();
    assert_eq!(data["reason"], "not_kept");
    assert_eq!(data["generate"], Value::Null, "a running job gets its layout when it finishes");

    let data = read_json(get(&app, &view(&dual), None).await).await["data"].clone();
    assert_eq!(data["reason"], "unsupported_render");
    assert_eq!(data["generate"], Value::Null);

    let data = read_json(get(&app, &view(&no_pdf), None).await).await["data"].clone();
    assert_eq!(data["reason"], "no_translated_pdf");
    assert_eq!(data["generate"], Value::Null);
}
