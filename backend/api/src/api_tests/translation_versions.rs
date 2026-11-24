//! 端到端：译文版本（v30）——列出、切换、改名、隐藏，阅读入口按版本合成（只重翻一部分页的版本其余页沿用来源版本）。
//! 调用真正的 `retainpdf-pipeline`（合并阅读要生成合并目录）。

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::jobs_common::read_json;
use super::merged_reading::{pdf_texts, request, seed_document, seed_range_job, state_with_real_pipeline};
use crate::app::build_app;

async fn send(app: &axum::Router, method: &str, uri: &str, body: Value) -> axum::response::Response {
    app.clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(uri)
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap()
}

async fn ok(response: axum::response::Response) -> Value {
    assert_eq!(response.status(), StatusCode::OK);
    read_json(response).await["data"].clone()
}

/// 按阅读入口打开，返回译文 PDF 每页的文字（`|` 分开）和回包。
async fn read_pages(app: &axum::Router, document_id: &str, query: &str) -> (String, Value) {
    let view = ok(request(app, "GET", &format!("/api/v1/documents/{document_id}/reading{query}")).await).await;
    let job_id = view["job_id"].as_str().expect("readable").to_string();
    let pdf = request(app, "GET", &format!("/api/v1/jobs/{job_id}/files/output/translated.pdf?watermark=0")).await;
    assert_eq!(pdf.status(), StatusCode::OK);
    (pdf_texts(&to_bytes(pdf.into_body(), usize::MAX).await.unwrap()), view)
}

/// 契约 library-documents.v1 的 TranslationVersionsView（列表、选当前版本、改版本三条接口都回它；2026-11-24 起钉键集合）。
fn assert_versions_view(value: &Value, path: &str) {
    use super::job_view_contract::assert_contract_view;
    const CONTRACT: &str = "library-documents.v1.schema.json";
    assert_contract_view(value, CONTRACT, "TranslationVersionsView", path);
    for (index, version) in value["versions"].as_array().expect("versions").iter().enumerate() {
        assert_contract_view(version, CONTRACT, "TranslationVersionView", &format!("{path}.versions[{index}]"));
    }
}

