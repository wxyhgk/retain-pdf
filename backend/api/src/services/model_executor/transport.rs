use super::{ModelConnection, ModelConnectionPolicy, ModelRequest};
use futures_util::StreamExt;
use serde::Serialize;
use serde_json::Value;
use std::time::{Duration, Instant};

#[derive(Default, Serialize)]
pub(super) struct Receipt {
    pub content: Option<String>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub reasoning_tokens: Option<u64>,
    pub cached_tokens: Option<u64>,
    pub queue_ms: u64,
    // reqwest doesn't expose connection timing independently; never report 0.
    pub connect_ms: Option<u64>,
    pub first_event_ms: Option<u64>,
    pub first_content_ms: Option<u64>,
    pub generation_ms: Option<u64>,
    pub total_ms: u64,
    pub provider_request_id: Option<String>,
    pub upstream_attempts: u32,
    pub retry_reasons: Vec<&'static str>,
}
pub(super) struct Outcome {
    pub status: &'static str,
    pub error: Option<&'static str>,
    pub receipt: Receipt,
}

fn usage(receipt: &mut Receipt, value: &Value) {
    let usage = &value["usage"];
    if usage.is_object() {
        receipt.input_tokens = usage["prompt_tokens"].as_u64();
        receipt.output_tokens = usage["completion_tokens"].as_u64();
        receipt.reasoning_tokens = usage["completion_tokens_details"]["reasoning_tokens"].as_u64();
        receipt.cached_tokens = usage["prompt_tokens_details"]["cached_tokens"]
            .as_u64()
            .or_else(|| usage["prompt_cache_hit_tokens"].as_u64());
    }
}

fn elapsed(start: Instant) -> u64 {
    start.elapsed().as_millis() as u64
}

pub(super) async fn execute(
    client: &reqwest::Client,
    url: &url::Url,
    secret: &str,
    profile: &ModelConnection,
    request: &ModelRequest,
    queue_ms: u64,
) -> Outcome {
    let start = Instant::now();
    let mut receipt = Receipt {
        queue_ms,
        ..Default::default()
    };
    let outcome = tokio::time::timeout(Duration::from_millis(profile.deadlines.total_ms), async {
        let body = profile.body(request);
        loop {
            receipt.upstream_attempts += 1;
            let response = match tokio::time::timeout(
                Duration::from_millis(profile.deadlines.idle_ms),
                client
                    .post(url.clone())
                    .bearer_auth(secret)
                    .json(&body)
                    .send(),
            )
            .await
            {
                Ok(Ok(response)) => response,
                Ok(Err(error)) if error.is_connect() => return ("failed", Some("connect_failed")),
                Ok(Err(_)) => return ("ambiguous", Some("transport_disconnected")),
                Err(_) => return ("ambiguous", Some("read_idle_timeout")),
            };
            receipt.provider_request_id = response
                .headers()
                .get("x-request-id")
                .or_else(|| response.headers().get("request-id"))
                .and_then(|v| v.to_str().ok())
                .filter(|v| {
                    v.len() <= 128
                        && v.bytes()
                            .all(|b| b.is_ascii_alphanumeric() || b"-_.:".contains(&b))
                })
                .map(str::to_owned);
            let status = response.status();
            if status.as_u16() == 429 {
                if receipt.upstream_attempts >= 2 {
                    return ("failed", Some("rate_limited"));
                }
                let retry_after = response
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok());
                let delay = retry_after
                    .and_then(|v| {
                        v.parse::<u64>().ok().map(Duration::from_secs).or_else(|| {
                            chrono::DateTime::parse_from_rfc2822(v).ok().map(|date| {
                                Duration::from_secs(
                                    (date.timestamp() - chrono::Utc::now().timestamp()).max(0)
                                        as u64,
                                )
                            })
                        })
                    })
                    .unwrap_or(Duration::from_secs(1));
                // Do not dispatch a retry with no useful remaining deadline.
                if delay.as_millis()
                    + start.elapsed().as_millis()
                    + u128::from(profile.deadlines.connect_ms)
                    >= u128::from(profile.deadlines.total_ms)
                {
                    return ("failed", Some("rate_limit_deadline"));
                }
                drop(response);
                receipt.retry_reasons.push("explicit_429");
                tokio::time::sleep(delay).await;
                continue;
            }
            if !status.is_success() {
                // Never include raw provider bodies, which can echo input/keys.
                return match status.as_u16() {
                    401 | 403 => ("failed", Some("authentication_failed")),
                    402 => ("failed", Some("payment_required")),
                    400 | 404 | 405 | 422 => ("failed", Some("provider_rejected_request")),
                    300..=399 => ("failed", Some("redirect_rejected")),
                    _ => ("ambiguous", Some("upstream_error")),
                };
            }
            return match read_response(
                response,
                profile.streaming(),
                profile.deadlines.idle_ms,
                start,
                &mut receipt,
            )
            .await
            {
                Ok(()) => ("succeeded", None),
                Err(code) => ("ambiguous", Some(code)),
            };
        }
    })
    .await
    .unwrap_or(("ambiguous", Some("total_deadline_exceeded")));
    receipt.total_ms = queue_ms + elapsed(start);
    if outcome.0 == "succeeded" {
        receipt.generation_ms = receipt
            .first_content_ms
            .map(|first| elapsed(start).saturating_sub(first));
    }
    // No partial content is exposed as a usable result.
    if outcome.0 != "succeeded" {
        receipt.content = None;
    }
    Outcome {
        status: outcome.0,
        error: outcome.1,
        receipt,
    }
}

