//! 端到端：`POST /api/v1/book-folder/export` 把书导出成 `<数据目录>/books/` 下的 Markdown 文件夹。
//! 合并阅读要调真正的 `retainpdf-pipeline`（和 `merged_reading` 同一套夹具）。

use std::fs;
use std::path::{Path, PathBuf};

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::jobs_common::read_json;
use super::merged_reading::{seed_document, seed_range_job, state_with_real_pipeline};
use crate::app::build_app;

async fn call(app: &axum::Router, method: &str, uri: &str, body: Value) -> (StatusCode, Value) {
    let response = app
        .clone()
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
        .unwrap();
    let status = response.status();
    (status, read_json(response).await)
}

async fn export(app: &axum::Router, body: Value) -> Value {
    let (status, value) = call(app, "POST", "/api/v1/book-folder/export", body).await;
    assert_eq!(status, StatusCode::OK, "{value}");
    value["data"].clone()
}

fn book_dirs(books: &Path) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = fs::read_dir(books)
        .unwrap()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect();
    dirs.sort();
    dirs
}

fn all_text(dir: &Path) -> String {
    let mut files: Vec<PathBuf> = fs::read_dir(dir.join("text")).unwrap().filter_map(Result::ok).map(|e| e.path()).collect();
    files.sort();
    files.iter().map(|path| fs::read_to_string(path).unwrap()).collect::<Vec<_>>().join("")
}

fn meta(dir: &Path) -> Value {
    serde_json::from_slice(&fs::read(dir.join("meta.json")).unwrap()).unwrap()
}

#[tokio::test]
async fn merged_reading_anchors_point_back_at_the_job_that_has_the_page() {
    let state = state_with_real_pipeline("book-folder-merged");
    let books = state.config.data_root.join("books");
    let document_id = seed_document(&state, &["SRC 1", "SRC 2", "SRC 3", "SRC 4"]);
    seed_range_job(&state, &document_id, "job-a", "2026-10-01T00:00:00", &[1], &["ZH 1"]);
    seed_range_job(&state, &document_id, "job-mid", "2026-10-02T00:00:00", &[3, 4], &["ZH 3", "ZH 4"]);
    let app = build_app(state);

    let view = export(&app, json!({})).await;
    assert_eq!(view["exported"], 1, "{view}");
    assert_eq!(view["failed"], json!([]), "{view}");
    let dirs = book_dirs(&books);
    assert_eq!(dirs.len(), 1, "{dirs:?}");
    let dir = &dirs[0];
    assert!(dir.file_name().unwrap().to_string_lossy().ends_with(&format!("-{}", &document_id[..8])));

    let text = all_text(dir);
    // 合并目录里第 3 页的块叫 p003-b0001；真正有它的是 job-mid 的本地第 1 页。
    assert!(text.contains("<!-- p001-b0001 job=job-a page=1 -->\nsource of ZH 1\n\n> ZH 1\n"), "{text}");
    assert!(text.contains("<!-- p001-b0001 job=job-mid page=3 -->\nsource of ZH 3\n\n> ZH 3\n"), "{text}");
    assert!(text.contains("<!-- p002-b0001 job=job-mid page=4 -->"), "{text}");
    assert!(!text.contains("merged-"), "锚点不能指向只读的虚拟任务：{text}");

    let meta = meta(dir);
    assert_eq!(meta["document_id"], document_id);
    assert_eq!(meta["reading"]["merged"], true);
    assert_eq!(meta["reading"]["contributing_job_ids"], json!(["job-a", "job-mid"]));
    assert!(fs::read_to_string(dir.join("toc.md")).unwrap().contains("`text/"));
    #[cfg(unix)]
    assert!(fs::symlink_metadata(dir.join("source.pdf")).unwrap().file_type().is_symlink());
    let library = fs::read_to_string(books.join("library.md")).unwrap();
    assert!(library.contains(&format!("`{}/`", dir.file_name().unwrap().to_string_lossy())), "{library}");
    assert!(books.join("README.md").is_file());

    // 什么都没变：不重写。
    let again = export(&app, json!({ "document_ids": [document_id] })).await;
    assert_eq!((again["exported"].clone(), again["unchanged"].clone()), (json!(0), json!(1)), "{again}");
}

