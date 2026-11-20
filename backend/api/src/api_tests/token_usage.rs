//! /api/v1/usage、/api/v1/jobs/:id/reports/usage、/api/v1/documents/:id/usage 经真实路由。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, seed_legacy_layout_job, seed_virtual_job, test_state};
use crate::app::build_app;
use crate::models::domain::{now_iso, UploadRecord};
use crate::models::{CreateJobInput, JobSnapshot};

async fn get(state: &crate::AppState, uri: &str) -> axum::response::Response {
    build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(uri)
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response")
}

#[tokio::test]
async fn usage_routes_summarize_the_job_ledgers() {
    let state = test_state("token-usage-routes");
    let job = JobSnapshot::new("job-usage".to_string(), CreateJobInput::default(), vec![]);
    state.db.save_job(&job).expect("save job");
    let ledger = crate::services::jobs::job_usage_ledger_path(&state.config.output_root, "job-usage");
    std::fs::create_dir_all(ledger.parent().unwrap()).unwrap();
    std::fs::write(
        &ledger,
        concat!(
            r#"{"ts":"2026-10-10T00:00:00Z","stage":"translation","model":"m","host":"h","input":120000,"output":30000,"cache_hit":100000,"reasoning":5000}"#,
            "\n",
            r#"{"ts":"2026-10-10T00:01:00Z","stage":"refine_review","model":"m","host":"h","input":1000,"output":10,"cache_hit":null}"#,
            "\n",
        ),
    )
    .unwrap();

    let all = read_json(get(&state, "/api/v1/usage").await).await["data"].clone();
    assert_eq!((all["scope"].as_str(), all["jobs_counted"].as_u64()), (Some("all"), Some(1)));
    assert_eq!(all["totals"]["total_tokens"], 151010);
    assert_eq!(all["totals"]["cache_hit_tokens"], 100000);
    assert_eq!(all["totals"]["cache_reported_input_tokens"], 120000);
    assert_eq!(all["by_stage"][0]["label"], "翻译");

    // 有书没任务：200 空汇总。书不存在是 404（见 library_lookup_errors）。
    let upload = UploadRecord {
        upload_id: "up-without-jobs".to_string(),
        filename: "book.pdf".to_string(),
        stored_path: "uploads/up-without-jobs/book.pdf".to_string(),
        bytes: 1,
        page_count: 1,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: "doc-without-jobs".to_string(),
    };
    state.db.save_upload(&upload).expect("save upload");
    state.db.upsert_document_from_upload(&upload).expect("seed document");
    let document = read_json(get(&state, "/api/v1/documents/doc-without-jobs/usage").await).await["data"].clone();
    assert_eq!((document["scope"].as_str(), document["totals"]["requests"].as_u64()), (Some("document"), Some(0)));
    assert_eq!(get(&state, "/api/v1/documents/doc-missing/usage").await.status(), StatusCode::NOT_FOUND);
}

