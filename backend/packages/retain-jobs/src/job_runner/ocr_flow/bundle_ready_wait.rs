use std::time::Instant;

use anyhow::Result;

use crate::job_runner::ProcessRuntimeDeps;
use crate::models::domain::JobRuntimeState;
use crate::ocr_provider::mineru::MineruClient;

use super::bundle_events::{
    record_bundle_retry_degraded, record_bundle_retry_scheduled, BundleRetryEvent,
};
use super::bundle_retry_policy::{
    should_fallback_to_direct_download, should_retry_mineru_bundle_ready_error,
};
use super::save_ocr_job;

pub(super) async fn wait_for_mineru_bundle_ready(
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
                let runtime = deps.mineru_runtime();
                if should_fallback_to_direct_download(
                    &err,
                    attempt,
                    elapsed_secs,
                    timeout_secs,
                    runtime.bundle_ready_retry_limit,
                ) {
                    job.append_log(&format!(
                        "MinerU bundle readiness probe degraded after {attempt} attempts and {elapsed_secs}s: {full_zip_url}; fallback to direct download. error: {}",
                        err
                    ));
                    record_bundle_retry_degraded(
                        deps,
                        job,
                        BundleRetryEvent {
                            scope: "mineru_bundle_ready_wait",
                            attempt,
                            max_attempts: runtime.bundle_ready_retry_limit,
                            delay_secs: None,
                            elapsed_secs: Some(elapsed_secs),
                            timeout_secs: Some(timeout_secs),
                            reason: err.to_string(),
                            url: full_zip_url,
                        },
                    );
                    save_ocr_job(deps, job, parent_job_id).await?;
                    return Ok(false);
                }
                let delay_secs = std::cmp::min(
                    runtime.bundle_ready_base_delay_secs * attempt as u64,
                    runtime.bundle_retry_max_delay_secs,
                );
                job.append_log(&format!(
                    "MinerU bundle readiness wait {attempt}/{}: {full_zip_url} after error: {}",
                    runtime.bundle_ready_retry_limit, err
                ));
                record_bundle_retry_scheduled(
                    deps,
                    job,
                    format!(
                        "OCR provider 已返回 done，bundle 尚未就绪，{delay_secs}s 后重试（第 {attempt}/{} 次）",
                        runtime.bundle_ready_retry_limit
                    ),
                    "OCR provider bundle 可达性等待进入重试",
                    BundleRetryEvent {
                        scope: "mineru_bundle_ready_wait",
                        attempt,
                        max_attempts: runtime.bundle_ready_retry_limit,
                        delay_secs: Some(delay_secs),
                        elapsed_secs: None,
                        timeout_secs: None,
                        reason: err.to_string(),
                        url: full_zip_url,
                    },
                );
                save_ocr_job(deps, job, parent_job_id).await?;
                tokio::time::sleep(tokio::time::Duration::from_secs(delay_secs)).await;
            }
        }
    }
}