#[tokio::test]
async fn versions_can_be_listed_switched_renamed_and_hidden() {
    let state = state_with_real_pipeline("translation-versions");
    let document_id = seed_document(&state, &["SRC 1", "SRC 2", "SRC 3"]);
    // 第一版整本；第二版只重翻第 2 页（其余页沿用第一版）；第三版又整本翻了一遍
    seed_range_job(&state, &document_id, "job-whole", "2026-11-01T00:00:00", &[1, 2, 3], &["OLD 1", "OLD 2", "OLD 3"]);
    seed_range_job(&state, &document_id, "job-redo", "2026-11-02T00:00:00", &[2], &["NEW 2"]);
    seed_range_job(&state, &document_id, "job-agent", "2026-11-03T00:00:00", &[1, 2, 3], &["AG 1", "AG 2", "AG 3"]);
    let db = state.db.clone();
    let v1 = db.create_translation_version(&document_id, None, "translate").unwrap();
    db.add_job_to_translation_version(&v1, "job-whole").unwrap();
    let v2 = db.create_translation_version(&document_id, Some(&v1), "retranslate").unwrap();
    db.add_job_to_translation_version(&v2, "job-redo").unwrap();
    let v3 = db.create_translation_version(&document_id, None, "translate").unwrap();
    db.add_job_to_translation_version(&v3, "job-agent").unwrap();
    let app = build_app(state);
    let versions_uri = format!("/api/v1/documents/{document_id}/translation-versions");

    let list = ok(request(&app, "GET", &versions_uri).await).await;
    assert_versions_view(&list, "list");
    assert_eq!(list["current_version_id"], Value::Null, "auto until the user picks one");
    assert_eq!(list["has_newer"], false);
    let rows: Vec<(String, Value, bool, Option<String>)> = list["versions"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| (v["version_id"].as_str().unwrap().to_string(), v["page_ranges"].clone(), v["whole_book"].as_bool().unwrap(), v["base_version_id"].as_str().map(str::to_string)))
        .collect();
    assert_eq!(
        rows,
        vec![
            (v1.clone(), json!([[1, 3]]), true, None),
            (v2.clone(), json!([[2, 2]]), false, Some(v1.clone())),
            (v3.clone(), json!([[1, 3]]), true, None),
        ]
    );
    assert!(list["versions"][1]["name"].as_str().unwrap().ends_with("（第 2 页）"), "{}", list["versions"][1]["name"]);
    assert_eq!(list["versions"][0]["status"], "succeeded");

    // 自动：逐页取最新 → 第三版整本
    let (pages, view) = read_pages(&app, &document_id, "").await;
    assert_eq!((pages.as_str(), &view["version_id"]), ("AG 1|AG 2|AG 3", &Value::Null));
    // 指定第二版：第 2 页是它自己的，其余页沿用第一版
    let (pages, view) = read_pages(&app, &document_id, &format!("?version={v2}")).await;
    assert_eq!(pages, "OLD 1|NEW 2|OLD 3");
    assert_eq!(view["version_id"], json!(v2));

    // 选第一版：不带参数就读它；有更新的版本，提示
    let list = ok(send(&app, "PUT", &format!("/api/v1/documents/{document_id}/translation-version"), json!({"version_id": v1})).await).await;
    assert_versions_view(&list, "put");
    assert_eq!((&list["current_version_id"], &list["has_newer"]), (&json!(v1), &json!(true)));
    let (pages, view) = read_pages(&app, &document_id, "").await;
    assert_eq!((pages.as_str(), &view["version_id"]), ("OLD 1|OLD 2|OLD 3", &json!(v1)));
    // auto 强制读自动
    assert_eq!(read_pages(&app, &document_id, "?version=auto").await.0, "AG 1|AG 2|AG 3");

    // 改名、隐藏第三版：自动模式不再用它
    let list = ok(send(&app, "PATCH", &format!("{versions_uri}/{v3}"), json!({"label": "Haiku 精翻", "hidden": true})).await).await;
    assert_versions_view(&list, "patch");
    let hidden = list["versions"].as_array().unwrap().iter().find(|v| v["version_id"] == json!(v3)).unwrap().clone();
    assert_eq!((&hidden["name"], &hidden["hidden"]), (&json!("Haiku 精翻"), &json!(true)));
    assert_eq!(ok(request(&app, "GET", &versions_uri).await).await["versions"].as_array().unwrap().len(), 2, "hidden ones are not listed");
    assert_eq!(read_pages(&app, &document_id, "?version=auto").await.0, "OLD 1|NEW 2|OLD 3");
    // 隐藏的不能选
    let refused = send(&app, "PUT", &format!("/api/v1/documents/{document_id}/translation-version"), json!({"version_id": v3})).await;
    assert_eq!(refused.status(), StatusCode::CONFLICT);
    // 隐藏当前版本：书回到自动
    let list = ok(send(&app, "PATCH", &format!("{versions_uri}/{v1}"), json!({"hidden": true})).await).await;
    assert_eq!(list["current_version_id"], Value::Null);

    // 不存在的版本、错的字段
    let missing = send(&app, "PUT", &format!("/api/v1/documents/{document_id}/translation-version"), json!({"version_id": "tv-nope"})).await;
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
    let missing = request(&app, "GET", &format!("/api/v1/documents/{document_id}/reading?version=tv-nope")).await;
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
    let bad = send(&app, "PATCH", &format!("{versions_uri}/{v2}"), json!({"name": "x"})).await;
    assert!(bad.status().is_client_error());
    // 回到自动
    let list = ok(send(&app, "PUT", &format!("/api/v1/documents/{document_id}/translation-version"), json!({"version_id": null})).await).await;
    assert_eq!(list["current_version_id"], Value::Null);
}
