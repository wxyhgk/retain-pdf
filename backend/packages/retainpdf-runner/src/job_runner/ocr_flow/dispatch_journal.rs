use anyhow::{anyhow, bail, Result};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::db::{PipelineAttemptCursor, PipelineDispatchBegin, PipelineDispatchIntent};
use crate::models::domain::JobRuntimeState;
use crate::ocr_provider::mineru::response_error::MineruResponseError;
use crate::ocr_provider::paddle::PaddleProviderError;

use super::ProcessRuntimeDeps;

pub(super) const OCR_SUBMIT_DISPATCH_KEY: &str = "ocr-submit";

pub(super) enum OcrDispatchDecision {
    Send { cursor: PipelineAttemptCursor },
    Resume { receipt: Value },
}

pub(super) fn begin_ocr_dispatch(
    deps: &ProcessRuntimeDeps,
    job: &JobRuntimeState,
    provider: &str,
    operation: &str,
    request_identity: &Value,
) -> Result<OcrDispatchDecision> {
    let worker_id = format!("native-ocr:{}:{}", std::process::id(), job.job_id);
    let cursor = deps
        .db
        .acquire_pipeline_attempt(&job.job_id, &worker_id, "ocr", 0)?;
    let request_hash = Sha256::digest(serde_json::to_vec(request_identity)?)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    let intent = PipelineDispatchIntent {
        dispatch_key: OCR_SUBMIT_DISPATCH_KEY.to_string(),
        provider: provider.to_string(),
        operation: operation.to_string(),
        request_hash,
    };
    match deps.db.begin_pipeline_dispatch(&cursor, &intent)? {
        PipelineDispatchBegin::Send { cursor } => Ok(OcrDispatchDecision::Send { cursor }),
        PipelineDispatchBegin::Resume { receipt, .. } => {
            Ok(OcrDispatchDecision::Resume { receipt })
        }
        PipelineDispatchBegin::Ambiguous { reason, .. } => {
            bail!("OCR provider request outcome is ambiguous; automatic resubmit blocked: {reason}")
        }
    }
}

/// 提交调用出错（或被取消）之后收尾刚写下的 intent。
///
/// intent 写下之后，请求是否到达服务商取决于错在哪一步：连接没建起来、请求没构造出来、
/// 服务商明确拒绝（4xx、鉴权/额度）都确定没有建出任务，撤销 intent，重试可以直接再发；
/// 其余（响应超时、断连、5xx、响应读不出来、上传被取消）服务商可能已经收下并开始计费，
/// 标成 ambiguous，重试、重跑的闸门才拦得住。拿不准一律按 ambiguous 处理。
pub(super) fn settle_failed_submit(
    deps: &ProcessRuntimeDeps,
    cursor: &PipelineAttemptCursor,
    err: anyhow::Error,
) -> anyhow::Error {
    let result = if submit_certainly_not_accepted(&err) {
        deps.db
            .discard_pipeline_dispatch_intent(cursor, OCR_SUBMIT_DISPATCH_KEY)
            .map(|_| ())
    } else {
        mark_submit_outcome_unknown(
            deps,
            cursor,
            "OCR submit request failed without a definite answer from the provider; it may have been accepted",
        )
    };
    if let Err(error) = result {
        tracing::warn!(
            "settle OCR dispatch of job {} after a failed submit failed: {error:#}",
            cursor.job_id
        );
    }
    err
}

/// 提交被打断（例如上传中途取消）：服务商可能已经收下，标成 ambiguous。
pub(super) fn mark_submit_outcome_unknown(
    deps: &ProcessRuntimeDeps,
    cursor: &PipelineAttemptCursor,
    reason: &str,
) -> Result<()> {
    deps.db
        .mark_pipeline_dispatch_ambiguous(cursor, OCR_SUBMIT_DISPATCH_KEY, reason)
        .map(|_| ())
}

