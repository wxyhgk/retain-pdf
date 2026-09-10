use std::path::{Component, Path, PathBuf};

use anyhow::{bail, Result};

use crate::models::domain::{JobArtifacts, JobSnapshot};

use super::constants::LEGACY_LAYOUT_DIR_NAMES;

pub fn data_path_is_absolute(raw: &str) -> bool {
    Path::new(raw).is_absolute()
}

pub fn normalize_relative_data_path(path: &Path) -> Result<String> {
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => parts.push(part.to_string_lossy().to_string()),
            Component::ParentDir => {
                bail!("parent-relative paths are not allowed: {}", path.display())
            }
            Component::RootDir | Component::Prefix(_) => {
                bail!("absolute paths are not allowed: {}", path.display())
            }
        }
    }
    if parts.is_empty() {
        bail!("path is empty");
    }
    Ok(parts.join("/"))
}

pub fn to_relative_data_path(data_root: &Path, path: &Path) -> Result<String> {
    // path 可能是三种形态之一:
    //   (a) DATA_ROOT 下的绝对文件系统路径(如 /abs/data/jobs/x);
    //   (b) 由 data_root 拼出来、但本身仍是相对的路径——当 DATA_ROOT 配成相对
    //       值(如 dev 环境的 `../../data`)时, uploads_dir.join(...) 会得到
    //       `../../data/uploads/x` 这种带 `..` 的相对路径;
    //   (c) 已经是作业相对路径(如 jobs/x/source.pdf)。
    // 先无条件尝试剥掉 data_root 前缀:(a)(b) 都会因此收敛成作业相对形态。
    if let Ok(relative) = path.strip_prefix(data_root) {
        return normalize_relative_data_path(relative);
    }
    // Already a clean data-root-relative path (e.g. "jobs/x/source.pdf").
    if !path.is_absolute()
        && !path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return normalize_relative_data_path(path);
    }
    // Fallback: absolutize both sides (cwd-relative DATA_ROOT / stored path)
    // then strip. Covers mismatched absolute-vs-relative pairs after restarts.
    let absolute_root = absolutize_for_compare(data_root);
    let absolute_path = absolutize_for_compare(path);
    if let Ok(relative) = absolute_path.strip_prefix(&absolute_root) {
        return normalize_relative_data_path(relative);
    }
    bail!(
        "path is outside DATA_ROOT: {} (root={})",
        path.display(),
        data_root.display()
    )
}

fn absolutize_for_compare(path: &Path) -> PathBuf {
    if let Ok(canonical) = path.canonicalize() {
        return canonical;
    }
    if path.is_absolute() {
        return path.to_path_buf();
    }
    std::env::current_dir()
        .map(|cwd| {
            let joined = cwd.join(path);
            joined.canonicalize().unwrap_or(joined)
        })
        .unwrap_or_else(|_| path.to_path_buf())
}

pub fn resolve_data_path(data_root: &Path, raw: &str) -> Result<PathBuf> {
    let path = PathBuf::from(raw);
    if path.is_absolute() {
        return Ok(path);
    }
    Ok(data_root.join(normalize_relative_data_path(&path)?))
}

pub fn normalize_job_paths_for_storage(data_root: &Path, job: &mut JobSnapshot) -> Result<()> {
    let Some(artifacts) = job.artifacts.as_mut() else {
        return Ok(());
    };
    normalize_job_artifacts_for_storage(data_root, artifacts)
}

pub fn normalize_job_artifacts_for_storage(
    data_root: &Path,
    artifacts: &mut JobArtifacts,
) -> Result<()> {
    normalize_optional_path(data_root, &mut artifacts.job_root)?;
    normalize_optional_path(data_root, &mut artifacts.source_pdf)?;
    normalize_optional_path(data_root, &mut artifacts.layout_json)?;
    normalize_optional_path(data_root, &mut artifacts.normalized_document_json)?;
    normalize_optional_path(data_root, &mut artifacts.normalization_report_json)?;
    normalize_optional_path(data_root, &mut artifacts.provider_raw_dir)?;
    normalize_optional_path(data_root, &mut artifacts.provider_zip)?;
    normalize_optional_path(data_root, &mut artifacts.provider_summary_json)?;
    normalize_optional_path(data_root, &mut artifacts.translation_checkpoint_json)?;
    normalize_optional_path(data_root, &mut artifacts.translations_dir)?;
    normalize_optional_path(data_root, &mut artifacts.output_pdf)?;
    normalize_optional_path(data_root, &mut artifacts.cover_image_path)?;
    normalize_optional_path(data_root, &mut artifacts.thumbnail_image_path)?;
    normalize_optional_path(data_root, &mut artifacts.summary)?;
    normalize_optional_path(data_root, &mut artifacts.render_config_json)?;
    if let Some(diagnostics) = artifacts.ocr_provider_diagnostics.as_mut() {
        normalize_optional_path(data_root, &mut diagnostics.artifacts.provider_result_json)?;
        normalize_optional_path(data_root, &mut diagnostics.artifacts.provider_bundle_zip)?;
        normalize_optional_path(data_root, &mut diagnostics.artifacts.layout_json)?;
        normalize_optional_path(
            data_root,
            &mut diagnostics.artifacts.normalized_document_json,
        )?;
        normalize_optional_path(
            data_root,
            &mut diagnostics.artifacts.normalization_report_json,
        )?;
    }
    Ok(())
}

pub fn job_uses_legacy_output_layout(job: &JobSnapshot, data_root: &Path) -> bool {
    let Some(job_root) = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.job_root.as_ref())
    else {
        return false;
    };
    let Ok(root) = resolve_data_path(data_root, job_root) else {
        return false;
    };
    LEGACY_LAYOUT_DIR_NAMES
        .iter()
        .any(|name| root.join(name).exists())
}

pub fn job_uses_legacy_path_storage(job: &JobSnapshot) -> bool {
    let Some(artifacts) = job.artifacts.as_ref() else {
        return false;
    };
    let top_level_paths = [
        artifacts.job_root.as_deref(),
        artifacts.source_pdf.as_deref(),
        artifacts.layout_json.as_deref(),
        artifacts.normalized_document_json.as_deref(),
        artifacts.normalization_report_json.as_deref(),
        artifacts.provider_raw_dir.as_deref(),
        artifacts.provider_zip.as_deref(),
        artifacts.provider_summary_json.as_deref(),
        artifacts.translation_checkpoint_json.as_deref(),
        artifacts.translations_dir.as_deref(),
        artifacts.output_pdf.as_deref(),
        artifacts.cover_image_path.as_deref(),
        artifacts.thumbnail_image_path.as_deref(),
        artifacts.summary.as_deref(),
    ];
    if top_level_paths
        .into_iter()
        .flatten()
        .any(data_path_is_absolute)
    {
        return true;
    }
    artifacts
        .ocr_provider_diagnostics
        .as_ref()
        .map(|diagnostics| {
            [
                diagnostics.artifacts.provider_result_json.as_deref(),
                diagnostics.artifacts.provider_bundle_zip.as_deref(),
                diagnostics.artifacts.layout_json.as_deref(),
                diagnostics.artifacts.normalized_document_json.as_deref(),
                diagnostics.artifacts.normalization_report_json.as_deref(),
            ]
            .into_iter()
            .flatten()
            .any(data_path_is_absolute)
        })
        .unwrap_or(false)
}

fn normalize_optional_path(data_root: &Path, slot: &mut Option<String>) -> Result<()> {
    let Some(value) = slot
        .as_ref()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
    else {
        return Ok(());
    };
    *slot = Some(to_relative_data_path(data_root, Path::new(value))?);
    Ok(())
}
