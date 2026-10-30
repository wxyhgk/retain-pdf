//! 删除只处理被删对象自己的缺口（状态一致性审计 1-#5、2-#1/#2/#4、3-#5）：
//!
//! - 强制删除排队 / 运行中的任务，要先走和「取消」同一条路径（登记取消 + 终止进程），再删；
//! - 别的任务还要用被删任务的产物（render 任务的译文目录）时，不带 `force` 一律 409；
//! - 删任务要同时清掉它在全文索引里的行。
//!
//! 这里走真实的 HTTP 路由和真实的 `terminate_job_process_tree`（一个真的 `sleep` 进程），不是只塞库行。

use std::os::unix::process::CommandExt;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use super::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::api::FtsBlockRow;
use crate::models::{now_iso, CreateJobInput, JobSnapshot, JobStatusKind, UploadRecord, WorkflowKind};

const DOCUMENT_ID: &str = "doc-sha-delete-safety";

fn seed_document(state: &crate::AppState) {
    let upload = UploadRecord {
        upload_id: "upload-delete-safety".to_string(),
        filename: "book.pdf".to_string(),
        stored_path: "uploads/upload-delete-safety/book.pdf".to_string(),
        bytes: 1,
        page_count: 1,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: DOCUMENT_ID.to_string(),
    };
    state.db.save_upload(&upload).expect("save upload");
    state.db.upsert_document_from_upload(&upload).expect("seed document");
}

fn seed_job(
    state: &crate::AppState,
    job_id: &str,
    workflow: WorkflowKind,
    status: JobStatusKind,
    pid: Option<u32>,
    source_job: Option<&str>,
) {
    let mut input = CreateJobInput::default();
    input.runtime.job_id = job_id.to_string();
    if let Some(source) = source_job {
        input.source.artifact_job_id = source.to_string();
    }
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()]);
    job.workflow = workflow;
    job.status = status.clone();
    job.pid = pid;
    job.stage = Some(if status == JobStatusKind::Succeeded { "finished" } else { "translating" }.to_string());
    state.db.save_job(&job).expect("save job");
    state.db.set_job_document_id(job_id, DOCUMENT_ID).expect("link job");
    // 输出目录里放一个文件，删除后应当整个消失。
    let dir = state.config.output_root.join(job_id);
    std::fs::create_dir_all(&dir).expect("job dir");
    std::fs::write(dir.join("marker.txt"), b"x").expect("job file");
}

/// 自成进程组的长睡眠进程：和真实 worker 一样，终止走 `kill(-pid)`。
fn spawn_worker() -> Child {
    Command::new("sleep")
        .arg("60")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .process_group(0)
        .spawn()
        .expect("spawn fake worker")
}

fn wait_dead(child: &mut Child) -> bool {
    let deadline = Instant::now() + Duration::from_secs(8);
    while Instant::now() < deadline {
        if child.try_wait().expect("try_wait").is_some() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    let _ = child.kill();
    false
}

async fn delete(state: &crate::AppState, uri: &str) -> (StatusCode, serde_json::Value) {
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(uri)
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("delete request"),
        )
        .await
        .expect("delete response");
    let status = response.status();
    (status, read_json(response).await)
}

async fn cancel_requested(state: &crate::AppState, job_id: &str) -> bool {
    state.canceled_jobs.read().await.contains(job_id)
}

