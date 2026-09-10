use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use retain_data::config::PaddleRuntimeConfig;
use retain_data::db::{Db, PipelineDispatchBegin, PipelineDispatchIntent};
use retain_data::models::domain::{JobSnapshot, JobStatusKind};
use retain_data::models::request::CreateJobInput;
use retain_data::ocr_provider::paddle::PaddleClient;
use serde_json::json;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

const JOB_ID: &str = "job-network-fault";
const TOKEN: &str = "network-fault-secret";

fn fixture_root(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "retain-pipeline-network-fault-{label}-{}-{}",
        std::process::id(),
        fastrand::u64(..)
    ))
}

fn db(root: &Path) -> Db {
    Db::new(root.join("jobs.db"), root.to_path_buf())
}

fn seed_running_job(db: &Db) {
    let mut job = JobSnapshot::new(
        JOB_ID.to_string(),
        CreateJobInput::default(),
        vec!["network-fault-fixture".to_string()],
    );
    job.status = JobStatusKind::Running;
    db.save_job(&job).expect("seed running job");
}

fn dispatch_intent() -> PipelineDispatchIntent {
    PipelineDispatchIntent {
        dispatch_key: "ocr-submit".to_string(),
        provider: "paddle".to_string(),
        operation: "submit_remote_url".to_string(),
        request_hash: "a".repeat(64),
    }
}

fn runtime(base_url: &str, retry_attempts: usize) -> PaddleRuntimeConfig {
    PaddleRuntimeConfig {
        default_base_url: base_url.to_string(),
        request_timeout_secs: 2,
        download_timeout_secs: 2,
        request_retry_attempts: retry_attempts,
        request_retry_base_delay_millis: 1,
        max_input_images: 100,
        allow_private_urls: true,
    }
}

async fn read_http_request(stream: &mut TcpStream) -> Vec<u8> {
    let mut request = Vec::new();
    let mut buffer = [0_u8; 4096];
    loop {
        let count = stream.read(&mut buffer).await.expect("read HTTP request");
        if count == 0 {
            break;
        }
        request.extend_from_slice(&buffer[..count]);
        let Some(header_end) = request.windows(4).position(|item| item == b"\r\n\r\n") else {
            continue;
        };
        let body_start = header_end + 4;
        let headers = String::from_utf8_lossy(&request[..header_end]);
        let content_length = headers
            .lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                name.eq_ignore_ascii_case("content-length")
                    .then(|| value.trim().parse::<usize>().ok())
                    .flatten()
            })
            .unwrap_or(0);
        if request.len() >= body_start + content_length {
            break;
        }
    }
    request
}

async fn write_json_response(stream: &mut TcpStream, body: &str) {
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    stream
        .write_all(response.as_bytes())
        .await
        .expect("write HTTP response");
    stream.shutdown().await.expect("shutdown HTTP response");
}

#[tokio::test]
async fn lost_submit_response_is_not_retried_and_recovers_as_ambiguous() {
    let root = fixture_root("submit-response-lost");
    fs::create_dir_all(&root).expect("create fixture root");
    let original = db(&root);
    original.init().expect("init DB");
    seed_running_job(&original);
    let cursor = original
        .acquire_pipeline_attempt(JOB_ID, "worker-before-disconnect", "ocr", 0)
        .expect("acquire OCR attempt");
    let send_cursor = match original
        .begin_pipeline_dispatch(&cursor, &dispatch_intent())
        .expect("persist dispatch intent")
    {
        PipelineDispatchBegin::Send { cursor } => cursor,
        other => panic!("expected send decision, got {other:?}"),
    };

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind fault server");
    let address = listener.local_addr().expect("fault server address");
    let server = tokio::spawn(async move {
        let (mut first, _) = listener.accept().await.expect("accept submit request");
        let request = read_http_request(&mut first).await;
        drop(first);
        let retried = tokio::time::timeout(Duration::from_millis(250), listener.accept())
            .await
            .is_ok();
        (request, retried)
    });

    let base_url = format!("http://{address}");
    let client = PaddleClient::with_runtime(&base_url, TOKEN, runtime(&base_url, 3));
    let error = client
        .submit_remote_url(
            "https://documents.example/source.pdf",
            "PP-StructureV3",
            &json!({}),
        )
        .await
        .expect_err("dropped submit response must fail");
    assert!(!format!("{error:#}").contains(TOKEN));
    let (request, retried) = server.await.expect("fault server task");
    let request_text = String::from_utf8_lossy(&request);
    assert!(request_text.starts_with("POST /api/v2/ocr/jobs "));
    assert!(!retried, "non-idempotent submit must not be retried");

    let pending = original
        .latest_pipeline_dispatch(JOB_ID, "ocr-submit")
        .expect("load pending dispatch")
        .expect("pending dispatch");
    assert_eq!(pending.status, "intent");
    assert!(pending.receipt.is_none());
    drop(send_cursor);

    let restarted = db(&root);
    restarted.init().expect("restart DB");
    let restarted_cursor = restarted
        .acquire_pipeline_attempt(JOB_ID, "worker-after-disconnect", "ocr", 0)
        .expect("reacquire OCR attempt");
    let decision = restarted
        .begin_pipeline_dispatch(&restarted_cursor, &dispatch_intent())
        .expect("recover dispatch decision");
    assert!(matches!(decision, PipelineDispatchBegin::Ambiguous { .. }));
    let ambiguous = restarted
        .latest_pipeline_dispatch(JOB_ID, "ocr-submit")
        .expect("load ambiguous dispatch")
        .expect("ambiguous dispatch");
    assert_eq!(ambiguous.status, "ambiguous");
    assert!(ambiguous.receipt.is_none());

    fs::remove_dir_all(root).expect("remove fixture root");
}

