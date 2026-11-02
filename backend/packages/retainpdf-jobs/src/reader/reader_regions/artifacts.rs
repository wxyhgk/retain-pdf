use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};

use serde_json::Value;

use retainpdf_api_base::error::AppError;
use retainpdf_files::job_ocr_images_base_path;
use retainpdf_core::models::domain::JobSnapshot;

use super::value_extract::{
    bbox_from_value, canonical_item_id, heading_level_from_block, reading_order_from_item,
    region_type_from_item, source_text_from_item, sub_type_from_item, value_string,
};
use crate::{stored_path, StoredFile};

#[derive(Clone)]
pub(super) struct SourceRegion {
    pub(super) block_id: String,
    pub(super) page: i64,
    pub(super) bbox: Vec<f64>,
    pub(super) text: Option<String>,
    pub(super) region_type: String,
    pub(super) asset_ids: Vec<String>,
    pub(super) asset_urls: Vec<String>,
    pub(super) reading_order: Option<i64>,
    pub(super) sub_type: Option<String>,
    pub(super) heading_level: Option<i64>,
}

pub(super) fn has_translation_manifest(data_root: &Path, job: &JobSnapshot) -> bool {
    stored_path(job, data_root, StoredFile::TranslationManifest).is_some_and(|path| path.is_file())
}

pub(super) fn load_translation_manifest_pages(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<Vec<(i64, Vec<Value>)>, AppError> {
    // 调用方先看过 `has_translation_manifest`；万一走到这里也按「还没产出」报。
    let manifest_path = stored_path(job, data_root, StoredFile::TranslationManifest)
        .ok_or_else(|| AppError::not_ready("translation manifest"))?;
    Ok(crate::translations::load_manifest_pages(&manifest_path)?
        .into_iter()
        .map(|(page_idx, _path, items)| (page_idx, items))
        .collect())
}

pub(super) fn load_source_region_map(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<HashMap<String, SourceRegion>, AppError> {
    let Some(path) = stored_path(job, data_root, StoredFile::NormalizedDocument) else {
        return Ok(HashMap::new());
    };
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let text = std::fs::read_to_string(&path)?;
    let payload: Value = serde_json::from_str(&text).map_err(|err| {
        AppError::internal(format!(
            "parse normalized document {}: {err}",
            path.display()
        ))
    })?;
    let pages = payload
        .get("pages")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            AppError::internal(format!("invalid normalized document: {}", path.display()))
        })?;
    let asset_catalog = payload
        .get("assets")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let markdown_images_dir = stored_path(job, data_root, StoredFile::OcrImagesDir);
    let mut regions = HashMap::new();
    for page in pages {
        let page_idx = page
            .get("page_index")
            .and_then(Value::as_i64)
            .unwrap_or_else(|| page.get("page").and_then(Value::as_i64).unwrap_or(1) - 1);
        let Some(blocks) = page.get("blocks").and_then(Value::as_array) else {
            continue;
        };
        for block in blocks {
            let block_id = value_string(block.get("block_id"));
            if block_id.is_empty() {
                continue;
            }
            // Historical Paddle jobs stored geometry.bbox in provider pixels,
            // while compatibility block.bbox was already converted to PDF points.
            // New artifacts validate both fields as equal, so this order supports both.
            let compatibility_bbox = bbox_from_value(block.get("bbox"));
            let geometry_bbox = block
                .get("geometry")
                .and_then(|geometry| bbox_from_value(geometry.get("bbox")));
            let Some(bbox) = compatibility_bbox.or(geometry_bbox) else {
                continue;
            };
            let asset_ids = asset_ids_from_block(block);
            let asset_urls = asset_ids
                .iter()
                .filter_map(|asset_id| {
                    markdown_asset_url(
                        job,
                        page_idx,
                        asset_id,
                        asset_catalog.get(asset_id),
                        markdown_images_dir.as_deref(),
                    )
                })
                .collect();
            let sub_type = sub_type_from_item(block);
            let region = SourceRegion {
                heading_level: heading_level_from_block(block, sub_type.as_deref()),
                reading_order: reading_order_from_item(block, &block_id),
                sub_type,
                block_id: block_id.clone(),
                page: page_idx + 1,
                bbox,
                text: source_text_from_item(block),
                region_type: region_type_from_item(block),
                asset_ids,
                asset_urls,
            };
            regions.insert(block_id.clone(), region.clone());
            regions.insert(canonical_item_id(&block_id), region);
        }
    }
    Ok(regions)
}

