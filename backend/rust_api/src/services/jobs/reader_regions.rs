use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::error::AppError;
use crate::models::{JobSnapshot, ReaderRegionBoxView, ReaderRegionItemView, ReaderRegionsView};
use crate::storage_paths::{resolve_normalized_document, resolve_translation_manifest};

pub(crate) fn load_reader_regions_view(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<ReaderRegionsView, AppError> {
    let source_regions = load_source_region_map(data_root, job)?;
    let manifest_path = resolve_translation_manifest(job, data_root).ok_or_else(|| {
        AppError::not_found(format!("translation manifest not found: {}", job.job_id))
    })?;
    let mut items = Vec::new();
    for (fallback_page_idx, page_items) in load_manifest_pages(&manifest_path)? {
        for item in page_items {
            let item_id = value_string(item.get("item_id"));
            if item_id.is_empty() {
                continue;
            }
            let translated_bbox = match bbox_from_value(item.get("bbox")) {
                Some(value) => value,
                None => continue,
            };
            let translated_page_idx = item
                .get("page_idx")
                .and_then(Value::as_i64)
                .unwrap_or(fallback_page_idx);
            let source = source_regions
                .get(&item_id)
                .cloned()
                .or_else(|| source_regions.get(&canonical_item_id(&item_id)).cloned())
                .unwrap_or_else(|| ReaderRegionBoxView {
                    page: translated_page_idx + 1,
                    bbox: translated_bbox.clone(),
                    unit: "pdf_point".to_string(),
                    origin: "top_left".to_string(),
                });
            items.push(ReaderRegionItemView {
                item_id,
                source,
                translated: ReaderRegionBoxView {
                    page: translated_page_idx + 1,
                    bbox: translated_bbox,
                    unit: "pdf_point".to_string(),
                    origin: "top_left".to_string(),
                },
            });
        }
    }
    Ok(ReaderRegionsView { items })
}

fn load_manifest_pages(manifest_path: &Path) -> Result<Vec<(i64, Vec<Value>)>, AppError> {
    let text = std::fs::read_to_string(manifest_path)?;
    let manifest: Value = serde_json::from_str(&text).map_err(|err| {
        AppError::internal(format!(
            "parse translation manifest {}: {err}",
            manifest_path.display()
        ))
    })?;
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
        let payload_path = if Path::new(&rel_path).is_absolute() {
            PathBuf::from(&rel_path)
        } else {
            base_dir.join(&rel_path)
        };
        let text = std::fs::read_to_string(&payload_path)?;
        let page_payload: Value = serde_json::from_str(&text).map_err(|err| {
            AppError::internal(format!("parse translation page {}: {err}", payload_path.display()))
        })?;
        let items = page_payload.as_array().cloned().unwrap_or_default();
        result.push((page_idx, items));
    }
    Ok(result)
}

fn load_source_region_map(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<HashMap<String, ReaderRegionBoxView>, AppError> {
    let Some(path) = resolve_normalized_document(job, data_root) else {
        return Ok(HashMap::new());
    };
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let text = std::fs::read_to_string(&path)?;
    let payload: Value = serde_json::from_str(&text)
        .map_err(|err| AppError::internal(format!("parse normalized document {}: {err}", path.display())))?;
    let pages = payload.get("pages").and_then(Value::as_array).ok_or_else(|| {
        AppError::internal(format!("invalid normalized document: {}", path.display()))
    })?;
    let mut regions = HashMap::new();
    for page in pages {
        let page_idx = page.get("page_index").and_then(Value::as_i64).unwrap_or_else(|| {
            page.get("page").and_then(Value::as_i64).unwrap_or(1) - 1
        });
        let Some(blocks) = page.get("blocks").and_then(Value::as_array) else {
            continue;
        };
        for block in blocks {
            let block_id = value_string(block.get("block_id"));
            if block_id.is_empty() {
                continue;
            }
            let Some(bbox) = bbox_from_value(block.get("bbox")) else {
                continue;
            };
            let region = ReaderRegionBoxView {
                page: page_idx + 1,
                bbox,
                unit: "pdf_point".to_string(),
                origin: "top_left".to_string(),
            };
            regions.insert(block_id.clone(), region.clone());
            regions.insert(canonical_item_id(&block_id), region);
        }
    }
    Ok(regions)
}

fn bbox_from_value(value: Option<&Value>) -> Option<Vec<f64>> {
    let values = value?.as_array()?;
    if values.len() < 4 {
        return None;
    }
    let mut bbox = Vec::with_capacity(4);
    for value in values.iter().take(4) {
        let number = value.as_f64()?;
        if !number.is_finite() {
            return None;
        }
        bbox.push(number);
    }
    if bbox[2] <= bbox[0] || bbox[3] <= bbox[1] {
        return None;
    }
    Some(bbox)
}

fn canonical_item_id(value: &str) -> String {
    let Some((page, block)) = value.split_once("-b") else {
        return value.to_string();
    };
    let block_num = block.parse::<u32>().ok();
    match block_num {
        Some(num) => format!("{page}-b{num:04}"),
        None => value.to_string(),
    }
}

fn value_string(value: Option<&Value>) -> String {
    value.and_then(Value::as_str).unwrap_or("").to_string()
}
