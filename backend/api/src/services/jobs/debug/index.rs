use std::path::Path;

use serde_json::Value;

use crate::error::AppError;
use crate::models::api::{
    ListTranslationItemsQuery, TranslationDebugIndexView, TranslationDebugListItemView,
    TranslationDebugListView,
};
use crate::models::domain::JobSnapshot;

use super::artifacts::{
    load_manifest_pages, read_translation_debug_index_file, translation_manifest_path,
};
use super::common::{preview_text, value_string, StringExt};

pub(crate) fn load_translation_debug_list_view(
    data_root: &Path,
    job: &JobSnapshot,
    query: &ListTranslationItemsQuery,
) -> Result<TranslationDebugListView, AppError> {
    let mut items = load_translation_debug_index(data_root, job)?.items;
    apply_translation_item_filters(&mut items, query);
    let total = items.len();
    let start = query.offset as usize;
    let end = start.saturating_add(query.limit as usize).min(total);
    let items = if start >= total {
        Vec::new()
    } else {
        items[start..end].to_vec()
    };
    Ok(TranslationDebugListView {
        items,
        total,
        limit: query.limit,
        offset: query.offset,
    })
}

pub(super) fn load_translation_debug_index(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<TranslationDebugIndexView, AppError> {
    if let Some(mut payload) = read_translation_debug_index_file(data_root, job)? {
        normalize_page_numbers(&mut payload.items);
        return Ok(payload);
    }

    let manifest_path = translation_manifest_path(data_root, job)?;
    let mut items = Vec::new();
    for (page_idx, _page_path, page_items) in load_manifest_pages(&manifest_path)? {
        for item in page_items {
            items.push(build_index_item_from_value(&item, page_idx));
        }
    }
    Ok(TranslationDebugIndexView {
        schema: "translation_debug_index_v1".to_string(),
        schema_version: 1,
        items,
    })
}

/// 索引文件里只有 0 基的 `page_idx`，没有 1 基的 `page_number`。
///
/// Python 侧写这个 artifact 时就没有 `page_number` 这个字段（实测产物 25 个键里
/// 没有它），而视图字段带 `#[serde(default)]`，于是反序列化出来恒为 0——
/// `?page=N`（N≥1）永远匹配不上任何条目。下面那条 manifest 兜底路径在
/// `build_index_item_from_value` 里算了 `page_idx + 1`，两条路径的不变式对不上。
///
/// 这里在汇合点补齐，让「从索引文件读」和「从 manifest 重建」产出同一个契约。
/// 非零值原样保留：哪天 Python 真开始写这个字段，以它为准。
fn normalize_page_numbers(items: &mut [TranslationDebugListItemView]) {
    for item in items.iter_mut() {
        if item.page_number <= 0 {
            item.page_number = item.page_idx + 1;
        }
    }
}

fn build_index_item_from_value(
    item: &Value,
    fallback_page_idx: i64,
) -> TranslationDebugListItemView {
    let diagnostics = item
        .get("translation_diagnostics")
        .and_then(Value::as_object);
    let route_path = diagnostics
        .and_then(|diag| diag.get("route_path"))
        .and_then(Value::as_array)
        .map(|parts| {
            parts
                .iter()
                .map(|part| value_string(Some(part)))
                .filter(|part| !part.is_empty())
                .collect()
        })
        .unwrap_or_default();
    let error_types = diagnostics
        .and_then(|diag| diag.get("error_trace"))
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| entry.get("type"))
                .map(|value| value_string(Some(value)))
                .filter(|value| !value.is_empty())
                .collect()
        })
        .unwrap_or_default();
    let page_idx = item
        .get("page_idx")
        .and_then(Value::as_i64)
        .unwrap_or(fallback_page_idx);
    TranslationDebugListItemView {
        item_id: value_string(item.get("item_id")),
        page_idx,
        page_number: page_idx + 1,
        block_idx: item.get("block_idx").and_then(Value::as_i64).unwrap_or(-1),
        block_type: value_string(item.get("block_type")),
        math_mode: value_string(item.get("math_mode")),
        continuation_group: value_string(item.get("continuation_group")),
        classification_label: value_string(item.get("classification_label")),
        should_translate: item
            .get("should_translate")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        skip_reason: value_string(item.get("skip_reason")),
        final_status: value_string(item.get("final_status")).if_empty_then(|| {
            diagnostics
                .and_then(|diag| diag.get("final_status"))
                .map(|value| value_string(Some(value)))
        }),
        source_preview: preview_text(value_string(item.get("source_text"))),
        translated_preview: preview_text(value_string(item.get("translated_text"))),
        route_path,
        fallback_to: diagnostics
            .and_then(|diag| diag.get("fallback_to"))
            .map(|value| value_string(Some(value)))
            .unwrap_or_default(),
        degradation_reason: diagnostics
            .and_then(|diag| diag.get("degradation_reason"))
            .map(|value| value_string(Some(value)))
            .unwrap_or_default(),
        error_types,
    }
}

fn apply_translation_item_filters(
    items: &mut Vec<TranslationDebugListItemView>,
    query: &ListTranslationItemsQuery,
) {
    let page = query.page.map(i64::from);
    let final_status: Option<String> = query
        .final_status
        .as_ref()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());
    let error_type: Option<String> = query
        .error_type
        .as_ref()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());
    let route: Option<String> = query
        .route
        .as_ref()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());
    let q: Option<String> = query
        .q
        .as_ref()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());

    items.retain(|item| {
        if let Some(page_number) = page {
            if item.page_number != page_number {
                return false;
            }
        }
        if let Some(expected) = final_status.as_ref() {
            if item.final_status.to_ascii_lowercase() != *expected {
                return false;
            }
        }
        if let Some(expected) = error_type.as_ref() {
            if !item
                .error_types
                .iter()
                .any(|value: &String| value.to_ascii_lowercase() == *expected)
            {
                return false;
            }
        }
        if let Some(expected) = route.as_ref() {
            let joined = item.route_path.join("/").to_ascii_lowercase();
            if !joined.contains(expected) {
                return false;
            }
        }
        if let Some(expected) = q.as_ref() {
            let haystacks = [
                item.item_id.to_ascii_lowercase(),
                item.source_preview.to_ascii_lowercase(),
                item.translated_preview.to_ascii_lowercase(),
            ];
            if !haystacks
                .iter()
                .any(|value: &String| value.contains(expected))
            {
                return false;
            }
        }
        true
    });
}