fn asset_ids_from_block(block: &Value) -> Vec<String> {
    let Some(content) = block.get("content").and_then(Value::as_object) else {
        return Vec::new();
    };
    let mut asset_ids = Vec::new();
    if let Some(asset_id) = content.get("asset_id").and_then(Value::as_str) {
        push_unique(&mut asset_ids, asset_id);
    }
    if let Some(values) = content.get("asset_ids").and_then(Value::as_array) {
        for value in values {
            if let Some(asset_id) = value.as_str() {
                push_unique(&mut asset_ids, asset_id);
            }
        }
    }
    asset_ids
}

fn push_unique(values: &mut Vec<String>, value: &str) {
    let value = value.trim();
    if !value.is_empty() && !values.iter().any(|existing| existing == value) {
        values.push(value.to_string());
    }
}

fn markdown_asset_url(
    job: &JobSnapshot,
    page_idx: i64,
    asset_id: &str,
    asset_record: Option<&Value>,
    markdown_images_dir: Option<&Path>,
) -> Option<String> {
    let catalog_uri = asset_record
        .and_then(|value| {
            value
                .get("uri")
                .and_then(Value::as_str)
                .or_else(|| value.as_str())
        })
        .unwrap_or("");
    let relative = markdown_asset_relative_path(catalog_uri, asset_id, page_idx)?;
    let images_dir = markdown_images_dir?;
    let candidate = images_dir.join(&relative);
    if !candidate.is_file() {
        return None;
    }
    Some(format!(
        "{}{}",
        job_ocr_images_base_path(&job.job_id),
        url_path_escape(&relative.to_string_lossy().replace('\\', "/"))
    ))
}

fn markdown_asset_relative_path(uri: &str, asset_id: &str, page_idx: i64) -> Option<PathBuf> {
    let mut raw = if uri.trim().is_empty() { asset_id } else { uri }
        .trim()
        .replace('\\', "/");
    if raw.starts_with('/') {
        return None;
    }
    while raw.starts_with("./") {
        raw = raw[2..].to_string();
    }
    for prefix in ["md/images/", "images/"] {
        if raw.starts_with(prefix) {
            raw = raw[prefix.len()..].to_string();
            break;
        }
    }
    if !raw.starts_with("page-") {
        raw = format!("page-{}/{raw}", page_idx + 1);
    }
    let mut clean = PathBuf::new();
    for component in Path::new(&raw).components() {
        match component {
            Component::Normal(part) => clean.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    (!clean.as_os_str().is_empty()).then_some(clean)
}

fn url_path_escape(path: &str) -> String {
    path.split('/')
        .map(|segment| {
            let mut encoded = String::new();
            for byte in segment.as_bytes() {
                let ch = *byte as char;
                if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '~') {
                    encoded.push(ch);
                } else {
                    encoded.push_str(&format!("%{byte:02X}"));
                }
            }
            encoded
        })
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use super::markdown_asset_relative_path;

    #[test]
    fn markdown_asset_relative_path_rejects_paths_outside_authenticated_image_root() {
        assert!(markdown_asset_relative_path("../../secret.png", "asset", 0).is_none());
        assert!(markdown_asset_relative_path("/absolute.png", "asset", 0).is_none());
        assert!(markdown_asset_relative_path("", "../secret.png", 0).is_none());
        assert_eq!(
            markdown_asset_relative_path("md/images/page-3/imgs/chart a.png", "asset", 2)
                .expect("safe path")
                .to_string_lossy(),
            "page-3/imgs/chart a.png"
        );
    }
}
