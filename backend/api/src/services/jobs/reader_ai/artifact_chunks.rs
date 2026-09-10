use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::error::AppError;
use crate::models::domain::JobSnapshot;
use crate::storage_paths::resolve_translation_manifest;

use super::chunking::MarkdownChunk;

pub(super) fn chunks_from_translation_artifacts(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<Vec<MarkdownChunk>, AppError> {
    let Some(manifest_path) = resolve_translation_manifest(job, data_root) else {
        return Ok(Vec::new());
    };
    let manifest = read_json(&manifest_path)?;
    let pages = manifest
        .get("pages")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            AppError::internal(format!(
                "invalid translation manifest: {}",
                manifest_path.display()
            ))
        })?;
    let base_dir = manifest_path.parent().unwrap_or(&manifest_path);
    let mut chunks = Vec::new();
    let mut current_title = String::new();
    for page in pages {
        let page_number = page_number_from_manifest_page(page);
        let rel_path = value_string(page.get("path"));
        if rel_path.is_empty() {
            continue;
        }
        let payload = read_json(&resolve_payload_path(base_dir, &rel_path))?;
        let Some(items) = payload.as_array() else {
            continue;
        };
        for item in items {
            let text = readable_item_text(item);
            if text.is_empty() {
                continue;
            }
            let role = item_role(item);
            if is_heading_role(&role) {
                current_title = text;
                continue;
            }
            chunks.push(MarkdownChunk {
                title: fallback_title(&current_title, item),
                page: page_number.or_else(|| page_number_from_item(item)),
                text,
            });
        }
    }
    Ok(chunks)
}

fn read_json(path: &Path) -> Result<Value, AppError> {
    let text = std::fs::read_to_string(path)?;
    serde_json::from_str(&text)
        .map_err(|err| AppError::internal(format!("parse json {}: {err}", path.display())))
}

fn resolve_payload_path(base_dir: &Path, rel_path: &str) -> PathBuf {
    let path = Path::new(rel_path);
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        base_dir.join(path)
    }
}

fn page_number_from_manifest_page(page: &Value) -> Option<i64> {
    page.get("page_number").and_then(Value::as_i64).or_else(|| {
        page.get("page_index")
            .and_then(Value::as_i64)
            .map(|idx| idx + 1)
    })
}

fn page_number_from_item(item: &Value) -> Option<i64> {
    item.get("page_number").and_then(Value::as_i64).or_else(|| {
        item.get("page_idx")
            .and_then(Value::as_i64)
            .map(|idx| idx + 1)
    })
}

fn readable_item_text(item: &Value) -> String {
    value_string_first(
        item,
        &[
            "render_markdown",
            "translated_markdown",
            "markdown",
            "translation_unit_translated_markdown",
            "translation_unit_protected_translated_text",
            "translation_unit_translated_text",
            "group_protected_translated_text",
            "group_translated_text",
            "protected_translated_text",
            "translated_text",
            "source_text",
            "text",
            "content",
        ],
    )
}

fn item_role(item: &Value) -> String {
    value_string_first(
        item,
        &[
            "layout_role",
            "semantic_role",
            "structure_role",
            "normalized_sub_type",
            "block_kind",
            "block_type",
        ],
    )
    .to_lowercase()
}

fn fallback_title(current_title: &str, item: &Value) -> String {
    if !current_title.trim().is_empty() {
        return current_title.trim().to_string();
    }
    let role = item_role(item);
    if role.contains("abstract") {
        return "Abstract".to_string();
    }
    "Document".to_string()
}

fn is_heading_role(role: &str) -> bool {
    role.contains("title") || role.contains("heading")
}

fn value_string(value: Option<&Value>) -> String {
    value
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string()
}

fn value_string_first(item: &Value, keys: &[&str]) -> String {
    for key in keys {
        let value = value_string(item.get(*key));
        if !value.is_empty() {
            return value;
        }
    }
    String::new()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn builds_page_aware_chunks_from_translation_items() {
        let mut title = String::new();
        let heading = json!({"layout_role": "heading", "translated_text": "Introduction"});
        let body = json!({
            "page_idx": 4,
            "layout_role": "paragraph",
            "translated_text": "This is the body."
        });

        if is_heading_role(&item_role(&heading)) {
            title = readable_item_text(&heading);
        }
        let chunk = MarkdownChunk {
            title: fallback_title(&title, &body),
            page: page_number_from_item(&body),
            text: readable_item_text(&body),
        };

        assert_eq!(chunk.title, "Introduction");
        assert_eq!(chunk.page, Some(5));
        assert_eq!(chunk.text, "This is the body.");
    }
}
