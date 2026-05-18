use std::time::Instant;

use anyhow::Result;
use tokio::time::{sleep, Duration};

use crate::job_events::record_custom_runtime_event_with_resources;
use crate::job_runner::{register_job_retry, ProcessRuntimeDeps};
use crate::models::{now_iso, JobRuntimeState};
use crate::ocr_provider::mineru::{client::MineruUploadTarget, MineruClient};

use super::save_ocr_job;

pub(super) fn mineru_error_chain_text(err: &anyhow::Error) -> String {
    err.chain()
        .map(|cause| cause.to_string().to_ascii_lowercase())
        .collect::<Vec<_>>()
        .join("\n")
}

pub(super) async fn acquire_upload_target_with_retry(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    file_name: &str,
    timeout_secs: u64,
    parent_job_id: Option<&str>,
) -> Result<MineruUploadTarget> {
    let runtime = deps.mineru_runtime();
    let started = Instant::now();
    let mut attempt = 0usize;
    loop {
        match client
            .apply_upload_url(
                file_name,
                &job.request_payload.ocr.model_version,
                &job.request_payload.ocr.page_ranges,
                &job.request_payload.ocr.data_id,
            )
            .await
        {
            Ok(target) => return Ok(target),
            Err(err) => {
                attempt += 1;
                if !should_retry_mineru_poll_error(&err)
                    || started.elapsed().as_secs() >= timeout_secs
                    || attempt >= runtime.poll_retry_limit
                {
                    return Err(err);
                }
                let delay_secs = std::cmp::min(
                    runtime.poll_retry_base_delay_secs * attempt as u64,
                    runtime.poll_retry_max_delay_secs,
                );
                job.append_log(&format!(
                    "MinerU apply upload url retry {attempt}/{}: {file_name} after error: {}",
                    runtime.poll_retry_limit, err
                ));
                job.stage = Some("ocr_upload".to_string());
                job.stage_detail = Some(format!(
                    "OCR provider 上传地址申请异常，{delay_secs}s 后重试（第 {attempt}/{} 次）",
                    runtime.poll_retry_limit
                ));
                job.updated_at = now_iso();
                register_job_retry(job);
                record_custom_runtime_event_with_resources(
                    deps.db.as_ref(),
                    &deps.persist.data_root,
                    &deps.persist.output_root,
                    &job.snapshot(),
                    "warn",
                    "retry_scheduled",
                    "OCR provider 上传地址申请进入重试",
                    Some(serde_json::json!({
                        "scope": "mineru_apply_upload_url",
                        "attempt": attempt,
                        "max_attempts": runtime.poll_retry_limit,
                        "delay_seconds": delay_secs,
                        "reason": err.to_string(),
                    })),
                );
                save_ocr_job(deps, job, parent_job_id).await?;
                sleep(Duration::from_secs(delay_secs)).await;
            }
        }
    }
}

