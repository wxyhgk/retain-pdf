use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct PipelineCheckpointPageObservation {
    pub(crate) unit_key: String,
    pub(crate) unit_order: u64,
    pub(crate) page_index: u32,
    pub(crate) page_hash: String,
    #[serde(default)]
    pub(crate) changed_item_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct PipelineCheckpointObservation {
    pub(crate) schema: String,
    pub(crate) schema_version: u32,
    pub(crate) stage: String,
    pub(crate) phase: String,
    pub(crate) status: String,
    pub(crate) producer_generation: u64,
    pub(crate) unit_key: Option<String>,
    pub(crate) unit_order: Option<u64>,
    pub(crate) page_index: Option<u32>,
    pub(crate) page_hash: Option<String>,
    #[serde(default)]
    pub(crate) committed_pages: Vec<PipelineCheckpointPageObservation>,
    #[serde(default)]
    pub(crate) progress: Value,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub(crate) struct PipelineStageObservationLine {
    pub(crate) schema: String,
    pub(crate) schema_version: u32,
    pub(crate) job_id: String,
    pub(crate) seq: u64,
    pub(crate) ts: String,
    #[serde(default)]
    pub(crate) user_stage: String,
    pub(crate) stage: String,
    #[serde(default)]
    pub(crate) substage: String,
    #[serde(default)]
    pub(crate) stage_detail: String,
    #[serde(default)]
    pub(crate) provider: String,
    #[serde(default)]
    pub(crate) provider_stage: String,
    pub(crate) event_type: String,
    pub(crate) message: String,
    pub(crate) progress_current: Option<i64>,
    pub(crate) progress_total: Option<i64>,
    #[serde(default)]
    pub(crate) progress_unit: String,
    #[serde(default)]
    pub(crate) payload: Value,
}

#[derive(Deserialize)]
struct Envelope {
    event_type: String,
    payload: Value,
}

pub(crate) fn parse_pipeline_checkpoint_line(line: &str) -> Option<PipelineCheckpointObservation> {
    let envelope = serde_json::from_str::<Envelope>(line).ok()?;
    if envelope.event_type.trim() != "pipeline_checkpoint" {
        return None;
    }
    let observation =
        serde_json::from_value::<PipelineCheckpointObservation>(envelope.payload).ok()?;
    if observation.schema != "pipeline_checkpoint_v1" || observation.schema_version != 1 {
        return None;
    }
    Some(observation)
}

pub(crate) fn parse_pipeline_stage_observation_line(
    line: &str,
) -> Option<PipelineStageObservationLine> {
    let observation = serde_json::from_str::<PipelineStageObservationLine>(line).ok()?;
    if observation.schema != "pipeline_stage_observation_v1"
        || observation.schema_version != 1
        || !matches!(
            observation.event_type.as_str(),
            "stage_transition" | "stage_progress"
        )
        || observation.job_id.trim().is_empty()
        || observation.stage.trim().is_empty()
    {
        return None;
    }
    Some(observation)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_checkpoint_observation() {
        let line = r#"{"event_type":"pipeline_checkpoint","payload":{"schema":"pipeline_checkpoint_v1","schema_version":1,"stage":"translate","phase":"translating","status":"in_progress","producer_generation":4,"unit_key":"p1-u7","unit_order":7,"page_index":0,"page_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","progress":{"completed_item_count":8,"item_count":20}}}"#;
        let parsed = parse_pipeline_checkpoint_line(line).expect("checkpoint observation");
        assert_eq!(parsed.stage, "translate");
        assert_eq!(parsed.unit_key.as_deref(), Some("p1-u7"));
        assert_eq!(parsed.unit_order, Some(7));
        assert_eq!(parsed.producer_generation, 4);
        assert!(parsed.committed_pages.is_empty());
    }

    #[test]
    fn parses_checkpoint_with_multiple_committed_pages() {
        let line = r#"{"event_type":"pipeline_checkpoint","payload":{"schema":"pipeline_checkpoint_v1","schema_version":1,"stage":"translate","phase":"translating","status":"in_progress","producer_generation":5,"committed_pages":[{"unit_key":"p001-b4","unit_order":4,"page_index":0,"page_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","changed_item_ids":["p001-b3","p001-b4"]},{"unit_key":"p002-b2","unit_order":8,"page_index":1,"page_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","changed_item_ids":["p002-b2"]}],"progress":{"completed_item_count":9,"item_count":20}}}"#;
        let parsed = parse_pipeline_checkpoint_line(line).expect("checkpoint observation");
        assert_eq!(parsed.committed_pages.len(), 2);
        assert_eq!(parsed.committed_pages[0].page_index, 0);
        assert_eq!(
            parsed.committed_pages[0].changed_item_ids,
            ["p001-b3", "p001-b4"]
        );
    }

    #[test]
    fn rejects_unknown_checkpoint_schema() {
        let line = r#"{"event_type":"pipeline_checkpoint","payload":{"schema":"future","schema_version":2,"stage":"translate","phase":"translating","status":"in_progress","producer_generation":4}}"#;
        assert!(parse_pipeline_checkpoint_line(line).is_none());
    }

    #[test]
    fn parses_stage_observation() {
        let line = r#"{"schema":"pipeline_stage_observation_v1","schema_version":1,"job_id":"job-1","seq":7,"ts":"2026-08-26T00:00:00Z","user_stage":"translation","stage":"translating","substage":"translation_batches","event_type":"stage_progress","message":"batch 3/5","progress_current":3,"progress_total":5,"progress_unit":"batch","payload":{}}"#;
        let parsed = parse_pipeline_stage_observation_line(line).expect("stage observation");
        assert_eq!(parsed.seq, 7);
        assert_eq!(parsed.user_stage, "translation");
        assert_eq!(parsed.substage, "translation_batches");
    }

    #[test]
    fn rejects_unversioned_stage_jsonl_record() {
        let line = r#"{"job_id":"job-1","seq":7,"stage":"translating","event_type":"stage_progress","message":"legacy","payload":{}}"#;
        assert!(parse_pipeline_stage_observation_line(line).is_none());
    }
}