async fn read_response(
    response: reqwest::Response,
    streaming: bool,
    idle_ms: u64,
    start: Instant,
    receipt: &mut Receipt,
) -> Result<(), &'static str> {
    let mut stream = response.bytes_stream();
    let mut pending = Vec::new();
    let mut content = String::new();
    let mut finish = None;
    let mut done = false;
    let mut total = 0usize;
    loop {
        let chunk = match tokio::time::timeout(Duration::from_millis(idle_ms), stream.next()).await
        {
            Ok(Some(Ok(chunk))) => chunk,
            Ok(Some(Err(_))) => return Err("stream_disconnected"),
            Err(_) => return Err("read_idle_timeout"),
            Ok(None) => break,
        };
        total += chunk.len();
        if total > 16 * 1024 * 1024 {
            return Err("response_too_large");
        }
        pending.extend_from_slice(&chunk);
        if !streaming {
            continue;
        }
        while let Some(end) = pending.iter().position(|b| *b == b'\n') {
            let line: Vec<_> = pending.drain(..=end).collect();
            let line = std::str::from_utf8(&line)
                .map_err(|_| "invalid_utf8")?
                .trim();
            if let Some(data) = line.strip_prefix("data:") {
                let data = data.trim();
                if data == "[DONE]" {
                    done = true;
                    break;
                }
                if data.is_empty() {
                    continue;
                }
                let value: Value =
                    serde_json::from_str(data).map_err(|_| "invalid_stream_event")?;
                receipt.first_event_ms.get_or_insert_with(|| elapsed(start));
                if value.get("error").is_some() {
                    return Err("provider_stream_error");
                }
                usage(receipt, &value);
                if let Some(text) = value["choices"][0]["delta"]["content"].as_str() {
                    if !text.is_empty() {
                        receipt
                            .first_content_ms
                            .get_or_insert_with(|| elapsed(start));
                    }
                    content.push_str(text);
                }
                if let Some(reason) = value["choices"][0]["finish_reason"].as_str() {
                    finish = Some(reason.to_owned());
                }
                // reasoning_content is intentionally neither accumulated nor persisted.
            }
        }
        if done {
            break;
        }
    }
    if !streaming {
        let value: Value = serde_json::from_slice(&pending).map_err(|_| "invalid_json_response")?;
        if value.get("error").is_some() {
            return Err("provider_response_error");
        }
        usage(receipt, &value);
        content = value["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or_default()
            .to_owned();
        finish = value["choices"][0]["finish_reason"]
            .as_str()
            .map(str::to_owned);
        // Non-stream timing is whole-response latency, not first token latency.
    } else if !done {
        return Err("stream_missing_done");
    }
    if finish.as_deref() != Some("stop") {
        return Err("response_not_complete");
    }
    if content.trim().is_empty() {
        return Err("empty_response");
    }
    receipt.content = Some(content);
    Ok(())
}
