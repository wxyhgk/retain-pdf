use std::collections::HashMap;
use std::fs;
use std::path::Path;

use serde_json::Value;

use crate::models::api::LiveTranslationTypographyView;
use crate::models::domain::JobSnapshot;
use crate::storage_paths::resolve_job_root;

use super::{bbox_from_value, canonical_item_id, first_string, json_u64, positive_number};

const RENDER_PREWARM_SCHEMA: &str = "render_source_prewarm_v1";
const RENDER_PREWARM_MANIFEST: &str =
    "artifacts/render_prewarm/render_source_prewarm_manifest.json";

#[derive(Debug, Clone)]
pub(super) struct TypographyPlan {
    pub(super) bbox: Vec<f64>,
    pub(super) view: LiveTranslationTypographyView,
}

pub(super) type TypographyIndex = HashMap<(u32, String), TypographyPlan>;

pub(super) fn load_typography_index(data_root: &Path, job: &JobSnapshot) -> TypographyIndex {
    let Some(job_root) = resolve_job_root(job, data_root) else {
        return TypographyIndex::new();
    };
    let Ok(bytes) = fs::read(job_root.join(RENDER_PREWARM_MANIFEST)) else {
        return TypographyIndex::new();
    };
    let Ok(manifest) = serde_json::from_slice::<Value>(&bytes) else {
        return TypographyIndex::new();
    };
    if manifest.get("schema").and_then(Value::as_str) != Some(RENDER_PREWARM_SCHEMA) {
        return TypographyIndex::new();
    }
    let Some(page_specs) = manifest
        .get("payload_prewarm")
        .and_then(|value| value.get("background_render_page_specs"))
        .and_then(|value| value.get("page_specs"))
        .and_then(Value::as_array)
    else {
        return TypographyIndex::new();
    };
    let font_family = job.request_payload.render.typst_font_family.trim();
    if font_family.is_empty() {
        return TypographyIndex::new();
    }

    page_specs
        .iter()
        .filter_map(|page| Some((json_u64(page, "page_index")? as u32, page)))
        .flat_map(|(page_idx, page)| {
            page.get("blocks")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(move |block| {
                    let raw_item_id = first_string(block, &["source_item_id", "block_id"])?;
                    let raw_item_id = raw_item_id.strip_prefix("item-").unwrap_or(&raw_item_id);
                    let item_id = canonical_item_id(raw_item_id);
                    let typography = typography_from_manifest_block(block, font_family)?;
                    Some(((page_idx, item_id), typography))
                })
        })
        .collect()
}

fn typography_from_manifest_block(block: &Value, font_family: &str) -> Option<TypographyPlan> {
    let font_size_pt = positive_number(block.get("font_size_pt"))?;
    let leading_em = positive_number(block.get("leading_em"))?;
    let background_rect = bbox_from_value(block.get("background_rect"))?;
    let content_rect = bbox_from_value(block.get("content_rect"))?;
    if content_rect[0] < background_rect[0]
        || content_rect[1] < background_rect[1]
        || content_rect[2] > background_rect[2]
        || content_rect[3] > background_rect[3]
    {
        return None;
    }
    let fit_min_font_size_pt = positive_number(block.get("fit_min_font_size_pt"))
        .unwrap_or(font_size_pt)
        .min(font_size_pt);
    let fit_max_font_size_pt = positive_number(block.get("fit_max_font_size_pt"))
        .unwrap_or(font_size_pt)
        .max(font_size_pt);

    Some(TypographyPlan {
        bbox: background_rect.clone(),
        view: LiveTranslationTypographyView {
            font_family: font_family.to_string(),
            font_size_pt,
            leading_em,
            font_weight: font_weight_from_value(block.get("font_weight"))?,
            text_align: if block.get("justify_text").and_then(Value::as_bool) == Some(true) {
                "justify".to_string()
            } else {
                "left".to_string()
            },
            padding_top_pt: content_rect[1] - background_rect[1],
            padding_right_pt: background_rect[2] - content_rect[2],
            padding_bottom_pt: background_rect[3] - content_rect[3],
            padding_left_pt: content_rect[0] - background_rect[0],
            fit_min_font_size_pt,
            fit_max_font_size_pt,
        },
    })
}

fn font_weight_from_value(value: Option<&Value>) -> Option<u16> {
    if let Some(weight) = value.and_then(Value::as_u64) {
        return (1..=1000).contains(&weight).then_some(weight as u16);
    }
    match value
        .and_then(Value::as_str)?
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "thin" => Some(100),
        "extralight" | "extra-light" | "ultralight" | "ultra-light" => Some(200),
        "light" => Some(300),
        "regular" | "normal" => Some(400),
        "medium" => Some(500),
        "semibold" | "semi-bold" | "demibold" | "demi-bold" => Some(600),
        "bold" => Some(700),
        "extrabold" | "extra-bold" | "ultrabold" | "ultra-bold" => Some(800),
        "black" | "heavy" => Some(900),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_renderer_weight_and_fit_sentinels() {
        let block = serde_json::json!({
            "background_rect": [10.0, 20.0, 110.0, 70.0],
            "content_rect": [12.0, 23.0, 106.0, 65.0],
            "font_size_pt": 9.0,
            "leading_em": 0.56,
            "font_weight": "bold",
            "fit_min_font_size_pt": 0.0,
            "fit_max_font_size_pt": 0.0
        });
        let plan = typography_from_manifest_block(&block, "Source Han Serif SC")
            .expect("valid typography plan");
        assert_eq!(plan.view.font_weight, 700);
        assert_eq!(plan.view.fit_min_font_size_pt, 9.0);
        assert_eq!(plan.view.fit_max_font_size_pt, 9.0);
        assert_eq!(plan.view.padding_left_pt, 2.0);
    }

    #[test]
    fn rejects_unknown_weight_and_content_rect_outside_background() {
        let unknown_weight = serde_json::json!({
            "background_rect": [10.0, 20.0, 110.0, 70.0],
            "content_rect": [12.0, 23.0, 106.0, 65.0],
            "font_size_pt": 9.0,
            "leading_em": 0.56,
            "font_weight": "unexpected"
        });
        assert!(typography_from_manifest_block(&unknown_weight, "Test").is_none());

        let outside = serde_json::json!({
            "background_rect": [10.0, 20.0, 110.0, 70.0],
            "content_rect": [9.0, 23.0, 106.0, 65.0],
            "font_size_pt": 9.0,
            "leading_em": 0.56,
            "font_weight": "regular"
        });
        assert!(typography_from_manifest_block(&outside, "Test").is_none());
    }
}
