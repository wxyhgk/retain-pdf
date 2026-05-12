use std::path::Path;
use std::time::Instant;

use anyhow::{anyhow, Result};

use crate::job_events::record_custom_runtime_event_with_resources;
use crate::job_runner::{
    job_artifacts_mut, ocr_provider_diagnostics_mut, register_job_retry, ProcessRuntimeDeps,
};
use crate::models::JobRuntimeState;
use crate::ocr_provider::mineru::MineruClient;

use super::markdown_bundle::export_markdown_bundle;
use super::mineru_retry::{mineru_error_chain_text, should_retry_mineru_poll_error};
use super::save_ocr_job;

const MINERU_BUNDLE_DOWNLOAD_RETRY_LIMIT: usize = 8;
const MINERU_BUNDLE_DOWNLOAD_BASE_DELAY_SECS: u64 = 2;
const MINERU_BUNDLE_READY_RETRY_LIMIT: usize = 8;
const MINERU_BUNDLE_READY_BASE_DELAY_SECS: u64 = 2;
const MINERU_BUNDLE_READY_TIMEOUT_CAP_SECS: u64 = 120;
const MINERU_BUNDLE_RETRY_MAX_DELAY_SECS: u64 = 12;

pub(super) async fn download_and_unpack_after_success(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    full_zip_url: &str,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let artifacts = job_artifacts_mut(job);
    let provider_zip = artifacts
        .provider_zip
        .clone()
        .ok_or_else(|| anyhow!("provider_zip path missing"))?;
    let provider_raw_dir = artifacts
        .provider_raw_dir
        .clone()
        .ok_or_else(|| anyhow!("provider_raw_dir path missing"))?;
    ocr_provider_diagnostics_mut(job).artifacts.full_zip_url = Some(full_zip_url.to_string());
    job.stage = Some("ocr_result_ready".to_string());
    job.stage_detail = Some("OCR provider 结果已就绪，正在下载原始 bundle".to_string());
    job.updated_at = crate::models::now_iso();
    save_ocr_job(deps, job, parent_job_id).await?;
    let bundle_timeout_secs = bundle_ready_timeout_secs(job.request_payload.ocr.poll_timeout);
    let bundle_ready = wait_for_mineru_bundle_ready(
        deps,
        job,
        client,
        full_zip_url,
        bundle_timeout_secs,
        parent_job_id,
    )
    .await?;
    if !bundle_ready {
        job.append_log(&format!(
            "MinerU bundle readiness probe degraded for {full_zip_url}, switching to direct download retries"
        ));
        job.stage = Some("ocr_result_ready".to_string());
        job.stage_detail =
            Some("OCR provider bundle 可达性探测未稳定，通过真实下载继续兜底".to_string());
        job.updated_at = crate::models::now_iso();
        save_ocr_job(deps, job, parent_job_id).await?;
    }
    download_mineru_bundle_with_retry(
        deps,
        job,
        client,
        full_zip_url,
        Path::new(&provider_zip),
        bundle_timeout_secs,
        parent_job_id,
    )
    .await?;
    client.unpack_zip(Path::new(&provider_zip), Path::new(&provider_raw_dir))?;
    export_markdown_bundle(
        &provider_raw_dir,
        job_artifacts_mut(job).job_root.as_deref(),
    )?;
    Ok(())
}

