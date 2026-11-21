//! 备份接口:立即备份、列表、恢复(有任务在跑时不恢复)、删除。

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use serde_json::Value;
use tower::util::ServiceExt;

use super::jobs_common::{read_json, test_state};
use crate::app::build_app;

async fn call(state: &crate::AppState, method: &str, uri: &str) -> (StatusCode, Value) {
    let request = Request::builder()
        .method(method)
        .uri(uri)
        .header("X-API-Key", "test-key")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::empty())
        .expect("request");
    let response = build_app(state.clone()).oneshot(request).await.expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

fn sql(state: &crate::AppState, statement: &str) {
    let conn = rusqlite::Connection::open(state.db.path()).expect("open db");
    conn.execute_batch(statement).expect("sql");
}

fn title(state: &crate::AppState) -> Option<String> {
    let conn = rusqlite::Connection::open(state.db.path()).expect("open db");
    conn.query_row("SELECT title FROM documents WHERE document_id = 'd1'", [], |row| row.get(0)).ok()
}

#[tokio::test]
async fn back_up_now_then_restore_brings_the_library_back_and_keeps_a_safety_copy() {
    let state = test_state("backup-restore");
    state.db.init().expect("init");
    let (status, body) = call(&state, "GET", "/api/v1/backups").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["items"].as_array().map(Vec::len), Some(0));
    assert_eq!(body["data"]["auto_interval_hours"], 24);
    assert!(body["data"]["last_restore"].is_null(), "{body}");

    sql(&state, "INSERT INTO documents(document_id, title, source_filename, added_at, updated_at) VALUES('d1', 'Before', 'a.pdf', 't', 't');");
    let (status, made) = call(&state, "POST", "/api/v1/backups").await;
    assert_eq!(status, StatusCode::OK, "{made}");
    assert_eq!(made["data"]["kind"], "manual");
    let id = made["data"]["id"].as_str().expect("id").to_string();
    sql(&state, "UPDATE documents SET title = 'After' WHERE document_id = 'd1';");

    // 有任务在跑:不恢复,说明在等什么。
    sql(&state, "INSERT INTO jobs(job_id, workflow, status, created_at, updated_at, command_json, request_json, log_tail_json)
                 VALUES('j1', 'book', 'running', 't', 't', '[]', '{}', '[]');");
    let (status, body) = call(&state, "POST", &format!("/api/v1/backups/{id}/restore")).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body["message"].as_str().unwrap_or("").contains("任务"), "{body}");
    assert_eq!(body["error"]["details"]["reason"], "restore_blocked", "{body}");
    assert_eq!(title(&state).as_deref(), Some("After"));
    sql(&state, "UPDATE jobs SET status = 'succeeded' WHERE job_id = 'j1';");

    let (status, body) = call(&state, "POST", &format!("/api/v1/backups/{id}/restore")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(title(&state).as_deref(), Some("Before"));
    assert_eq!(body["data"]["restored"], id.as_str());
    let safety = body["data"]["safety_backup"].as_str().expect("safety").to_string();
    assert!(safety.starts_with("before-restore-"), "{safety}");
    assert_eq!(body["data"]["status"]["items"].as_array().map(Vec::len), Some(2));
    assert_eq!(body["data"]["status"]["running"], false, "{body}");
    let last = &body["data"]["status"]["last_restore"];
    assert_eq!((last["backup_id"].as_str(), last["ok"].as_bool()), (Some(id.as_str()), Some(true)), "{body}");
    assert_eq!(last["safety_backup"], safety.as_str());

    // 恢复错了:用恢复前那份退回。
    let (status, _) = call(&state, "POST", &format!("/api/v1/backups/{safety}/restore")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(title(&state).as_deref(), Some("After"));

    let (status, _) = call(&state, "POST", "/api/v1/backups/manual-20200101T000000000Z-v1/restore").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, body) = call(&state, "DELETE", &format!("/api/v1/backups/{id}")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body["data"]["items"].as_array().expect("items").iter().all(|b| b["id"] != id.as_str()));
    let (status, _) = call(&state, "DELETE", &format!("/api/v1/backups/{id}")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

/// 回归：备份时恰好有任务在运行（自动备份每天一次，很常见），恢复后库里又是 running，
/// 却没有任何 driver——以前要等到下次重启才有人对账，期间一直转圈、rerun 409，
/// 下次重启还会拿备份里的旧 pid 去当孤儿进程杀。现在恢复完立即对账：
/// 旧 pid 清掉（不杀），没有可续的 attempt 的按启动恢复的规则落失败。
#[tokio::test]
async fn a_restore_reconciles_jobs_that_were_running_when_the_backup_was_taken() {
    let state = test_state("backup-restore-reconcile");
    state.db.init().expect("init");
    let mut busy = crate::models::domain::JobSnapshot::new(
        "j-busy".to_string(),
        crate::models::CreateJobInput::default(),
        vec![],
    );
    busy.status = crate::models::domain::JobStatusKind::Running;
    busy.pid = Some(4242);
    state.db.save_job(&busy).expect("save job");
    let (status, made) = call(&state, "POST", "/api/v1/backups").await;
    assert_eq!(status, StatusCode::OK, "{made}");
    let id = made["data"]["id"].as_str().expect("id").to_string();
    // 备份之后这个任务结束了，所以现在可以恢复。
    sql(&state, "UPDATE jobs SET status = 'succeeded', pid = NULL WHERE job_id = 'j-busy';");

    let (status, body) = call(&state, "POST", &format!("/api/v1/backups/{id}/restore")).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let job = state.db.get_job("j-busy").expect("job");
    assert_ne!(job.status, crate::models::domain::JobStatusKind::Running, "恢复后不能留下没人管的 running 任务");
    assert_eq!(job.status, crate::models::domain::JobStatusKind::Failed, "没有可续的 attempt：按启动恢复的规则落失败");
    assert_eq!(job.pid, None, "备份里的 pid 不属于当前进程");
    let failure = job.failure.as_ref().expect("failure");
    assert_eq!(failure.failure_code.as_deref(), Some("worker_process_missing"));
}

/// 坏备份、来自新版本的备份 2026-10-22 起回 409（以前 400）带 `reason`；被拒的恢复记进
/// `last_restore`，不存恢复前备份。
#[tokio::test]
async fn a_damaged_backup_is_a_conflict_with_a_reason_and_leaves_no_safety_copy() {
    let state = test_state("backup-damaged");
    state.db.init().expect("init");
    let dir = state.db.backups_dir();
    std::fs::create_dir_all(&dir).expect("dir");
    let damaged = "manual-20261009T120000000Z-v19";
    std::fs::write(dir.join(format!("{damaged}.db.gz")), b"not gzip").expect("write");
    let (status, body) = call(&state, "POST", &format!("/api/v1/backups/{damaged}/restore")).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert_eq!(body["error"]["details"]["reason"], "backup_damaged", "{body}");
    assert!(body["message"].as_str().unwrap_or("").contains("损坏"), "{body}");
    let (_, listed) = call(&state, "GET", "/api/v1/backups").await;
    let items = listed["data"]["items"].as_array().expect("items");
    assert!(items.iter().all(|b| b["kind"] != "before-restore"), "{listed}");
    let last = &listed["data"]["last_restore"];
    assert_eq!(last["ok"], false, "{listed}");
    assert_eq!(last["reason"], "backup_damaged");
    assert!(last["safety_backup"].is_null());
}
