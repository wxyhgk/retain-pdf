use std::path::{Component, Path, PathBuf};

use serde_json::Value;

use retainpdf_api_base::error::AppError;
use crate::views::TranslationDebugIndexView;
use retainpdf_core::models::domain::JobSnapshot;

use crate::translations::common::{read_json_value, value_string};
use crate::{stored_path, StoredFile};

pub(super) fn read_translation_debug_index_file(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<Option<TranslationDebugIndexView>, AppError> {
    let Some(path) = stored_path(job, data_root, StoredFile::TranslationDebugIndex) else {
        return Ok(None);
    };
    let text = std::fs::read_to_string(&path)?;
    let payload: TranslationDebugIndexView = serde_json::from_str(&text).map_err(|err| {
        AppError::internal(format!("parse debug index {}: {err}", path.display()))
    })?;
    Ok(Some(payload))
}

pub(super) fn translation_manifest_path(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<PathBuf, AppError> {
    // 任务在、还没翻译完：404 + `reason: not_ready`。列表接口接住它退回空列表。
    stored_path(job, data_root, StoredFile::TranslationManifest)
        .ok_or_else(|| AppError::not_ready("translation manifest"))
}

/// 翻译清单里的每一页：(页号, 清单里写的相对路径, 这一页的条目)。阅读区块和译文列表、单条译文都读它
/// （2026-11-02 以前阅读区块另有一份，报错说法和返回形状已经走样）。
///
/// 清单里的路径必须在清单所在的目录里面：Python 写的时候只写相对路径、读的时候拒绝绝对路径和跳出去的路径
/// （`core/payload/manifest.py`），这边以前都放行。
pub(crate) fn load_manifest_pages(
    manifest_path: &Path,
) -> Result<Vec<(i64, String, Vec<Value>)>, AppError> {
    let manifest = read_json_value(manifest_path)?;
    let pages = manifest
        .get("pages")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            AppError::internal(format!(
                "invalid translation manifest: {}",
                manifest_path.display()
            ))
        })?;
    let base_dir = manifest_path.parent().unwrap_or(manifest_path);
    let mut result = Vec::new();
    for page in pages {
        let page_idx = page
            .get("page_index")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        let rel_path = value_string(page.get("path"));
        if rel_path.is_empty() {
            continue;
        }
        let relative = Path::new(&rel_path);
        if relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_) | Component::CurDir))
        {
            return Err(AppError::internal(format!(
                "translation manifest page {page_idx} points outside the translation directory: {rel_path}"
            )));
        }
        let payload_path: PathBuf = base_dir.join(relative);
        let page_payload = read_json_value(&payload_path)?;
        let items = page_payload.as_array().cloned().unwrap_or_default();
        result.push((page_idx, rel_path, items));
    }
    Ok(result)
}

#[cfg(test)]
mod manifest_path_tests {
    use super::load_manifest_pages;

    fn manifest_with(dir: &std::path::Path, path: &str) -> std::path::PathBuf {
        std::fs::create_dir_all(dir).unwrap();
        std::fs::write(dir.join("page-001.json"), r#"[{"item_id": "p001-b000"}]"#).unwrap();
        let manifest = dir.join("translation-manifest.json");
        std::fs::write(
            &manifest,
            format!(r#"{{"pages": [{{"page_index": 0, "path": "{path}"}}]}}"#),
        )
        .unwrap();
        manifest
    }

    #[test]
    fn pages_are_read_relative_to_the_manifest() {
        let dir = std::env::temp_dir().join(format!("retainpdf-manifest-ok-{}", fastrand::u64(..)));
        let pages = load_manifest_pages(&manifest_with(&dir, "./page-001.json")).unwrap();
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].0, 0);
        assert_eq!(pages[0].2.len(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_page_path_outside_the_translation_directory_is_refused() {
        // Python 写清单只写相对路径、读的时候拒绝跳出去的（core/payload/manifest.py），这边以前照读。
        let dir = std::env::temp_dir().join(format!("retainpdf-manifest-escape-{}", fastrand::u64(..)));
        for path in ["../outside.json", "/etc/hosts"] {
            let error = load_manifest_pages(&manifest_with(&dir, path)).unwrap_err();
            assert!(error.to_string().contains("outside the translation directory"), "{path}: {error}");
        }
        let _ = std::fs::remove_dir_all(&dir);
    }
}