async fn wait_for_mineru_bundle_ready(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    full_zip_url: &str,
    timeout_secs: u64,
    parent_job_id: Option<&str>,
) -> Result<bool> {
    let started = Instant::now();
    let mut attempt = 0usize;
    loop {
        match client.probe_bundle_available(full_zip_url).await {
            Ok(()) => return Ok(true),
            Err(err) => {
                attempt += 1;
                let elapsed_secs = started.elapsed().as_secs();
                if !should_retry_mineru_bundle_ready_error(&err) {
                    return Err(err);
                }
                if should_fallback_to_direct_download(&err, attempt, elapsed_secs, timeout_secs) {
                    job.append_log(&format!(
                        "MinerU bundle readiness probe degraded after {attempt} attempts and {elapsed_secs}s: {full_zip_url}; fallback to direct download. error: {}",
                        err
                    ));
                    job.stage = Some("ocr_result_ready".to_string());
                    job.stage_detail = Some(
                        "OCR provider bundle 探测连续异常，改为直接下载并按下载重试策略兜底"
                            .to_string(),
                    );
                    job.updated_at = crate::models::now_iso();
                    register_job_retry(job);
                    record_custom_runtime_event_with_resources(
                        deps.db.as_ref(),
                        &deps.config.data_root,
                        &deps.config.output_root,
                        &job.snapshot(),
                        "warn",
                        "retry_degraded",
                        "OCR provider bundle 可达性探测降级为直接下载",
                        Some(serde_json::json!({
                            "scope": "mineru_bundle_ready_wait",
                            "attempt": attempt,
                            "max_attempts": MINERU_BUNDLE_READY_RETRY_LIMIT,
                            "elapsed_seconds": elapsed_secs,
                            "timeout_seconds": timeout_secs,
                            "reason": err.to_string(),
                            "url": full_zip_url,
                            "fallback": "direct_download",
                        })),
                    );
                    save_ocr_job(deps, job, parent_job_id).await?;
                    return Ok(false);
                }
                let delay_secs = std::cmp::min(
                    MINERU_BUNDLE_READY_BASE_DELAY_SECS * attempt as u64,
                    MINERU_BUNDLE_RETRY_MAX_DELAY_SECS,
                );
                job.append_log(&format!(
                    "MinerU bundle readiness wait {attempt}/{MINERU_BUNDLE_READY_RETRY_LIMIT}: {full_zip_url} after error: {}",
                    err
                ));
                job.stage = Some("ocr_result_ready".to_string());
                job.stage_detail = Some(format!(
                    "OCR provider 已返回 done，bundle 尚未就绪，{delay_secs}s 后重试（第 {attempt}/{MINERU_BUNDLE_READY_RETRY_LIMIT} 次）"
                ));
                job.updated_at = crate::models::now_iso();
                register_job_retry(job);
                record_custom_runtime_event_with_resources(
                    deps.db.as_ref(),
                    &deps.config.data_root,
                    &deps.config.output_root,
                    &job.snapshot(),
                    "warn",
                    "retry_scheduled",
                    "OCR provider bundle 可达性等待进入重试",
                    Some(serde_json::json!({
                        "scope": "mineru_bundle_ready_wait",
                        "attempt": attempt,
                        "max_attempts": MINERU_BUNDLE_READY_RETRY_LIMIT,
                        "delay_seconds": delay_secs,
                        "reason": err.to_string(),
                        "url": full_zip_url,
                    })),
                );
                save_ocr_job(deps, job, parent_job_id).await?;
                tokio::time::sleep(tokio::time::Duration::from_secs(delay_secs)).await;
            }
        }
    }
}

