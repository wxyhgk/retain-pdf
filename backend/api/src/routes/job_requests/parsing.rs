use crate::error::AppError;
use crate::models::request::GlossaryEntryInput;
use serde_json::Value;
use std::collections::BTreeMap;

pub(super) fn parse_glossary_entries_field(
    value: &str,
) -> Result<Vec<GlossaryEntryInput>, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str::<Vec<GlossaryEntryInput>>(trimmed)
        .map_err(|err| AppError::bad_request(format!("glossary_json must be a JSON array: {err}")))
}

pub(super) fn parse_json_object_field(
    name: &str,
    value: &str,
) -> Result<BTreeMap<String, Value>, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(BTreeMap::new());
    }
    let payload: Value = serde_json::from_str(trimmed)
        .map_err(|err| AppError::bad_request(format!("{name} must be a JSON object: {err}")))?;
    let Value::Object(object) = payload else {
        return Err(AppError::bad_request(format!(
            "{name} must be a JSON object"
        )));
    };
    Ok(object.into_iter().collect())
}

pub(super) fn parse_bool_like(value: &str) -> bool {
    matches!(
        value.trim(),
        "1" | "true" | "True" | "TRUE" | "yes" | "Yes" | "YES" | "on" | "ON"
    )
}

pub(super) fn parse_i64_like(name: &str, value: &str) -> Result<i64, AppError> {
    value
        .parse::<i64>()
        .map_err(|_| AppError::bad_request(format!("{name} must be an integer")))
}

pub(super) fn parse_f64_like(name: &str, value: &str) -> Result<f64, AppError> {
    value
        .parse::<f64>()
        .map_err(|_| AppError::bad_request(format!("{name} must be a number")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_glossary_entries_field_rejects_non_array_payload() {
        let err = parse_glossary_entries_field(r#"{"source":"band gap"}"#)
            .expect_err("should reject non-array glossary payload");
        assert!(err
            .to_string()
            .contains("glossary_json must be a JSON array"));
    }

    #[test]
    fn parse_json_object_field_rejects_non_object_payload() {
        let err =
            parse_json_object_field("ocr_options", r#"["x"]"#).expect_err("should reject arrays");
        assert!(err
            .to_string()
            .contains("ocr_options must be a JSON object"));
    }

    #[test]
    fn parse_json_object_field_accepts_object_payload() {
        let parsed = parse_json_object_field(
            "ocr_options",
            r#"{"command":"python run.py","enabled":true}"#,
        )
        .expect("object payload");
        assert_eq!(
            parsed.get("command").and_then(Value::as_str),
            Some("python run.py")
        );
        assert_eq!(parsed.get("enabled").and_then(Value::as_bool), Some(true));
    }
}