pub(super) async fn query_with_retry<T, F, Fut>(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    resource_label: &str,
    resource_id: &str,
    timeout_secs: u64,
    parent_job_id: Option<&str>,
    mut fetch: F,
) -> Result<Option<T>>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let runtime = deps.mineru_runtime();
    let started = Instant::now();
    let mut attempt = 0usize;
    loop {
        match fetch().await {
            Ok(value) => return Ok(Some(value)),
            Err(err) => {
                attempt += 1;
                if !should_retry_mineru_poll_error(&err)
                    || started.elapsed().as_secs() >= timeout_secs
                {
                    return Err(err);
                }
                if attempt >= runtime.poll_retry_limit {
                    job.append_log(&format!(
                        "MinerU {resource_label} poll degraded after {attempt} retries, keep waiting next cycle: {resource_id} error: {}",
                        err
                    ));
                    job.stage = Some("mineru_processing".to_string());
                    job.stage_detail =
                        Some("OCR provider 状态查询连续异常，稍后自动继续拉取".to_string());
                    job.updated_at = now_iso();
                    register_job_retry(job);
                    record_custom_runtime_event_with_resources(
                        deps.db.as_ref(),
                        &deps.persist.data_root,
                        &deps.persist.output_root,
                        &job.snapshot(),
                        "warn",
                        "retry_scheduled",
                        format!("OCR provider {resource_label} 查询降级为下一轮继续轮询"),
                        Some(serde_json::json!({
                            "scope": format!("mineru_{resource_label}_poll"),
                            "attempt": attempt,
                            "max_attempts": runtime.poll_retry_limit,
                            "resource_id": resource_id,
                            "degraded": true,
                            "reason": err.to_string(),
                        })),
                    );
                    save_ocr_job(deps, job, parent_job_id).await?;
                    return Ok(None);
                }
                let delay_secs = std::cmp::min(
                    runtime.poll_retry_base_delay_secs * attempt as u64,
                    runtime.poll_retry_max_delay_secs,
                );
                job.append_log(&format!(
                    "MinerU {resource_label} poll retry {attempt}/{}: {resource_id} after error: {}",
                    runtime.poll_retry_limit,
                    err
                ));
                job.stage = Some("mineru_processing".to_string());
                job.stage_detail = Some(format!(
                    "OCR provider 状态查询异常，{delay_secs}s 后重试（第 {attempt}/{} 次）",
                    runtime.poll_retry_limit
                ));
                job.updated_at = now_iso();
                register_job_retry(job);
                record_custom_runtime_event_with_resources(
                    deps.db.as_ref(),
                    &deps.persist.data_root,
                    &deps.persist.output_root,
                    &job.snapshot(),
                    "warn",
                    "retry_scheduled",
                    format!("OCR provider {resource_label} 查询进入重试"),
                    Some(serde_json::json!({
                        "scope": format!("mineru_{resource_label}_poll"),
                        "attempt": attempt,
                        "max_attempts": runtime.poll_retry_limit,
                        "delay_seconds": delay_secs,
                        "resource_id": resource_id,
                        "reason": err.to_string(),
                    })),
                );
                save_ocr_job(deps, job, parent_job_id).await?;
                sleep(Duration::from_secs(delay_secs)).await;
            }
        }
    }
}

pub(super) fn should_retry_mineru_poll_error(err: &anyhow::Error) -> bool {
    let text = mineru_error_chain_text(err);
    text.contains("timed out")
        || text.contains("connection timed out")
        || text.contains("server disconnected")
        || text.contains("connection reset")
        || text.contains("connection error")
        || text.contains("sendrequest")
        || text.contains("tempor")
        || text.contains("service unavailable")
        || text.contains("502")
        || text.contains("503")
        || text.contains("504")
}

#[cfg(test)]
mod tests {
    use super::{mineru_error_chain_text, should_retry_mineru_poll_error};

    #[test]
    fn should_retry_mineru_poll_error_matches_dns_and_timeout_noise() {
        let dns = anyhow::anyhow!("dns error: Temporary failure in name resolution");
        let timeout = anyhow::anyhow!("request timed out after 120s");
        let auth = anyhow::anyhow!("401 unauthorized");

        assert!(should_retry_mineru_poll_error(&dns));
        assert!(should_retry_mineru_poll_error(&timeout));
        assert!(!should_retry_mineru_poll_error(&auth));
    }

    #[test]
    fn should_retry_mineru_poll_error_matches_nested_connection_reset_chain() {
        let err = anyhow::anyhow!("Connection reset by peer (os error 104)")
            .context("client error (Connect)")
            .context("error sending request for url (https://cdn-mineru.openxlab.org.cn/file.zip)")
            .context("MinerU download bundle request failed");

        let chain = mineru_error_chain_text(&err);
        assert!(chain.contains("connection reset by peer"));
        assert!(should_retry_mineru_poll_error(&err));
    }
}