async fn download_mineru_bundle_with_retry(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    full_zip_url: &str,
    dest_path: &Path,
    timeout_secs: u64,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let started = Instant::now();
    let mut attempt = 0usize;
    loop {
        match client.download_bundle(full_zip_url, dest_path).await {
            Ok(()) => return Ok(()),
            Err(err) => {
                attempt += 1;
                if !should_retry_mineru_poll_error(&err)
                    || started.elapsed().as_secs() >= timeout_secs
                    || attempt >= MINERU_BUNDLE_DOWNLOAD_RETRY_LIMIT
                {
                    return Err(err);
                }
                let delay_secs = std::cmp::min(
                    MINERU_BUNDLE_DOWNLOAD_BASE_DELAY_SECS * attempt as u64,
                    MINERU_BUNDLE_RETRY_MAX_DELAY_SECS,
                );
                job.append_log(&format!(
                    "MinerU download bundle retry {attempt}/{MINERU_BUNDLE_DOWNLOAD_RETRY_LIMIT}: {full_zip_url} after error: {}",
                    err
                ));
                job.stage = Some("ocr_result_ready".to_string());
                job.stage_detail = Some(format!(
                    "OCR provider bundle 下载异常，{delay_secs}s 后重试（第 {attempt}/{MINERU_BUNDLE_DOWNLOAD_RETRY_LIMIT} 次）"
                ));
                job.updated_at = crate::models::now_iso();
                register_job_retry(job);
                record_custom_runtime_event_with_resources(
                    deps.db.as_ref(),
                    &deps.config.data_root,
                    &deps.config.output_root,
                    &job.snapshot(),
                    "warn",
                    "retry_scheduled",
                    "OCR provider bundle 下载进入重试",
                    Some(serde_json::json!({
                        "scope": "mineru_bundle_download",
                        "attempt": attempt,
                        "max_attempts": MINERU_BUNDLE_DOWNLOAD_RETRY_LIMIT,
                        "delay_seconds": delay_secs,
                        "reason": err.to_string(),
                        "url": full_zip_url,
                    })),
                );
                save_ocr_job(deps, job, parent_job_id).await?;
                tokio::time::sleep(tokio::time::Duration::from_secs(delay_secs)).await;
            }
        }
    }
}

fn should_retry_mineru_bundle_ready_error(err: &anyhow::Error) -> bool {
    let text = mineru_error_chain_text(err);
    should_retry_mineru_poll_error(err) || text.contains("404") || text.contains("not found")
}

fn bundle_ready_timeout_secs(poll_timeout_secs: i64) -> u64 {
    std::cmp::min(
        std::cmp::max(poll_timeout_secs, 1) as u64,
        MINERU_BUNDLE_READY_TIMEOUT_CAP_SECS,
    )
}

fn should_fallback_to_direct_download(
    err: &anyhow::Error,
    attempt: usize,
    elapsed_secs: u64,
    timeout_secs: u64,
) -> bool {
    should_retry_mineru_bundle_ready_error(err)
        && (elapsed_secs >= timeout_secs || attempt >= MINERU_BUNDLE_READY_RETRY_LIMIT)
}

#[cfg(test)]
mod tests {
    use super::{
        bundle_ready_timeout_secs, should_fallback_to_direct_download,
        should_retry_mineru_bundle_ready_error, MINERU_BUNDLE_READY_RETRY_LIMIT,
        MINERU_BUNDLE_READY_TIMEOUT_CAP_SECS,
    };

    #[test]
    fn should_retry_bundle_ready_error_for_not_found_probe() {
        let err = anyhow::anyhow!("404 Not Found")
            .context("MinerU bundle readiness probe returned error status");
        assert!(should_retry_mineru_bundle_ready_error(&err));
    }

    #[test]
    fn should_retry_bundle_ready_error_for_nested_connection_reset() {
        let err = anyhow::anyhow!("Connection reset by peer (os error 104)")
            .context("client error (Connect)")
            .context("MinerU bundle readiness probe failed");
        assert!(should_retry_mineru_bundle_ready_error(&err));
    }

    #[test]
    fn bundle_ready_timeout_uses_wider_cap() {
        assert_eq!(bundle_ready_timeout_secs(0), 1);
        assert_eq!(bundle_ready_timeout_secs(45), 45);
        assert_eq!(
            bundle_ready_timeout_secs(999),
            MINERU_BUNDLE_READY_TIMEOUT_CAP_SECS
        );
    }

    #[test]
    fn retryable_probe_error_can_fallback_to_direct_download_after_attempt_budget() {
        let err = anyhow::anyhow!("Connection reset by peer (os error 104)")
            .context("client error (Connect)")
            .context("MinerU bundle readiness probe failed");
        assert!(should_fallback_to_direct_download(
            &err,
            MINERU_BUNDLE_READY_RETRY_LIMIT,
            12,
            60,
        ));
    }

    #[test]
    fn non_retryable_probe_error_never_falls_back() {
        let err = anyhow::anyhow!("401 unauthorized");
        assert!(!should_fallback_to_direct_download(&err, 99, 120, 60));
    }
}
