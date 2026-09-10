use std::path::Path;

use anyhow::{anyhow, Result};

use crate::job_runner::{job_artifacts_mut, ocr_provider_diagnostics_mut, ProcessRuntimeDeps};
use crate::models::domain::JobRuntimeState;
use crate::ocr_provider::mineru::MineruClient;

use super::bundle_download_retry::download_mineru_bundle_with_retry;
use super::bundle_events::mark_ocr_result_ready;
use super::bundle_ready_wait::wait_for_mineru_bundle_ready;
use super::bundle_retry_policy::bundle_ready_timeout_secs;
use super::markdown_bundle::export_markdown_bundle;
use super::save_ocr_job;

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
    mark_ocr_result_ready(
        job,
        "OCR provider 结果已就绪，正在下载原始 bundle".to_string(),
    );
    save_ocr_job(deps, job, parent_job_id).await?;
    let runtime = deps.mineru_runtime();
    let bundle_timeout_secs = bundle_ready_timeout_secs(
        job.request_payload.ocr.poll_timeout,
        runtime.bundle_ready_timeout_cap_secs,
    );
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
        mark_ocr_result_ready(
            job,
            "OCR provider bundle 可达性探测未稳定，通过真实下载继续兜底".to_string(),
        );
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
