use std::collections::{BTreeMap, HashSet};
use std::path::Path;

use serde_json::Value;

use crate::error::AppError;
use crate::models::api::{ReaderRegionBoxView, ReaderRegionItemView, ReaderRegionsView};
use crate::models::domain::JobSnapshot;

mod artifacts;
mod metadata;
mod value_extract;

use artifacts::{
    has_translation_manifest, load_source_region_map, load_translation_manifest_pages, SourceRegion,
};
pub(crate) use metadata::load_reader_metadata_view;
use value_extract::{
    bbox_from_value, canonical_item_id, markdown_from_item, region_type_from_item,
    source_text_from_item, translated_text_from_item, translation_status_from_item, value_string,
};

pub(crate) fn load_reader_regions_view(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<ReaderRegionsView, AppError> {
    let source_regions = load_source_region_map(data_root, job)?;
    if !has_translation_manifest(data_root, job) {
        return Ok(ReaderRegionsView {
            items: source_only_items(source_regions, &HashSet::new()),
        });
    }
    let mut items = Vec::new();
    let mut translated_source_block_ids = HashSet::new();
    for (fallback_page_idx, page_items) in load_translation_manifest_pages(data_root, job)? {
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
            let translated_text = translated_text_from_item(&item);
            let markdown = markdown_from_item(&item).or_else(|| translated_text.clone());
            let status = translation_status_from_item(&item);
            let source_region = source_regions
                .get(&item_id)
                .cloned()
                .or_else(|| source_regions.get(&canonical_item_id(&item_id)).cloned());
            if let Some(region) = source_region.as_ref() {
                translated_source_block_ids.insert(region.block_id.clone());
            }
            let region_type = source_region
                .as_ref()
                .map(|region| region.region_type.clone())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| region_type_from_item(&item));
            let asset_ids = source_region
                .as_ref()
                .map(|region| region.asset_ids.clone())
                .unwrap_or_default();
            let asset_urls = source_region
                .as_ref()
                .map(|region| region.asset_urls.clone())
                .unwrap_or_default();
            let source = source_region
                .map(|region| ReaderRegionBoxView {
                    page: region.page,
                    bbox: region.bbox,
                    unit: "pdf_point".to_string(),
                    origin: "top_left".to_string(),
                    text: region.text,
                })
                .unwrap_or_else(|| ReaderRegionBoxView {
                    page: translated_page_idx + 1,
                    bbox: translated_bbox.clone(),
                    unit: "pdf_point".to_string(),
                    origin: "top_left".to_string(),
                    text: source_text_from_item(&item),
                });
            items.push(ReaderRegionItemView {
                item_id,
                source,
                translated: ReaderRegionBoxView {
                    page: translated_page_idx + 1,
                    bbox: translated_bbox,
                    unit: "pdf_point".to_string(),
                    origin: "top_left".to_string(),
                    text: translated_text,
                },
                markdown,
                region_type,
                status,
                asset_ids,
                asset_urls,
            });
        }
    }
    items.extend(source_only_items(
        source_regions,
        &translated_source_block_ids,
    ));
    Ok(ReaderRegionsView { items })
}

fn source_only_items(
    source_regions: std::collections::HashMap<String, SourceRegion>,
    excluded_block_ids: &HashSet<String>,
) -> Vec<ReaderRegionItemView> {
    let mut unique = BTreeMap::new();
    for region in source_regions.into_values() {
        unique.entry(region.block_id.clone()).or_insert(region);
    }
    unique
        .into_values()
        .filter(|region| !excluded_block_ids.contains(&region.block_id))
        .map(|region| {
            let source = ReaderRegionBoxView {
                page: region.page,
                bbox: region.bbox.clone(),
                unit: "pdf_point".to_string(),
                origin: "top_left".to_string(),
                text: region.text.clone(),
            };
            ReaderRegionItemView {
                item_id: region.block_id,
                source,
                translated: ReaderRegionBoxView {
                    page: region.page,
                    bbox: region.bbox,
                    unit: "pdf_point".to_string(),
                    origin: "top_left".to_string(),
                    text: None,
                },
                markdown: region.text,
                region_type: region.region_type,
                status: "source_only".to_string(),
                asset_ids: region.asset_ids,
                asset_urls: region.asset_urls,
            }
        })
        .collect()
}
