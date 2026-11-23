//! PaddleOCR 官方异步接口的业务码（fix/ocr-provider-codes，2026-11-23）：假服务器按顺序回放响应。
//!
//! - 提交被明确拒收（10010 排队已满、HTTP 500）时退避重交，用完把最后一次的错交出去；换文件的码不重交。
//! - 轮询被限流（HTTP 429 / 12002）时退避再查。
//! - 任务失败时 GET 返回 HTTP 200 + code=11003，原因在 data.errorMsg：报成解析失败，带原因和业务码。

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use retainpdf_data::config::PaddleRuntimeConfig;
use retainpdf_data::ocr_provider::paddle::{PaddleClient, PaddleProviderError};
use retainpdf_data::ocr_provider::OcrErrorCategory;
use serde_json::json;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

fn runtime(base_url: &str) -> PaddleRuntimeConfig {
    PaddleRuntimeConfig {
        default_base_url: base_url.to_string(),
        request_timeout_secs: 5,
        upload_timeout_secs: 5,
        upload_timeout_per_mb_secs: 0,
        upload_timeout_max_secs: 5,
        download_timeout_secs: 5,
        request_retry_attempts: 3,
        request_retry_base_delay_millis: 1,
        max_input_images: 100,
        allow_private_urls: true,
    }
}

async fn read_request(stream: &mut TcpStream) {
    let mut request = Vec::new();
    let mut buffer = [0_u8; 8192];
    loop {
        let count = stream.read(&mut buffer).await.expect("read request");
        if count == 0 {
            return;
        }
        request.extend_from_slice(&buffer[..count]);
        let Some(header_end) = request.windows(4).position(|item| item == b"\r\n\r\n") else {
            continue;
        };
        let headers = String::from_utf8_lossy(&request[..header_end]).to_ascii_lowercase();
        let content_length = headers
            .lines()
            .find_map(|line| line.strip_prefix("content-length:"))
            .and_then(|value| value.trim().parse::<usize>().ok())
            .unwrap_or(0);
        if request.len() >= header_end + 4 + content_length {
            return;
        }
    }
}

/// 起一个假服务器，第 n 个请求回第 n 个 (状态, 正文)（用完重复最后一个）。返回地址和请求计数。
async fn replay(responses: Vec<(u16, String)>) -> (String, Arc<AtomicUsize>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let address = listener.local_addr().expect("address");
    let calls = Arc::new(AtomicUsize::new(0));
    let counter = calls.clone();
    tokio::spawn(async move {
        loop {
            let Ok((mut stream, _)) = listener.accept().await else {
                return;
            };
            let index = counter.fetch_add(1, Ordering::SeqCst);
            let (status, body) = responses[index.min(responses.len() - 1)].clone();
            read_request(&mut stream).await;
            let response = format!(
                "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = stream.write_all(response.as_bytes()).await;
            let _ = stream.shutdown().await;
        }
    });
    (format!("http://{address}"), calls)
}

fn client(base_url: &str) -> PaddleClient {
    PaddleClient::with_runtime(base_url, "token", runtime(base_url))
}

fn provider_error(err: &anyhow::Error) -> &PaddleProviderError {
    err.downcast_ref::<PaddleProviderError>().expect("PaddleProviderError")
}

const QUEUE_FULL: &str = r#"{"traceId":"t","code":10010,"msg":"任务提交队列已满，请稍后重试"}"#;
const ACCEPTED: &str = r#"{"traceId":"t-ok","code":0,"msg":"Success","data":{"jobId":"job-1"}}"#;

#[tokio::test]
async fn queue_full_submit_is_resubmitted_until_accepted() {
    let (base, calls) = replay(vec![
        (200, QUEUE_FULL.to_string()),
        (400, QUEUE_FULL.to_string()),
        (200, ACCEPTED.to_string()),
    ])
    .await;
    let created = client(&base)
        .submit_remote_url("https://example.test/a.pdf", "PaddleOCR-VL-1.6", &json!({}))
        .await
        .expect("accepted on the third try");
    assert_eq!(created.data, "job-1");
    assert_eq!(calls.load(Ordering::SeqCst), 3);
}

#[tokio::test]
async fn local_file_submit_is_resubmitted_after_a_server_error() {
    let dir = std::env::temp_dir().join(format!("paddle-codes-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let pdf = dir.join("a.pdf");
    std::fs::write(&pdf, b"%PDF-1.4").unwrap();
    let (base, calls) = replay(vec![
        (500, r#"{"code":500,"msg":"internal error"}"#.to_string()),
        (200, ACCEPTED.to_string()),
    ])
    .await;
    let created = client(&base)
        .submit_local_file(&pdf, "PaddleOCR-VL-1.6", &json!({}))
        .await
        .expect("accepted after a 500");
    assert_eq!(created.data, "job-1");
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    let _ = std::fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn queue_full_to_the_end_returns_the_last_refusal() {
    let (base, calls) = replay(vec![(200, QUEUE_FULL.to_string())]).await;
    let err = client(&base)
        .submit_remote_url("https://example.test/a.pdf", "m", &json!({}))
        .await
        .expect_err("still queue full");
    assert_eq!(calls.load(Ordering::SeqCst), 3, "request_retry_attempts 次");
    let error = provider_error(&err);
    assert_eq!(error.info().category, OcrErrorCategory::QueueFull);
    assert_eq!(error.info().provider_code.as_deref(), Some("10010"));
    assert!(error.submit_definitely_rejected());
}

#[tokio::test]
async fn file_rejections_are_not_resubmitted() {
    let (base, calls) = replay(vec![(
        400,
        r#"{"traceId":"t","code":10003,"msg":"文件大小超过限制"}"#.to_string(),
    )])
    .await;
    let err = client(&base)
        .submit_remote_url("https://example.test/a.pdf", "m", &json!({}))
        .await
        .expect_err("too large");
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    let error = provider_error(&err);
    assert_eq!(error.info().category, OcrErrorCategory::FileTooLarge);
    assert_eq!(error.info().provider_message.as_deref(), Some("文件大小超过限制"));
}

#[tokio::test]
async fn rate_limited_poll_backs_off_and_queries_again() {
    let (base, calls) = replay(vec![
        (429, r#"{"traceId":"t","code":12002,"msg":"请求频率过高"}"#.to_string()),
        (
            200,
            r#"{"traceId":"t","code":0,"msg":"ok","data":{"jobId":"job-1","state":"running"}}"#.to_string(),
        ),
    ])
    .await;
    let polled = client(&base).query_job("job-1").await.expect("second query works");
    assert_eq!(polled.data.state, "running");
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[tokio::test]
async fn failed_task_11003_is_a_parse_failure_with_the_reason() {
    let (base, calls) = replay(vec![(
        200,
        r#"{"traceId":"t-f","code":11003,"msg":"Job failed","data":{"jobId":"job-1","state":"failed","errorMsg":"第 3 页解析出错"}}"#
            .to_string(),
    )])
    .await;
    let err = client(&base).query_job("job-1").await.expect_err("task failed");
    assert_eq!(calls.load(Ordering::SeqCst), 1, "任务失败不重查");
    let error = provider_error(&err);
    assert_eq!(error.info().category, OcrErrorCategory::ParseFailed);
    assert_eq!(error.info().provider_code.as_deref(), Some("11003"));
    assert_eq!(error.info().provider_message.as_deref(), Some("第 3 页解析出错"));
    assert_eq!(error.info().trace_id.as_deref(), Some("t-f"));
}