/// 强制删除一本运行中的书：必须先登记取消、杀掉 worker，再删；没有行、目录会回来。
/// 以前强删既不登记取消也不杀进程，worker 继续花钱，runner 下一次落库还把行 INSERT 回来。
#[tokio::test]
async fn force_deleting_a_running_book_cancels_it_and_kills_the_worker() {
    let state = test_state("delete-safety-force-book");
    seed_document(&state);
    let mut worker = spawn_worker();
    seed_job(&state, "job-run", WorkflowKind::Book, JobStatusKind::Running, Some(worker.id()), None);
    // 在跑的 book 任务带着一个 OCR 子任务，它也是 worker 的一部分。
    let mut ocr_worker = spawn_worker();
    seed_job(&state, "job-run-ocr", WorkflowKind::Ocr, JobStatusKind::Running, Some(ocr_worker.id()), None);

    let (status, body) = delete(&state, "/api/v1/jobs/job-run?force=true").await;
    assert_eq!(status, StatusCode::OK, "{body}");

    assert!(cancel_requested(&state, "job-run").await, "强删前必须登记取消，runner 才会收手");
    assert!(cancel_requested(&state, "job-run-ocr").await, "OCR 子任务也要取消");
    assert!(wait_dead(&mut worker), "强删必须终止运行中的 worker 进程");
    assert!(wait_dead(&mut ocr_worker), "强删必须终止 OCR 子任务的进程");
    assert!(state.db.get_job("job-run").is_err());
    assert!(state.db.get_job("job-run-ocr").is_err());
    assert!(!state.config.output_root.join("job-run").exists());
}

/// 不带 force 的删除仍然挡运行中的任务，而且什么都不动：不登记取消、不杀进程。
#[tokio::test]
async fn deleting_a_running_book_without_force_is_refused_and_touches_nothing() {
    let state = test_state("delete-safety-no-force");
    seed_document(&state);
    let mut worker = spawn_worker();
    seed_job(&state, "job-run", WorkflowKind::Book, JobStatusKind::Running, Some(worker.id()), None);

    let (status, _) = delete(&state, "/api/v1/jobs/job-run").await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(!cancel_requested(&state, "job-run").await);
    assert!(worker.try_wait().expect("try_wait").is_none(), "没有 force 不能动进程");
    assert!(state.db.get_job("job-run").is_ok());
    let _ = worker.kill();
    let _ = worker.wait();
}

/// 不带 force 删在跑的书 / 文档：409 带 `error.details.reason = "job_active"`（和任务操作同一个值），
/// 客户端不用再靠「409 且不是 job_has_dependents」去猜。
#[tokio::test]
async fn deleting_with_an_active_job_says_job_active() {
    let state = test_state("delete-safety-job-active-reason");
    seed_document(&state);
    seed_job(&state, "job-run", WorkflowKind::Book, JobStatusKind::Running, None, None);
    seed_job(&state, "job-queued", WorkflowKind::Book, JobStatusKind::Queued, None, None);

    for uri in [
        "/api/v1/jobs/job-run".to_string(),
        "/api/v1/jobs/job-queued".to_string(),
        format!("/api/v1/documents/{DOCUMENT_ID}"),
    ] {
        let (status, body) = delete(&state, &uri).await;
        assert_eq!(status, StatusCode::CONFLICT, "{uri}: {body}");
        assert_eq!(body["error"]["details"]["reason"], "job_active", "{uri}: {body}");
        assert_eq!(body["error"]["code"], "CONFLICT", "{uri}: {body}");
    }
    assert!(state.db.get_job("job-run").is_ok());
    assert!(state.db.get_job("job-queued").is_ok());
}

/// 整本删除（文档）同样：名下运行中的任务要先取消。
#[tokio::test]
async fn force_deleting_a_document_cancels_its_running_jobs() {
    let state = test_state("delete-safety-force-doc");
    seed_document(&state);
    let mut worker = spawn_worker();
    seed_job(&state, "job-run", WorkflowKind::Book, JobStatusKind::Running, Some(worker.id()), None);
    seed_job(&state, "job-queued", WorkflowKind::Book, JobStatusKind::Queued, None, None);

    let (status, body) = delete(&state, &format!("/api/v1/documents/{DOCUMENT_ID}?force=true")).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    assert!(cancel_requested(&state, "job-run").await);
    assert!(cancel_requested(&state, "job-queued").await, "排队中的任务也要取消");
    assert!(wait_dead(&mut worker), "强删文档必须终止名下运行中的 worker");
    assert!(state.db.get_job("job-run").is_err());
    assert!(state.db.get_job("job-queued").is_err());
}

