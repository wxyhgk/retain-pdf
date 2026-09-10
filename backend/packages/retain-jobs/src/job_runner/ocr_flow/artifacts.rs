use anyhow::{anyhow, Context, Result};
use std::path::{Path, PathBuf};

pub(super) use super::bundle_download::download_and_unpack_after_success;
pub(super) use super::provider_result::persist_provider_result;

pub(super) fn ensure_source_pdf_from_bundle(
    provider_raw_dir: &Path,
    source_dir: &Path,
) -> Result<PathBuf> {
    let mut origin_pdf = None;
    for entry in std::fs::read_dir(provider_raw_dir)
        .with_context(|| format!("failed to read {}", provider_raw_dir.display()))?
    {
        let entry = entry?;
        let path = entry.path();
        if path
            .file_name()
            .and_then(|item| item.to_str())
            .map(|name| name.ends_with("_origin.pdf"))
            .unwrap_or(false)
        {
            origin_pdf = Some(path);
            break;
        }
    }
    let origin_pdf = origin_pdf.ok_or_else(|| {
        anyhow!(
            "MinerU unpacked bundle does not contain *_origin.pdf in {}",
            provider_raw_dir.display()
        )
    })?;
    let target_path = source_dir.join(
        origin_pdf
            .file_name()
            .ok_or_else(|| anyhow!("invalid origin pdf filename"))?,
    );
    std::fs::create_dir_all(source_dir)?;
    std::fs::copy(&origin_pdf, &target_path).with_context(|| {
        format!(
            "failed to copy source pdf from {} to {}",
            origin_pdf.display(),
            target_path.display()
        )
    })?;
    Ok(target_path)
}

pub(super) async fn download_source_pdf(source_url: &str, source_dir: &Path) -> Result<PathBuf> {
    let response = reqwest::get(source_url)
        .await
        .with_context(|| format!("failed to download source pdf from {source_url}"))?
        .error_for_status()
        .with_context(|| format!("source pdf download returned error status: {source_url}"))?;
    let file_name = source_url
        .rsplit('/')
        .next()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("source.pdf");
    let target_path = source_dir.join(file_name);
    let bytes = response
        .bytes()
        .await
        .with_context(|| format!("failed to read source pdf bytes from {source_url}"))?;
    tokio::fs::create_dir_all(source_dir).await?;
    tokio::fs::write(&target_path, &bytes)
        .await
        .with_context(|| format!("failed to write source pdf to {}", target_path.display()))?;
    Ok(target_path)
}
