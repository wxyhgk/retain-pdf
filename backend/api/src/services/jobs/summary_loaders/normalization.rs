use std::path::Path;

use serde_json::Value;

use crate::models::api::NormalizationSummaryView;
use crate::models::domain::JobSnapshot;
use crate::storage_paths::resolve_normalization_report;

use super::shared::read_json_value;

pub(crate) fn load_normalization_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<NormalizationSummaryView> {
    let path = resolve_normalization_report(job, data_root)?;
    let payload = read_json_value(&path).ok()?;
    let normalization = payload.get("normalization").unwrap_or(&payload);
    let defaults = normalization.get("defaults");
    let validation = normalization.get("validation");
    Some(NormalizationSummaryView {
        provider: normalization
            .get("provider")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        detected_provider: normalization
            .get("detected_provider")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        provider_was_explicit: normalization
            .get("provider_was_explicit")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        pages_seen: defaults
            .and_then(|v| v.get("pages_seen"))
            .and_then(Value::as_i64),
        blocks_seen: defaults
            .and_then(|v| v.get("blocks_seen"))
            .and_then(Value::as_i64),
        document_defaults: defaults
            .and_then(|v| v.get("document_defaults"))
            .and_then(Value::as_object)
            .map(|m| m.len())
            .unwrap_or(0),
        page_defaults: defaults
            .and_then(|v| v.get("page_defaults"))
            .and_then(Value::as_object)
            .map(|m| m.len())
            .unwrap_or(0),
        block_defaults: defaults
            .and_then(|v| v.get("block_defaults"))
            .and_then(Value::as_object)
            .map(|m| m.len())
            .unwrap_or(0),
        schema: validation
            .and_then(|v| v.get("schema"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        schema_version: validation
            .and_then(|v| v.get("schema_version"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        page_count: validation
            .and_then(|v| v.get("page_count"))
            .and_then(Value::as_i64),
        block_count: validation
            .and_then(|v| v.get("block_count"))
            .and_then(Value::as_i64),
    })
}