/// 别的任务还引用被删任务的产物（render 任务的译文目录）：不带 force 409 + `job_has_dependents`，
/// 什么都不删。以前照删，之后整本书的 `/reading` 因为合并命令找不到译文目录而 500。
#[tokio::test]
async fn deleting_a_job_that_others_render_from_is_refused() {
    let state = test_state("delete-safety-dependents");
    seed_document(&state);
    seed_job(&state, "job-a", WorkflowKind::Book, JobStatusKind::Succeeded, None, None);
    seed_job(&state, "job-r", WorkflowKind::Render, JobStatusKind::Succeeded, None, Some("job-a"));

    let (status, body) = delete(&state, "/api/v1/jobs/job-a").await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert_eq!(body["error"]["details"]["reason"], "job_has_dependents", "{body}");
    assert!(body["message"].as_str().unwrap_or_default().contains("job-r"), "要说出是谁在引用: {body}");
    assert!(state.db.get_job("job-a").is_ok(), "被拒绝的删除不能删任何东西");
    assert!(state.config.output_root.join("job-a").exists());

    // 先删依赖它的，再删它，就放行。
    let (status, body) = delete(&state, "/api/v1/jobs/job-r").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = delete(&state, "/api/v1/jobs/job-a").await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

/// `force=true` 明确要删就删（依赖者留下，由调用方负责）；整本删除里依赖者本来就在删除范围内，不拦。
#[tokio::test]
async fn dependents_do_not_block_force_or_a_whole_document_delete() {
    let state = test_state("delete-safety-dependents-force");
    seed_document(&state);
    seed_job(&state, "job-a", WorkflowKind::Book, JobStatusKind::Succeeded, None, None);
    seed_job(&state, "job-r", WorkflowKind::Render, JobStatusKind::Succeeded, None, Some("job-a"));
    // 原地重新渲染的任务引用自己，不算被别人依赖。
    seed_job(&state, "job-self", WorkflowKind::Render, JobStatusKind::Succeeded, None, Some("job-self"));

    let (status, body) = delete(&state, "/api/v1/jobs/job-self").await;
    assert_eq!(status, StatusCode::OK, "引用自己不是依赖: {body}");

    let (status, body) = delete(&state, "/api/v1/jobs/job-a?force=true").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(state.db.get_job("job-a").is_err());
    assert!(state.db.get_job("job-r").is_ok());

    seed_job(&state, "job-b", WorkflowKind::Book, JobStatusKind::Succeeded, None, None);
    seed_job(&state, "job-b2", WorkflowKind::Render, JobStatusKind::Succeeded, None, Some("job-b"));
    let (status, body) = delete(&state, &format!("/api/v1/documents/{DOCUMENT_ID}")).await;
    assert_eq!(status, StatusCode::OK, "整本删除范围内的依赖不拦: {body}");
}

/// 删任务要同时清它在全文索引里的行：搜索不能再命中一个已经不存在的任务。
#[tokio::test]
async fn deleting_a_job_removes_its_full_text_rows() {
    let state = test_state("delete-safety-fts");
    seed_document(&state);
    seed_job(&state, "job-a", WorkflowKind::Book, JobStatusKind::Succeeded, None, None);
    seed_job(&state, "job-b", WorkflowKind::Book, JobStatusKind::Succeeded, None, None);
    let row = |text: &str| FtsBlockRow {
        page_idx: 0,
        block_id: "p001-b0000".to_string(),
        source_text: text.to_string(),
        translated_text: format!("{text}译文"),
    };
    state
        .db
        .replace_document_fts_by_job(
            DOCUMENT_ID,
            &[
                ("job-a".to_string(), vec![row("alphaunique")]),
                ("job-b".to_string(), vec![row("betaunique")]),
            ],
        )
        .expect("seed fts");
    assert_eq!(state.db.search_blocks("alphaunique", 10, None).unwrap().len(), 1);

    let (status, body) = delete(&state, "/api/v1/jobs/job-a").await;
    assert_eq!(status, StatusCode::OK, "{body}");

    assert!(
        state.db.search_blocks("alphaunique", 10, None).unwrap().is_empty(),
        "已删任务的全文索引行还在，搜索会命中不存在的任务"
    );
    let hits = state.db.search_blocks("betaunique", 10, None).unwrap();
    assert!(hits.iter().all(|hit| hit.job_id != "job-a"));
}

/// 回归（状态审计 1-#9）：库里记的 pid 已经不是这个任务的 worker（身份对不上：worker 退出了、号被
/// 别的进程复用，库里的 pid 还没清）。取消和强制删除都只清 pid、把任务落终态，不许去杀那个进程。
#[cfg(any(target_os = "linux", target_os = "macos"))]
#[tokio::test]
async fn cancel_and_force_delete_spare_a_process_that_reused_the_recorded_pid() {
    let state = test_state("delete-safety-reused-pid");
    seed_document(&state);
    let mut stranger = spawn_worker();
    let pid = stranger.id();
    for job_id in ["job-cancel-reused", "job-delete-reused"] {
        seed_job(&state, job_id, WorkflowKind::Translate, JobStatusKind::Running, Some(pid), None);
        state
            .db
            .record_worker_identity(job_id, Some(&format!("{pid}@darwin:1.000000")))
            .expect("record forged identity");
    }

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs/job-cancel-reused/actions/cancel")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("cancel request"),
        )
        .await
        .expect("cancel response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        state.db.get_job("job-cancel-reused").expect("job").status,
        JobStatusKind::Canceled
    );

    let (status, body) = delete(&state, "/api/v1/jobs/job-delete-reused?force=true").await;
    assert_eq!(status, StatusCode::OK, "{body}");

    std::thread::sleep(Duration::from_millis(300));
    assert!(
        stranger.try_wait().expect("try_wait").is_none(),
        "取消 / 强删把复用了这个 pid 的别的进程杀掉了"
    );
    let _ = stranger.kill();
    let _ = stranger.wait();
}

