//! 端到端：一本书的多次范围翻译 → `/documents/:id/reading` 给出合并结果的虚拟任务 id →
//! 阅读器调用的读接口都认它，写接口都拒绝它。调用真正的 `retainpdf-pipeline`。

use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::jobs_common::{read_json, test_state};
use crate::app::{build_app, build_state};
use crate::config::AppConfig;
use crate::db::documents::sha256_hex;
use crate::models::domain::{
    now_iso, CreateJobInput, JobArtifacts, JobSnapshot, JobStatusKind, UploadRecord, WorkflowKind,
};
use crate::test_support::python::project_venv_bin as venv_bin;

fn make_pdf(path: &Path, texts: &[&str]) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    let output = Command::new(venv_bin("python"))
        .arg("-c")
        .arg(
            "import sys, fitz\n\
             doc = fitz.open()\n\
             for t in sys.argv[2:]:\n    doc.new_page(width=595, height=842).insert_text((72, 100), t, fontsize=24)\n\
             doc.save(sys.argv[1])",
        )
        .arg(path)
        .args(texts)
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
}

fn pdf_texts(bytes: &[u8]) -> String {
    let file = std::env::temp_dir().join(format!("merged-reading-{:016x}.pdf", fastrand::u64(..)));
    fs::write(&file, bytes).unwrap();
    let output = Command::new(venv_bin("python"))
        .arg("-c")
        .arg("import sys, fitz\nprint('|'.join(p.get_text().strip() for p in fitz.open(sys.argv[1])))")
        .arg(&file)
        .output()
        .unwrap();
    let _ = fs::remove_file(&file);
    String::from_utf8(output.stdout).unwrap().trim().to_string()
}

pub(super) fn state_with_real_pipeline(name: &str) -> crate::AppState {
    let base = test_state(name);
    let config = AppConfig {
        pipeline_command: venv_bin("retainpdf-pipeline").to_string_lossy().into_owned(),
        ..(*base.config).clone()
    };
    build_state(Arc::new(config)).expect("build state")
}

pub(super) fn seed_document(state: &crate::AppState, pages: &[&str]) -> String {
    let source = state.config.data_root.join("uploads/up-1/book.pdf");
    make_pdf(&source, pages);
    let bytes = fs::read(&source).unwrap();
    let hash = sha256_hex(&bytes);
    let upload = UploadRecord {
        upload_id: "up-1".to_string(),
        filename: "book.pdf".to_string(),
        stored_path: source.to_string_lossy().to_string(),
        bytes: bytes.len() as u64,
        page_count: pages.len() as u32,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: hash.clone(),
    };
    state.db.save_upload(&upload).unwrap();
    state.db.upsert_document_from_upload(&upload).unwrap();
    hash
}

/// 一个子集 OCR 的范围翻译任务（页号全是本地的，和流水线真实产出一致）。
pub(super) fn seed_range_job(
    state: &crate::AppState,
    document_id: &str,
    job_id: &str,
    created_at: &str,
    document_pages: &[u32],
    texts: &[&str],
) {
    let job_root = state.config.data_root.join("jobs").join(job_id);
    let translated = job_root.join("translated");
    fs::create_dir_all(&translated).unwrap();
    let mut manifest_pages = Vec::new();
    let mut ocr_pages = Vec::new();
    for (local, text) in texts.iter().enumerate() {
        let file = format!("page-{:03}-deepseek.json", local + 1);
        fs::write(
            translated.join(&file),
            json!([{
                "item_id": format!("p{:03}-b001", local + 1),
                "page_idx": local,
                "bbox": [72.0, 80.0, 300.0, 120.0],
                "translated_text": text,
                "final_status": "translated",
            }])
            .to_string(),
        )
        .unwrap();
        manifest_pages.push(json!({ "page_index": local, "page_number": local + 1, "path": file }));
        ocr_pages.push(json!({
            "page_index": local, "page": local + 1, "width": 595, "height": 842,
            "blocks": [{
                "block_id": format!("p{:03}-b0001", local + 1),
                "page_index": local,
                "bbox": [72.0, 80.0, 300.0, 120.0],
                "source_text": format!("source of {text}"),
                "block_kind": "text",
            }],
        }));
    }
    fs::write(
        translated.join("translation-manifest.json"),
        json!({ "schema": "translation_manifest_v1", "pages": manifest_pages }).to_string(),
    )
    .unwrap();
    fs::create_dir_all(job_root.join("ocr/normalized")).unwrap();
    fs::write(
        job_root.join("ocr/normalized/document.v1.json"),
        json!({ "schema": "normalized_document_v1", "pages": ocr_pages }).to_string(),
    )
    .unwrap();
    make_pdf(&job_root.join("rendered/out.pdf"), texts);
    fs::create_dir_all(job_root.join("md/images")).unwrap();
    fs::write(job_root.join("md/full.md"), format!("# source markdown of {job_id}\n")).unwrap();

    let mut job = JobSnapshot::new(job_id.to_string(), CreateJobInput::default(), vec![]);
    job.status = JobStatusKind::Succeeded;
    job.workflow = WorkflowKind::Book;
    job.created_at = created_at.to_string();
    job.request_payload.translation.start_page = 0;
    job.request_payload.translation.end_page = -1;
    job.artifacts = Some(JobArtifacts {
        job_root: Some(format!("jobs/{job_id}")),
        output_pdf: Some(format!("jobs/{job_id}/rendered/out.pdf")),
        translations_dir: Some(format!("jobs/{job_id}/translated")),
        normalized_document_json: Some(format!("jobs/{job_id}/ocr/normalized/document.v1.json")),
        source_pdf: Some("uploads/up-1/book.pdf".to_string()),
        ocr_page_numbers: document_pages.to_vec(),
        ..JobArtifacts::default()
    });
    job.sync_runtime_state();
    state.db.save_job(&job).unwrap();
    let conn = rusqlite::Connection::open(&state.config.jobs_db_path).unwrap();
    conn.execute(
        "UPDATE jobs SET document_id = ?1 WHERE job_id = ?2",
        rusqlite::params![document_id, job_id],
    )
    .unwrap();
}

