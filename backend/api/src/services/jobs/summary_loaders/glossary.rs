use std::path::Path;

use crate::models::api::GlossaryUsageSummaryView;
use crate::models::domain::JobSnapshot;

use super::shared::read_translation_manifest_or_pipeline_summary;

pub(crate) fn load_glossary_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<GlossaryUsageSummaryView> {
    read_translation_manifest_or_pipeline_summary(job, data_root)
        .find_map(load_glossary_summary_from_json)
}

fn load_glossary_summary_from_json(payload: serde_json::Value) -> Option<GlossaryUsageSummaryView> {
    let summary: GlossaryUsageSummaryView =
        serde_json::from_value(payload.get("glossary")?.clone()).ok()?;
    if summary.enabled
        || summary.entry_count > 0
        || !summary.glossary_id.is_empty()
        || !summary.glossary_name.is_empty()
    {
        Some(summary)
    } else {
        None
    }
}