#[tokio::test]
async fn a_book_without_translation_exports_its_source_text() {
    let state = state_with_real_pipeline("book-folder-source-only");
    let data_root = state.config.data_root.clone();
    let document_id = seed_document(&state, &["SRC 1", "SRC 2"]);
    seed_range_job(&state, &document_id, "job-ocr", "2026-10-01T00:00:00", &[1, 2], &["ZH 1", "ZH 2"]);
    // 没有译文 PDF：不算可读的译文，阅读入口给不出任务，只能补原文。
    fs::remove_dir_all(data_root.join("jobs/job-ocr/rendered")).unwrap();
    let app = build_app(state);

    let view = export(&app, json!({})).await;
    assert_eq!(view["exported"], 1, "{view}");
    let dir = &book_dirs(&data_root.join("books"))[0];
    let text = all_text(dir);
    assert!(text.contains("<!-- p002-b0001 job=job-ocr page=2 -->\nsource of ZH 2\n"), "{text}");
    assert!(!text.contains("> ZH"), "只导出原文：{text}");
    let meta = meta(dir);
    assert!(meta["reading"].is_null(), "{meta}");
    assert_eq!(meta["source_only_job_id"], "job-ocr");
    let library = fs::read_to_string(data_root.join("books/library.md")).unwrap();
    assert!(library.contains("只有原文"), "{library}");
}

#[tokio::test]
async fn renamed_deleted_and_unknown_books_are_handled() {
    let state = state_with_real_pipeline("book-folder-lifecycle");
    let books = state.config.data_root.join("books");
    let document_id = seed_document(&state, &["SRC 1"]);
    seed_range_job(&state, &document_id, "job-x", "2026-10-01T00:00:00", &[1], &["ZH 1"]);
    let app = build_app(state);

    assert_eq!(export(&app, json!({})).await["exported"], 1);
    let before = book_dirs(&books);
    assert_eq!(before.len(), 1);
    // 一本已经不在书库里的书留下的文件夹。
    fs::create_dir_all(books.join("gone-deadbeef")).unwrap();
    fs::write(books.join("gone-deadbeef/meta.json"), json!({ "document_id": "deadbeef00" }).to_string()).unwrap();

    let (status, _) = call(&app, "PATCH", &format!("/api/v1/documents/{document_id}"), json!({ "title": "../New Title" })).await;
    assert_eq!(status, StatusCode::OK);
    let view = export(&app, json!({})).await;
    assert_eq!(view["exported"], 1, "{view}");
    assert_eq!(view["removed"], 2, "改名留下的旧文件夹、已删的书的文件夹：{view}");
    let after = book_dirs(&books);
    assert_eq!(after.len(), 1, "{after:?}");
    assert_eq!(after[0].file_name().unwrap().to_string_lossy(), format!("New-Title-{}", &document_id[..8]));

    let view = export(&app, json!({ "document_ids": ["nope"] })).await;
    assert_eq!(view["failed"][0]["document_id"], "nope", "{view}");
    assert_eq!(view["documents"], 0);

    let (status, _) = call(&app, "POST", "/api/v1/book-folder/export", json!({ "unknown": 1 })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn a_book_with_nothing_recognised_is_only_listed() {
    let state = state_with_real_pipeline("book-folder-empty");
    let books = state.config.data_root.join("books");
    seed_document(&state, &["SRC 1"]);
    let app = build_app(state);

    let view = export(&app, json!({})).await;
    assert_eq!((view["exported"].clone(), view["empty"].clone()), (json!(0), json!(1)), "{view}");
    assert!(book_dirs(&books).is_empty());
    let library = fs::read_to_string(books.join("library.md")).unwrap();
    assert!(library.contains("book.pdf") || library.contains("| book"), "{library}");
    assert!(library.contains("还没识别"), "{library}");
}