async fn request(app: &axum::Router, method: &str, uri: &str) -> axum::response::Response {
    app.clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(uri)
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(if method == "POST" { "{}" } else { "" }))
                .unwrap(),
        )
        .await
        .unwrap()
}

async fn reading(app: &axum::Router, document_id: &str) -> Value {
    let response = request(app, "GET", &format!("/api/v1/documents/{document_id}/reading")).await;
    assert_eq!(response.status(), StatusCode::OK);
    read_json(response).await["data"].clone()
}

#[tokio::test]
async fn two_range_translations_open_as_one_full_length_book() {
    let state = state_with_real_pipeline("merged-reading");
    let data_root = state.config.data_root.clone();
    let document_id = seed_document(&state, &["SRC 1", "SRC 2", "SRC 3", "SRC 4"]);
    // 第 1 页一次，第 3-4 页一次 —— 两个任务各自的「第 1 页」都叫 p001。
    seed_range_job(&state, &document_id, "job-a", "2026-10-01T00:00:00", &[1], &["ZH 1"]);
    seed_range_job(&state, &document_id, "job-mid", "2026-10-02T00:00:00", &[3, 4], &["ZH 3", "ZH 4"]);
    let app = build_app(state);

    let view = reading(&app, &document_id).await;
    assert_eq!(view["merged"], true);
    assert_eq!(view["contributing_job_ids"], json!(["job-a", "job-mid"]));
    let job_id = view["job_id"].as_str().unwrap().to_string();
    assert!(job_id.starts_with("merged-"), "{job_id}");

    // 阅读器 / AI 服务：按任务 id 反查文档
    let by_job = request(&app, "GET", &format!("/api/v1/documents?job_id={job_id}")).await;
    assert_eq!(by_job.status(), StatusCode::OK);
    let by_job = read_json(by_job).await;
    assert_eq!(by_job["data"]["documents"][0]["document_id"], document_id);
    assert_eq!(by_job["data"]["total"], 1);

    // 阅读器：任务详情
    let detail = request(&app, "GET", &format!("/api/v1/jobs/{job_id}")).await;
    assert_eq!(detail.status(), StatusCode::OK);
    assert_eq!(read_json(detail).await["data"]["job_id"], job_id);

    // 阅读器：译文 PDF —— 整本长度，没翻的页是原文
    let pdf = request(&app, "GET", &format!("/api/v1/jobs/{job_id}/files/output/translated.pdf")).await;
    assert_eq!(pdf.status(), StatusCode::OK);
    let bytes = to_bytes(pdf.into_body(), usize::MAX).await.unwrap();
    assert_eq!(pdf_texts(&bytes), "ZH 1|SRC 2|ZH 3|ZH 4");

    // 阅读器：选区 —— 页号是文档页号
    let regions = request(&app, "GET", &format!("/api/v1/jobs/{job_id}/reader/regions")).await;
    assert_eq!(regions.status(), StatusCode::OK);
    let regions = read_json(regions).await;
    let mut pages: Vec<(i64, String)> = regions["data"]["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| {
            (item["translated"]["page"].as_i64().unwrap(), item["translated"]["text"].as_str().unwrap().to_string())
        })
        .collect();
    pages.sort();
    assert_eq!(
        pages,
        vec![(1, "ZH 1".to_string()), (3, "ZH 3".to_string()), (4, "ZH 4".to_string())]
    );

    // 阅读器：Markdown 原文 —— 两个子集 OCR 按起始页拼起来
    let markdown = request(&app, "GET", &format!("/api/v1/jobs/{job_id}/files/output/ocr.md")).await;
    assert_eq!(markdown.status(), StatusCode::OK);
    let markdown = String::from_utf8(to_bytes(markdown.into_body(), usize::MAX).await.unwrap().to_vec()).unwrap();
    let (a, mid) = (markdown.find("of job-a"), markdown.find("of job-mid"));
    assert!(a.is_some() && mid.is_some() && a < mid, "{markdown}");

    // 阅读器：元数据（页数、页面尺寸）
    let metadata = request(&app, "GET", &format!("/api/v1/jobs/{job_id}/reader/metadata")).await;
    assert_eq!(metadata.status(), StatusCode::OK);

    // 写操作一律拒绝：虚拟 id 不在数据库里
    for action in ["cancel", "rerun"] {
        let response = request(&app, "POST", &format!("/api/v1/jobs/{job_id}/actions/{action}")).await;
        assert!(
            response.status().is_client_error(),
            "{action} 对虚拟任务返回了 {}",
            response.status()
        );
    }

    // 不该在 jobs/ 下凭空多出一个假任务目录
    let stray: Vec<_> = fs::read_dir(data_root.join("jobs"))
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|name| name.starts_with("merged-"))
        .collect();
    assert!(stray.is_empty(), "jobs/ 下多了: {stray:?}");

    // 再问一次：同一个虚拟 id（命中缓存）
    assert_eq!(reading(&app, &document_id).await["job_id"], job_id);
}