fn submit_certainly_not_accepted(err: &anyhow::Error) -> bool {
    err.chain().any(|cause| {
        if let Some(error) = cause.downcast_ref::<reqwest::Error>() {
            return error.is_builder() || (error.is_connect() && !error.is_timeout());
        }
        if let Some(error) = cause.downcast_ref::<PaddleProviderError>() {
            // 提交收到 HTTP 500 也算没收下（官方：服务端内部错误），客户端已经在提交处重交过
            return error.submit_definitely_rejected();
        }
        if let Some(error) = cause.downcast_ref::<MineruResponseError>() {
            return error.info.is_definite_refusal();
        }
        false
    })
}

pub(super) fn receipt_ocr_dispatch(
    deps: &ProcessRuntimeDeps,
    cursor: &PipelineAttemptCursor,
    receipt: &Value,
) -> Result<PipelineAttemptCursor> {
    deps.db
        .receipt_pipeline_dispatch(cursor, OCR_SUBMIT_DISPATCH_KEY, receipt)
}

pub(super) fn receipt_string(receipt: &Value, key: &str) -> Result<String> {
    receipt
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| anyhow!("durable OCR dispatch receipt is missing {key}"))
}

pub(super) fn receipt_optional_string(receipt: &Value, key: &str) -> Option<String> {
    receipt
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::submit_certainly_not_accepted;
    use crate::ocr_provider::mineru::response_error::MineruResponseError;
    use anyhow::Context;

    #[tokio::test]
    async fn connection_refused_never_left_the_process() {
        let port = {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            listener.local_addr().unwrap().port()
        };
        let err = reqwest::Client::new()
            .post(format!("http://127.0.0.1:{port}/submit"))
            .send()
            .await
            .expect_err("connection refused");
        let wrapped = Err::<(), _>(err).context("POST failed").unwrap_err();
        assert!(submit_certainly_not_accepted(&wrapped));
    }

    #[tokio::test]
    async fn a_dropped_connection_after_the_request_was_sent_is_unknown() {
        use tokio::io::AsyncReadExt;
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut buf = [0_u8; 4096];
            let _ = socket.read(&mut buf).await;
        });
        let err = reqwest::Client::new()
            .post(format!("http://127.0.0.1:{port}/submit"))
            .body("payload")
            .send()
            .await
            .expect_err("connection closed before a response");
        let wrapped = Err::<(), _>(err).context("POST failed").unwrap_err();
        assert!(!submit_certainly_not_accepted(&wrapped));
    }

    #[test]
    fn provider_refusals_are_definite_but_server_errors_are_not() {
        let refused: anyhow::Error =
            MineruResponseError::from_response(401, r#"{"code":"A0202","msg":"bad token"}"#, None)
                .into();
        assert!(submit_certainly_not_accepted(&refused));
        let bad_request: anyhow::Error = MineruResponseError::from_response(400, "", None).into();
        assert!(submit_certainly_not_accepted(&bad_request));
        let server_error: anyhow::Error = MineruResponseError::from_response(503, "", None).into();
        assert!(!submit_certainly_not_accepted(&server_error));
        assert!(!submit_certainly_not_accepted(&anyhow::anyhow!("something else")));
    }

    /// Paddle 提交收到 HTTP 500（官方：服务端内部错误）算没收下：客户端已在提交处重交过，
    /// 撤销 intent，用户重试不会被「请求结果不明确」挡住。502/503 这类网关错误照旧说不清。
    #[test]
    fn paddle_submit_500_is_a_definite_refusal_but_gateway_errors_are_not() {
        use crate::ocr_provider::paddle::PaddleProviderError;
        use reqwest::StatusCode;
        let server: anyhow::Error = PaddleProviderError::http_status(
            "submit",
            StatusCode::INTERNAL_SERVER_ERROR,
            "{}",
            None,
            None,
        )
        .into();
        assert!(submit_certainly_not_accepted(&server.context("submit failed")));
        let gateway: anyhow::Error =
            PaddleProviderError::http_status("submit", StatusCode::BAD_GATEWAY, "", None, None).into();
        assert!(!submit_certainly_not_accepted(&gateway));
        let queue_full: anyhow::Error =
            PaddleProviderError::provider_error("submit", 10010, "任务提交队列已满", None).into();
        assert!(submit_certainly_not_accepted(&queue_full));
    }
}
