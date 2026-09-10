use std::path::Path;

use anyhow::{Context, Result};

pub(super) fn export_markdown_bundle(provider_raw_dir: &str, job_root: Option<&str>) -> Result<()> {
    let Some(job_root) = job_root.filter(|value| !value.trim().is_empty()) else {
        return Ok(());
    };
    let provider_raw_dir = Path::new(provider_raw_dir);
    let markdown_dir = Path::new(job_root).join("md");
    std::fs::create_dir_all(&markdown_dir)?;

    for entry in std::fs::read_dir(provider_raw_dir)
        .with_context(|| format!("failed to read {}", provider_raw_dir.display()))?
    {
        let entry = entry?;
        let source_path = entry.path();
        let file_name = entry.file_name();
        let target_path = markdown_dir.join(&file_name);

        if source_path.is_file()
            && source_path
                .extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
        {
            std::fs::copy(&source_path, &target_path).with_context(|| {
                format!(
                    "failed to copy markdown file from {} to {}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
            continue;
        }

        if source_path.is_dir() && file_name == "images" {
            copy_dir_recursive(&source_path, &target_path)?;
        }
    }

    Ok(())
}

fn copy_dir_recursive(source_dir: &Path, target_dir: &Path) -> Result<()> {
    std::fs::create_dir_all(target_dir)?;
    for entry in std::fs::read_dir(source_dir)
        .with_context(|| format!("failed to read {}", source_dir.display()))?
    {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target_dir.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else {
            if let Some(parent) = target_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(&source_path, &target_path).with_context(|| {
                format!(
                    "failed to copy resource file from {} to {}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        }
    }
    Ok(())
}