#[tokio::test]
async fn a_newer_range_translation_takes_over_its_pages() {
    let state = state_with_real_pipeline("merged-reading-newer");
    let document_id = seed_document(&state, &["SRC 1", "SRC 2"]);
    seed_range_job(&state, &document_id, "job-whole", "2026-10-01T00:00:00", &[1, 2], &["OLD 1", "OLD 2"]);
    seed_range_job(&state, &document_id, "job-redo", "2026-10-02T00:00:00", &[2], &["NEW 2"]);
    let app = build_app(state);
    let job_id = reading(&app, &document_id).await["job_id"].as_str().unwrap().to_string();
    let pdf = request(&app, "GET", &format!("/api/v1/jobs/{job_id}/files/output/translated.pdf")).await;
    let bytes = to_bytes(pdf.into_body(), usize::MAX).await.unwrap();
    assert_eq!(pdf_texts(&bytes), "OLD 1|NEW 2");
}

#[tokio::test]
async fn one_job_covering_the_whole_book_is_opened_directly() {
    let state = state_with_real_pipeline("merged-reading-single");
    let document_id = seed_document(&state, &["SRC 1", "SRC 2"]);
    seed_range_job(&state, &document_id, "job-whole", "2026-10-01T00:00:00", &[1, 2], &["ZH 1", "ZH 2"]);
    let app = build_app(state);
    let view = reading(&app, &document_id).await;
    assert_eq!(view, json!({ "job_id": "job-whole", "merged": false, "contributing_job_ids": ["job-whole"] }));
}

#[tokio::test]
async fn a_book_with_no_translation_has_nothing_to_open() {
    let state = state_with_real_pipeline("merged-reading-none");
    let document_id = seed_document(&state, &["SRC 1"]);
    let app = build_app(state);
    let view = reading(&app, &document_id).await;
    assert_eq!(view, json!({ "job_id": null, "merged": false, "contributing_job_ids": [] }));
}

