//! OCR 派发记录（防重复提交）在默认的 book 流程里要认得上：真实的 driver 跑父任务，OCR 在
//! `<id>-ocr` 子任务里内联执行，派发记录由子任务写；歧义闸门、失败诊断、恢复接口读的是用户看到的
//! 父任务编号。这里不往库里种记录，而是起一个假 Paddle，让真实的 runner 走完 父任务 → 子任务 →
//! 提交 → 传输出错，再从接口看结果。
//!
//! 假 Paddle：收到提交（POST /api/v2/ocr/jobs）读完请求就断开连接、不回话——请求已经到了服务商，
//! 响应丢了；查任务（GET /api/v2/ocr/jobs/<id>）记下编号、回 500，让恢复任务马上收尾。

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::body::{Body, Bytes};
use axum::http::{header, Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;
use crate::models::domain::{JobStatusKind, WorkflowKind};

struct FakePaddle {
    base_url: String,
    submits: Arc<AtomicUsize>,
    polled: Arc<Mutex<Vec<String>>>,
}

async fn fake_paddle() -> FakePaddle {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base_url = format!("http://{}", listener.local_addr().unwrap());
    let submits = Arc::new(AtomicUsize::new(0));
    let polled = Arc::new(Mutex::new(Vec::new()));
    let (submit_counter, polled_ids) = (submits.clone(), polled.clone());
    tokio::spawn(async move {
        loop {
            let Ok((mut socket, _)) = listener.accept().await else {
                return;
            };
            let (submit_counter, polled_ids) = (submit_counter.clone(), polled_ids.clone());
            tokio::spawn(async move {
                let mut buf = vec![0_u8; 256 * 1024];
                let mut filled = 0;
                // 读到请求头结束；提交的 body 是小 PDF，一两次读就收完。
                loop {
                    let Ok(read) = socket.read(&mut buf[filled..]).await else {
                        return;
                    };
                    if read == 0 {
                        return;
                    }
                    filled += read;
                    if buf[..filled].windows(4).any(|w| w == b"\r\n\r\n") {
                        break;
                    }
                }
                let head = String::from_utf8_lossy(&buf[..filled]).to_string();
                let request_line = head.lines().next().unwrap_or_default().to_string();
                if request_line.starts_with("POST /api/v2/ocr/jobs") {
                    submit_counter.fetch_add(1, Ordering::SeqCst);
                    // 再等一小会儿让客户端把 body 发完，然后不回话直接断开。
                    tokio::time::sleep(Duration::from_millis(200)).await;
                    return;
                }
                if let Some(rest) = request_line.strip_prefix("GET /api/v2/ocr/jobs/") {
                    let id = rest.split_whitespace().next().unwrap_or_default().to_string();
                    polled_ids.lock().unwrap().push(id);
                }
                let _ = socket
                    .write_all(b"HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                    .await;
            });
        }
    });
    FakePaddle {
        base_url,
        submits,
        polled,
    }
}

async fn call(state: &crate::AppState, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut request = Request::builder()
        .method(method)
        .uri(uri)
        .header("X-API-Key", "test-key");
    let body = match body {
        Some(value) => {
            request = request.header(header::CONTENT_TYPE, "application/json");
            Body::from(value.to_string())
        }
        None => Body::empty(),
    };
    let response = build_app(state.clone())
        .oneshot(request.body(body).expect("request"))
        .await
        .expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

async fn upload_pdf(state: &crate::AppState) -> String {
    let boundary = "ocr-dispatch-ownership-boundary";
    let mut body = Vec::new();
    body.extend_from_slice(
        format!("--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"book.pdf\"\r\nContent-Type: application/pdf\r\n\r\n")
            .as_bytes(),
    );
    body.extend_from_slice(&minimal_pdf_bytes(595, 842));
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/uploads")
                .header("X-API-Key", "test-key")
                .header(
                    header::CONTENT_TYPE,
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(Bytes::from(body)))
                .expect("upload request"),
        )
        .await
        .expect("upload response");
    assert_eq!(response.status(), StatusCode::OK);
    read_json(response).await["data"]["upload_id"]
        .as_str()
        .expect("upload id")
        .to_string()
}

async fn wait_for_status(state: &crate::AppState, job_id: &str, wanted: JobStatusKind) {
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            if let Ok(job) = state.db.get_job(job_id) {
                if job.status == wanted {
                    return;
                }
                assert!(
                    !matches!(
                        job.status,
                        JobStatusKind::Succeeded | JobStatusKind::Canceled | JobStatusKind::Failed
                    ),
                    "{job_id} ended as {:?} instead of {wanted:?}: {:?}",
                    job.status,
                    job.error
                );
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .unwrap_or_else(|_| panic!("{job_id} did not reach {wanted:?}"));
}

/// 提交一个默认 book 任务（真实 driver 会建 `<id>-ocr` 子任务去跑 OCR），等它失败。
async fn run_book_job_until_ocr_transport_fails(
    state: &crate::AppState,
    paddle: &FakePaddle,
) -> String {
    run_book_job_against(state, &paddle.base_url).await
}

async fn run_book_job_against(state: &crate::AppState, paddle_url: &str) -> String {
    let upload_id = upload_pdf(state).await;
    let (status, payload) = call(
        state,
        "POST",
        "/api/v1/jobs",
        Some(json!({
            "workflow": "book",
            "source": { "upload_id": upload_id },
            "ocr": {
                "provider": "paddle",
                "paddle_token": "paddle-test-token",
                "paddle_api_url": paddle_url,
            },
            "translation": {
                "api_key": "sk-test",
                "model": "deepseek-flash",
                "base_url": "https://api.deepseek.com/v1"
            },
            "runtime": { "timeout_seconds": 30 }
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "create book job: {payload}");
    let job_id = payload["data"]["job_id"].as_str().expect("job id").to_string();
    wait_for_status(state, &job_id, JobStatusKind::Failed).await;
    job_id
}

/// 请求到了服务商、响应丢了：OCR 子任务的派发要标成 ambiguous，用户看到的父任务上
/// 诊断出歧义、重试和重跑都是 409 `ambiguous_ocr_dispatch`，服务商只收到过一次提交。
#[tokio::test]
async fn book_job_ocr_transport_error_blocks_retry_and_rerun_of_the_parent() {
    let state = test_state("ocr-dispatch-ownership-gates");
    let paddle = fake_paddle().await;
    let job_id = run_book_job_until_ocr_transport_fails(&state, &paddle).await;
    assert_eq!(paddle.submits.load(Ordering::SeqCst), 1);

    // 真实结构：父任务是 book，OCR 在 `<id>-ocr` 里跑。
    let parent = state.db.get_job(&job_id).expect("parent job");
    assert_eq!(parent.request_payload.workflow, WorkflowKind::Book);
    let child_id = format!("{job_id}-ocr");
    assert_eq!(
        state.db.get_job(&child_id).expect("ocr child").status,
        JobStatusKind::Failed
    );
    let dispatch = state
        .db
        .latest_pipeline_dispatch(&child_id, "ocr-submit")
        .expect("dispatch query")
        .expect("the child records the OCR dispatch");
    assert_eq!(
        dispatch.status, "ambiguous",
        "提交报错、结果说不清：不能停在 intent"
    );

    // 失败诊断按用户看到的父任务编号查，要看得到歧义。
    let (status, report) =
        call(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/failure"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(report["data"]["failure_code"], "ocr_request_ambiguous");
    assert_eq!(report["data"]["ocr_ambiguity"]["status"], "ambiguous");
    assert_eq!(report["data"]["ocr_ambiguity"]["provider"], "paddle");

    for (action, body) in [
        ("retry-stage", Some(json!({ "stage": "ocr" }))),
        ("resume", None),
    ] {
        let (status, payload) = call(
            &state,
            "POST",
            &format!("/api/v1/jobs/{job_id}/actions/{action}"),
            body,
        )
        .await;
        assert_eq!(status, StatusCode::CONFLICT, "{action}: {payload}");
        assert_eq!(
            payload["error"]["details"]["reason"], "ambiguous_ocr_dispatch",
            "{action}: {payload}"
        );
    }
    assert_eq!(
        paddle.submits.load(Ordering::SeqCst),
        1,
        "被拦下的重试不能再向服务商提交"
    );
}

/// 绑定已有回执：恢复任务（也是 book，OCR 在 `<恢复任务>-ocr` 里跑）要读到种下的回执，
/// 直接去查那个任务，不能再提交一次。
#[tokio::test]
async fn bound_receipt_recovery_job_polls_the_bound_task_and_never_resubmits() {
    let state = test_state("ocr-dispatch-ownership-recovery");
    let paddle = fake_paddle().await;
    let job_id = run_book_job_until_ocr_transport_fails(&state, &paddle).await;
    assert_eq!(paddle.submits.load(Ordering::SeqCst), 1);

    let (status, report) =
        call(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/failure"), None).await;
    assert_eq!(status, StatusCode::OK);
    let revision = report["data"]["ocr_ambiguity"]["resolution_revision"].clone();
    assert!(revision.is_number(), "diagnostics: {report}");

    let (status, resolved) = call(
        &state,
        "POST",
        &format!("/api/v1/jobs/{job_id}/actions/resolve-ocr-ambiguity"),
        Some(json!({
            "resolution": "bind_existing_receipt",
            "resolution_revision": revision,
            "task_id": "bound-task-1",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "bind receipt: {resolved}");
    let recovery_id = resolved["data"]["submission"]["job_id"]
        .as_str()
        .expect("recovery job id")
        .to_string();
    wait_for_status(&state, &recovery_id, JobStatusKind::Failed).await;

    assert_eq!(
        paddle.polled.lock().unwrap().as_slice(),
        ["bound-task-1".to_string()],
        "恢复任务应当去查绑定的任务"
    );
    assert_eq!(
        paddle.submits.load(Ordering::SeqCst),
        1,
        "恢复任务读到了回执，不能向服务商再提交一次"
    );
}

/// 对照：连接都没建起来（请求确定没离开本机）不会让派发变 ambiguous，用户可以直接重试。
#[tokio::test]
async fn connection_refused_leaves_no_ambiguity_and_retry_is_allowed() {
    let state = test_state("ocr-dispatch-ownership-refused");
    // 一个绑过又关掉的端口：连接会被拒绝。
    let closed_port = {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        listener.local_addr().unwrap().port()
    };
    let job_id = run_book_job_against(&state, &format!("http://127.0.0.1:{closed_port}")).await;

    assert!(
        state
            .db
            .latest_ocr_dispatch_for_job(&job_id)
            .expect("dispatch query")
            .is_none(),
        "请求没离开本机：不该留下派发记录"
    );
    let (status, report) =
        call(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/failure"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(report["data"]["ocr_ambiguity"], Value::Null);
    let (status, payload) = call(
        &state,
        "POST",
        &format!("/api/v1/jobs/{job_id}/actions/retry-stage"),
        Some(json!({ "stage": "ocr" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "retry should be allowed: {payload}");
}
