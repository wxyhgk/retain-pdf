use std::path::Path;

use anyhow::{Context, Result};

use crate::job_runner::{job_artifacts_mut, ocr_provider_diagnostics_mut};
use crate::models::domain::JobRuntimeState;

pub(super) async fn persist_provider_result(
    job: &mut JobRuntimeState,
    provider_result_json_path: &Path,
    result: &serde_json::Value,
) -> Result<()> {
    if let Some(parent) = provider_result_json_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(
        provider_result_json_path,
        serde_json::to_vec_pretty(result).context("failed to serialize provider result")?,
    )
    .await
    .with_context(|| format!("failed to write {}", provider_result_json_path.display()))?;
    job_artifacts_mut(job).provider_summary_json =
        Some(provider_result_json_path.to_string_lossy().to_string());
    ocr_provider_diagnostics_mut(job)
        .artifacts
        .provider_result_json = Some(provider_result_json_path.to_string_lossy().to_string());
    Ok(())
}
