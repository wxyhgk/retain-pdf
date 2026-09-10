use std::path::Path;

use serde_json::Value;

use crate::error::AppError;

pub(super) fn read_json_value(path: &Path) -> Result<Value, AppError> {
    let text = std::fs::read_to_string(path)?;
    serde_json::from_str(&text)
        .map_err(|err| AppError::internal(format!("parse json {}: {err}", path.display())))
}

pub(super) fn value_string(value: Option<&Value>) -> String {
    value.and_then(Value::as_str).unwrap_or("").to_string()
}

pub(super) fn preview_text(value: String) -> String {
    let compact = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.chars().count() <= 220 {
        return compact;
    }
    compact.chars().take(219).collect::<String>() + "…"
}

pub(super) trait StringExt {
    fn if_empty_then(self, fallback: impl FnOnce() -> Option<String>) -> String;
}

impl StringExt for String {
    fn if_empty_then(self, fallback: impl FnOnce() -> Option<String>) -> String {
        if self.trim().is_empty() {
            fallback().unwrap_or_default()
        } else {
            self
        }
    }
}