// ---- DELETE /api/v1/jobs/:job_id（2026-10-19，书库接口审计 A1）----
//
// 删一个任务：任务本身 + 它的 `-ocr` 子任务，书（文档行、上传、原文）留着。规则和以前的书架删除
// （`DELETE /library/books/:job_id`，2026-10-22 删了）一样，另外 OCR 任务也能删。

#[tokio::test]
async fn delete_job_removes_a_translation_job_and_its_ocr_child_but_keeps_the_book() {
    let state = test_state("delete-job-translation");
    seed_document(&state);
    seed_job(&state, "job-t", WorkflowKind::Translate, JobStatusKind::Succeeded, None, None);
    seed_job(&state, "job-t-ocr", WorkflowKind::Ocr, JobStatusKind::Succeeded, None, None);

    let (status, body) = delete(&state, "/api/v1/jobs/job-t").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["deleted"], true, "{body}");
    assert_eq!(body["data"]["job_id"], "job-t", "{body}");
    assert_eq!(body["data"]["removed_child_jobs"], serde_json::json!(["job-t-ocr"]), "{body}");
    assert!(body["data"]["removed_paths"].is_array(), "{body}");
    assert!(state.db.get_job("job-t").is_err());
    assert!(state.db.get_job("job-t-ocr").is_err());
    assert!(!state.config.output_root.join("job-t").exists());
    assert!(!state.config.output_root.join("job-t-ocr").exists());
    assert!(state.db.get_document(DOCUMENT_ID).is_ok(), "删任务不删书");
}