#[tokio::test]
async fn an_unknown_merged_id_is_not_found() {
    let state = test_state("merged-reading-unknown");
    let app = build_app(state);
    let bogus = format!("merged-{}-0123456789abcdef", "a".repeat(64));
    let response = request(&app, "GET", &format!("/api/v1/jobs/{bogus}")).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn translation_coverage_reports_pages_per_job_without_building_a_merge() {
    let state = state_with_real_pipeline("merged-reading-coverage");
    let data_root = state.config.data_root.clone();
    let document_id = seed_document(&state, &["SRC 1", "SRC 2", "SRC 3", "SRC 4"]);
    seed_range_job(&state, &document_id, "job-whole", "2026-10-01T00:00:00", &[1, 2, 3], &["A1", "A2", "A3"]);
    // 后来专门重翻第 3 页，并新翻第 4 页。
    seed_range_job(&state, &document_id, "job-redo", "2026-10-02T00:00:00", &[3, 4], &["B3", "B4"]);
    let app = build_app(state);

    let response = request(&app, "GET", &format!("/api/v1/documents/{document_id}/translation-coverage")).await;
    assert_eq!(response.status(), StatusCode::OK);
    let view = read_json(response).await["data"].clone();
    assert_eq!(view["page_count"], 4);
    assert_eq!(view["translated_pages"], 4);
    assert_eq!(view["contributing_jobs"], 2);
    assert_eq!(
        view["segments"],
        json!([
            { "first": 1, "last": 2, "job_id": "job-whole" },
            { "first": 3, "last": 4, "job_id": "job-redo" },
        ])
    );
    let jobs = view["jobs"].as_array().unwrap();
    assert_eq!(jobs[0]["job_id"], "job-redo", "任务记录应新到旧");
    assert_eq!(jobs[0]["pages"], json!([3, 4]));
    assert_eq!(jobs[0]["supplied_pages"], 2);
    assert_eq!(jobs[1]["job_id"], "job-whole");
    assert_eq!(jobs[1]["pages"], json!([1, 2, 3]), "它翻过 3 页");
    assert_eq!(jobs[1]["supplied_pages"], 2, "但第 3 页被后来的翻译盖掉了");

    // 只计算、不生成：打开详情页不该触发一次合并。
    assert!(!data_root.join("documents").join(&document_id).join("merged").exists(), "覆盖接口生成了合并目录");
}

/// 合并目录被清理（超过一天没人读）以后，拿着旧虚拟 id 的阅读器：404 带
/// `merged_reading_expired`，和「任务被删了」分得开；重新问一次阅读入口就能接着读。
#[tokio::test]
async fn a_cleaned_up_merged_reading_says_so_and_reopening_works() {
    let state = state_with_real_pipeline("merged-reading-expired");
    let data_root = state.config.data_root.clone();
    let document_id = seed_document(&state, &["SRC 1", "SRC 2"]);
    seed_range_job(&state, &document_id, "job-a", "2026-10-01T00:00:00", &[1], &["ZH 1"]);
    let app = build_app(state);
    let job_id = reading(&app, &document_id).await["job_id"].as_str().unwrap().to_string();
    let merged = data_root.join("documents").join(&document_id).join("merged");
    let root = fs::read_dir(&merged).unwrap().next().unwrap().unwrap().path();
    fs::remove_dir_all(&root).unwrap();

    let response = request(&app, "GET", &format!("/api/v1/jobs/{job_id}")).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_json(response).await;
    assert_eq!(body["error"]["details"]["reason"], "merged_reading_expired", "{body}");
    assert_eq!(body["message"], format!("job not found: {job_id}"));

    // 真正不存在的普通任务仍然是不带 reason 的 404。
    let missing = read_json(request(&app, "GET", "/api/v1/jobs/no-such-job").await).await;
    assert_eq!(missing["error"]["details"], json!({}));

    let reopened = reading(&app, &document_id).await["job_id"].as_str().unwrap().to_string();
    let detail = request(&app, "GET", &format!("/api/v1/jobs/{reopened}")).await;
    assert_eq!(detail.status(), StatusCode::OK);
}

/// 翻译覆盖和阅读入口的页数来源要一致。以前覆盖用 `documents.page_count`、阅读入口数原文
/// PDF：老数据没记页数（0）时，覆盖说「0 页、什么都没翻」，阅读器却照常打开整本合并。
#[tokio::test]
async fn coverage_and_reading_count_the_book_the_same_way() {
    let state = state_with_real_pipeline("merged-reading-page-count");
    let document_id = seed_document(&state, &["SRC 1", "SRC 2", "SRC 3"]);
    seed_range_job(&state, &document_id, "job-a", "2026-10-01T00:00:00", &[1], &["ZH 1"]);
    let conn = rusqlite::Connection::open(&state.config.jobs_db_path).unwrap();
    conn.execute(
        "UPDATE documents SET page_count = 0 WHERE document_id = ?1",
        rusqlite::params![document_id],
    )
    .unwrap();
    let app = build_app(state);

    let response = request(&app, "GET", &format!("/api/v1/documents/{document_id}/translation-coverage")).await;
    assert_eq!(response.status(), StatusCode::OK);
    let coverage = read_json(response).await["data"].clone();
    assert_eq!(coverage["page_count"], 3, "{coverage}");
    assert_eq!(
        coverage["segments"],
        json!([
            { "first": 1, "last": 1, "job_id": "job-a" },
            { "first": 2, "last": 3, "job_id": null },
        ])
    );
    let view = reading(&app, &document_id).await;
    assert_eq!(view["merged"], true);
    assert_eq!(view["contributing_job_ids"], json!(["job-a"]));
}