fn write_ledger(state: &crate::AppState, job_id: &str, input: u64, output: u64) {
    let ledger = crate::services::jobs::job_usage_ledger_path(&state.config.output_root, job_id);
    std::fs::create_dir_all(ledger.parent().unwrap()).unwrap();
    let row = format!(r#"{{"ts":"2026-11-20T00:00:00Z","stage":"translation","model":"m","host":"h","input":{input},"output":{output}}}"#);
    std::fs::write(&ledger, format!("{row}\n")).unwrap();
}

#[tokio::test]
async fn job_usage_counts_only_that_job() {
    let state = test_state("token-usage-job");
    for (job_id, input, output) in [("job-this", 1000, 100), ("job-earlier", 50000, 5000)] {
        let job = JobSnapshot::new(job_id.to_string(), CreateJobInput::default(), vec![]);
        state.db.save_job(&job).expect("save job");
        write_ledger(&state, job_id, input, output);
    }

    let data = read_json(get(&state, "/api/v1/jobs/job-this/reports/usage").await).await["data"].clone();
    assert_eq!(data["scope"], "job");
    assert_eq!((data["jobs_counted"].as_u64(), data["totals"]["total_tokens"].as_u64()), (Some(1), Some(1100)));
    assert_eq!(data["by_stage"][0]["label"], "翻译");
    assert!(data["pricing"].is_object(), "{data}");

    assert_eq!(get(&state, "/api/v1/jobs/job-missing/reports/usage").await.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn job_usage_follows_the_same_loading_rules_as_the_other_job_reads() {
    let state = test_state("token-usage-loading");

    // 合并阅读的虚拟任务认；合并结果自己没有用量账本，给空汇总。
    let (virtual_id, _root) = seed_virtual_job(&state);
    let response = get(&state, &format!("/api/v1/jobs/{virtual_id}/reports/usage")).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(read_json(response).await["data"]["totals"]["requests"], 0);

    // 旧目录格式的任务：409。
    seed_legacy_layout_job(&state, "job-legacy");
    assert_eq!(get(&state, "/api/v1/jobs/job-legacy/reports/usage").await.status(), StatusCode::CONFLICT);

    // 有意保留：库里没有记录、任务目录还在，照样给用量（账本在目录里，删掉记录不丢）。
    write_ledger(&state, "job-dir-only", 10, 5);
    let response = get(&state, "/api/v1/jobs/job-dir-only/reports/usage").await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(read_json(response).await["data"]["totals"]["total_tokens"], 15);

    // 库里没有、目录也没有：404。
    assert_eq!(get(&state, "/api/v1/jobs/job-nowhere/reports/usage").await.status(), StatusCode::NOT_FOUND);
}

async fn post_json(state: &crate::AppState, uri: &str, body: serde_json::Value) -> axum::response::Response {
    build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("request"),
        )
        .await
        .expect("response")
}

/// 查单价、估价（2026-11-19）经真实路由：报错码、空书库、没翻译过的书退回书库平均。算法见任务包 reports/usage 的单测。
#[tokio::test]
async fn price_lookup_and_estimate_routes() {
    use serde_json::json;
    let state = test_state("usage-estimate-routes");

    let response = post_json(&state, "/api/v1/usage/prices", json!({"items": [{"base_url": "https://api.anthropic.com", "model": "claude-haiku-5-5"}]})).await;
    assert_eq!(response.status(), StatusCode::OK);
    let lookup = read_json(response).await["data"].clone();
    assert_eq!((lookup["items"][0]["price_provider"].as_str(), lookup["items"][0]["price"]["input"].as_f64()), (Some("anthropic"), Some(0.1)));
    let too_many: Vec<_> = (0..101).map(|_| json!({"base_url": "https://api.anthropic.com", "model": "m"})).collect();
    assert_eq!(post_json(&state, "/api/v1/usage/prices", json!({"items": too_many})).await.status(), StatusCode::BAD_REQUEST);
    assert_eq!(post_json(&state, "/api/v1/usage/prices", json!({"items": [], "x": 1})).await.status(), StatusCode::BAD_REQUEST);

    let ok = "base_url=https://api.deepseek.com/v1&model=deepseek-flash";
    let estimate = read_json(get(&state, &format!("/api/v1/usage/estimate?{ok}&pages=20")).await).await["data"].clone();
    assert_eq!((estimate["basis"].as_str(), estimate["pages"].as_u64(), estimate["price_provider"].as_str()), (Some("none"), Some(20), Some("deepseek")), "书库空：没有参照");
    for bad in ["base_url=api.deepseek.com&model=x&pages=20", &format!("{ok}&pages=0"), &format!("{ok}&pages=20&extra=1"), "model=x&pages=20"] {
        assert_eq!(get(&state, &format!("/api/v1/usage/estimate?{bad}")).await.status(), StatusCode::BAD_REQUEST, "{bad}");
    }

    let upload = UploadRecord {
        upload_id: "up-estimate".to_string(),
        filename: "book.pdf".to_string(),
        stored_path: "uploads/up-estimate/book.pdf".to_string(),
        bytes: 1,
        page_count: 8,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: "doc-estimate".to_string(),
    };
    state.db.save_upload(&upload).expect("save upload");
    state.db.upsert_document_from_upload(&upload).expect("seed document");
    let document = read_json(get(&state, &format!("/api/v1/documents/doc-estimate/usage/estimate?{ok}")).await).await["data"].clone();
    assert_eq!((document["basis"].as_str(), document["pages"].as_u64()), (Some("none"), Some(8)), "没翻译过、书库也空");
    assert_eq!(get(&state, &format!("/api/v1/documents/doc-missing/usage/estimate?{ok}")).await.status(), StatusCode::NOT_FOUND);
    assert_eq!(get(&state, "/api/v1/documents/doc-estimate/usage/estimate?base_url=x&model=y").await.status(), StatusCode::BAD_REQUEST);
}

/// 估价的参照只认成功完成的任务（2026-11-19）：书上最近一次是刚建就取消的任务（只用了一千多 token），估价不能参照它，
/// 要参照更早那次成功的；成功的也没有就退回书库平均。只翻了部分页的按页数放大。
#[tokio::test]
async fn estimates_ignore_cancelled_runs_and_scale_partial_ones() {
    use crate::models::JobStatusKind;
    let state = test_state("usage-estimate-reference");
    let upload = UploadRecord {
        upload_id: "up-ref".to_string(),
        filename: "book.pdf".to_string(),
        stored_path: "uploads/up-ref/book.pdf".to_string(),
        bytes: 1,
        page_count: 20,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: "doc-ref".to_string(),
    };
    state.db.save_upload(&upload).expect("save upload");
    state.db.upsert_document_from_upload(&upload).expect("seed document");
    let seed = |job_id: &str, status: JobStatusKind, page_ranges: &str, ts: &str, input: u64| {
        let mut request = CreateJobInput::default();
        request.ocr.page_ranges = page_ranges.to_string();
        let mut job = JobSnapshot::new(job_id.to_string(), request, vec![]);
        job.status = status;
        state.db.save_job(&job).expect("save job");
        rusqlite::Connection::open(&state.config.jobs_db_path)
            .unwrap()
            .execute("UPDATE jobs SET document_id = 'doc-ref' WHERE job_id = ?1", rusqlite::params![job_id])
            .unwrap();
        let ledger = crate::services::jobs::job_usage_ledger_path(&state.config.output_root, job_id);
        std::fs::create_dir_all(ledger.parent().unwrap()).unwrap();
        std::fs::write(
            &ledger,
            format!(r#"{{"ts":"{ts}","stage":"translation","model":"m","host":"h","input":{input},"output":{},"cache_hit":0}}"#, input / 5) + "\n",
        )
        .unwrap();
    };
    seed("job-done", JobStatusKind::Succeeded, "", "2026-11-19T10:00:00Z", 200_000);
    seed("job-cancelled", JobStatusKind::Canceled, "", "2026-11-19T14:48:00Z", 1_272);
    let uri = "/api/v1/documents/doc-ref/usage/estimate?base_url=https://api.anthropic.com&model=claude-haiku-5-5";
    let estimate = read_json(get(&state, uri).await).await["data"].clone();
    assert_eq!((estimate["basis"].as_str(), estimate["source_job_id"].as_str()), (Some("book_history"), Some("job-done")), "取消的不当参照");
    assert_eq!(estimate["translation"]["input_tokens"], 200_000);

    // 更晚一次只翻了前 10 页（整本 20 页）：参照它，按页数放大一倍
    seed("job-half", JobStatusKind::Succeeded, "1-10", "2026-11-19T16:00:00Z", 50_000);
    let estimate = read_json(get(&state, uri).await).await["data"].clone();
    assert_eq!(estimate["source_job_id"], "job-half");
    assert_eq!(estimate["translation"]["input_tokens"], 100_000);

    // 只翻了 2 页的不当参照
    seed("job-tiny", JobStatusKind::Succeeded, "1-2", "2026-11-19T17:00:00Z", 9_000);
    let estimate = read_json(get(&state, uri).await).await["data"].clone();
    assert_eq!(estimate["source_job_id"], "job-half");
}
