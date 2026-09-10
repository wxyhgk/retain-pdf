use serde_json::Value;

pub(super) fn bbox_from_value(value: Option<&Value>) -> Option<Vec<f64>> {
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

pub(super) fn canonical_item_id(value: &str) -> String {
    let Some((page, block)) = value.split_once("-b") else {
        return value.to_string();
    };
    let block_num = block.parse::<u32>().ok();
    match block_num {
        Some(num) => format!("{page}-b{num:04}"),
        None => value.to_string(),
    }
}

pub(super) fn value_string(value: Option<&Value>) -> String {
    value.and_then(Value::as_str).unwrap_or("").to_string()
}

fn value_string_first(item: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        let value = item.get(*key).and_then(Value::as_str).unwrap_or("").trim();
        if !value.is_empty() {
            return Some(value.to_string());
        }
    }
    None
}

pub(super) fn source_text_from_item(item: &Value) -> Option<String> {
    value_string_first(
        item,
        &[
            "translation_unit_protected_source_text",
            "group_protected_source_text",
            "protected_source_text",
            "source_text",
            "text",
            "content",
        ],
    )
}

pub(super) fn translated_text_from_item(item: &Value) -> Option<String> {
    value_string_first(
        item,
        &[
            "translation_unit_protected_translated_text",
            "translation_unit_translated_text",
            "group_protected_translated_text",
            "group_translated_text",
            "protected_translated_text",
            "translated_text",
        ],
    )
}

pub(super) fn markdown_from_item(item: &Value) -> Option<String> {
    value_string_first(
        item,
        &[
            "render_markdown",
            "translated_markdown",
            "markdown",
            "translation_unit_translated_markdown",
        ],
    )
}

pub(super) fn region_type_from_item(item: &Value) -> String {
    value_string_first(
        item,
        &[
            "region_type",
            "block_kind",
            "effective_role",
            "layout_role",
            "semantic_role",
            "structure_role",
            "block_type",
            "type",
        ],
    )
    .unwrap_or_else(|| "paragraph".to_string())
}

pub(super) fn translation_status_from_item(item: &Value) -> String {
    if let Some(status) = value_string_first(
        item,
        &[
            "final_status",
            "translation_status",
            "status",
            "classification_label",
            "skip_reason",
        ],
    ) {
        if !status.is_empty() {
            return status;
        }
    }
    if translated_text_from_item(item).is_some() {
        "translated".to_string()
    } else if item
        .get("should_translate")
        .and_then(Value::as_bool)
        .is_some_and(|value| !value)
    {
        "skipped".to_string()
    } else {
        "pending".to_string()
    }
}