#[tokio::test]
async fn polling_disconnect_retries_without_losing_durable_receipt() {
    let root = fixture_root("poll-retry");
    fs::create_dir_all(&root).expect("create fixture root");
    let original = db(&root);
    original.init().expect("init DB");
    seed_running_job(&original);
    let cursor = original
        .acquire_pipeline_attempt(JOB_ID, "worker-before-poll", "ocr", 0)
        .expect("acquire OCR attempt");
    let send_cursor = match original
        .begin_pipeline_dispatch(&cursor, &dispatch_intent())
        .expect("persist dispatch intent")
    {
        PipelineDispatchBegin::Send { cursor } => cursor,
        other => panic!("expected send decision, got {other:?}"),
    };
    original
        .receipt_pipeline_dispatch(
            &send_cursor,
            "ocr-submit",
            &json!({"task_id": "paddle-task-1", "trace_id": "trace-1"}),
        )
        .expect("persist provider receipt");

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind fault server");
    let address = listener.local_addr().expect("fault server address");
    let server = tokio::spawn(async move {
        let (mut first, _) = listener.accept().await.expect("accept first poll");
        let first_request = read_http_request(&mut first).await;
        drop(first);

        let (mut second, _) = listener.accept().await.expect("accept retry poll");
        let second_request = read_http_request(&mut second).await;
        write_json_response(
            &mut second,
            r#"{"logId":"trace-2","errorCode":0,"errorMsg":"","data":{"jobId":"paddle-task-1","state":"running","extractProgress":null,"resultUrl":null}}"#,
        )
        .await;
        (first_request, second_request)
    });

    let base_url = format!("http://{address}");
    let client = PaddleClient::with_runtime(&base_url, TOKEN, runtime(&base_url, 2));
    let poll = client
        .query_job("paddle-task-1")
        .await
        .expect("poll should retry after disconnect");
    assert_eq!(poll.data.job_id, "paddle-task-1");
    assert_eq!(poll.data.state, "running");
    assert_eq!(poll.trace_id.as_deref(), Some("trace-2"));
    let (first_request, second_request) = server.await.expect("fault server task");
    for request in [first_request, second_request] {
        assert!(
            String::from_utf8_lossy(&request).starts_with("GET /api/v2/ocr/jobs/paddle-task-1 ")
        );
    }

    let restarted = db(&root);
    restarted.init().expect("restart DB");
    let dispatch = restarted
        .latest_pipeline_dispatch(JOB_ID, "ocr-submit")
        .expect("load receipted dispatch")
        .expect("receipted dispatch");
    assert_eq!(dispatch.status, "receipted");
    assert_eq!(
        dispatch
            .receipt
            .as_ref()
            .and_then(|value| value["task_id"].as_str()),
        Some("paddle-task-1")
    );

    fs::remove_dir_all(root).expect("remove fixture root");
}
