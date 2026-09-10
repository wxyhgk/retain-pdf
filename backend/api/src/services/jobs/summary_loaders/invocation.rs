use std::path::Path;

use crate::models::api::InvocationSummaryView;
use crate::models::domain::JobSnapshot;

use super::shared::read_translation_manifest_or_pipeline_summary;

pub(crate) fn load_invocation_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<InvocationSummaryView> {
    read_translation_manifest_or_pipeline_summary(job, data_root)
        .find_map(load_invocation_summary_from_json)
}

fn load_invocation_summary_from_json(payload: serde_json::Value) -> Option<InvocationSummaryView> {
    let summary: InvocationSummaryView =
        serde_json::from_value(payload.get("invocation")?.clone()).ok()?;
    if !summary.stage.is_empty()
        || !summary.input_protocol.is_empty()
        || !summary.stage_spec_schema_version.is_empty()
    {
        Some(summary)
    } else {
        None
    }
}