/// 单独的 OCR 任务也能删（书架删除的旧地址把它当「不是书」404，那个地址 2026-10-22 删了）。
#[tokio::test]
async fn delete_job_removes_a_standalone_ocr_job() {
    let state = test_state("delete-job-ocr");
    seed_document(&state);
    seed_job(&state, "job-o", WorkflowKind::Ocr, JobStatusKind::Succeeded, None, None);

    let (status, body) = delete(&state, "/api/v1/jobs/job-o").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["removed_child_jobs"], serde_json::json!([]), "{body}");
    assert!(state.db.get_job("job-o").is_err());
    assert!(!state.config.output_root.join("job-o").exists());
}

/// 别的任务还用它的产物：OCR 任务被翻译任务的 `source.artifact_job_id` 引用、OCR 子任务的父任务还在，
/// 都 409 + `job_has_dependents`，什么都不删；`force=true` 照删。
#[tokio::test]
async fn delete_job_refuses_jobs_that_others_still_use() {
    let state = test_state("delete-job-dependents");
    seed_document(&state);
    seed_job(&state, "job-o", WorkflowKind::Ocr, JobStatusKind::Succeeded, None, None);
    seed_job(&state, "job-t", WorkflowKind::Translate, JobStatusKind::Succeeded, None, Some("job-o"));
    seed_job(&state, "job-b", WorkflowKind::Book, JobStatusKind::Succeeded, None, None);
    seed_job(&state, "job-b-ocr", WorkflowKind::Ocr, JobStatusKind::Succeeded, None, None);

    let (status, body) = delete(&state, "/api/v1/jobs/job-o").await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert_eq!(body["error"]["details"]["reason"], "job_has_dependents", "{body}");
    assert!(body["message"].as_str().unwrap_or_default().contains("job-t"), "{body}");
    assert!(state.db.get_job("job-o").is_ok());
    assert!(state.config.output_root.join("job-o").exists());

    let (status, body) = delete(&state, "/api/v1/jobs/job-b-ocr").await;
    assert_eq!(status, StatusCode::CONFLICT, "父任务还在，单删 OCR 子任务会让父任务缺产物: {body}");
    assert_eq!(body["error"]["details"]["reason"], "job_has_dependents", "{body}");
    assert!(body["message"].as_str().unwrap_or_default().contains("job-b"), "{body}");
    assert!(state.db.get_job("job-b-ocr").is_ok());

    let (status, body) = delete(&state, "/api/v1/jobs/job-o?force=true").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(state.db.get_job("job-o").is_err());
    assert!(state.db.get_job("job-t").is_ok(), "force 只删范围内的任务");
}

#[tokio::test]
async fn delete_job_refuses_a_running_job_without_force_and_cancels_it_with_force() {
    let state = test_state("delete-job-running");
    seed_document(&state);
    let mut worker = spawn_worker();
    seed_job(&state, "job-run", WorkflowKind::Translate, JobStatusKind::Running, Some(worker.id()), None);

    let (status, body) = delete(&state, "/api/v1/jobs/job-run").await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(!cancel_requested(&state, "job-run").await);
    assert!(worker.try_wait().expect("try_wait").is_none(), "没有 force 不能动进程");
    assert!(state.db.get_job("job-run").is_ok());

    let (status, body) = delete(&state, "/api/v1/jobs/job-run?force=true").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(cancel_requested(&state, "job-run").await, "强删前必须登记取消");
    assert!(wait_dead(&mut worker), "强删必须终止运行中的 worker 进程");
    assert!(state.db.get_job("job-run").is_err());
}

#[tokio::test]
async fn delete_job_of_an_unknown_job_is_404() {
    let state = test_state("delete-job-missing");
    let (status, body) = delete(&state, "/api/v1/jobs/no-such-job").await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    let (status, body) = delete(&state, "/api/v1/jobs/no-such-job?force=true").await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
}

