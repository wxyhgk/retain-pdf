use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

use serde::Deserialize;
use serde_json::Value;
use tracing::warn;

use crate::models::api::JobEventRecord;
use crate::models::domain::{event_progress_unit, job_user_stage, normalize_event_user_stage};

#[derive(Debug, Deserialize)]
struct PipelineEventJsonlRecord {
    #[serde(default)]
    schema: Option<String>,
    #[serde(default)]
    schema_version: Option<u32>,
    #[serde(default)]
    job_id: Option<String>,
    #[serde(default)]
    ts: Option<String>,
    #[serde(default)]
    level: Option<String>,
    #[serde(default)]
    user_stage: Option<String>,
    #[serde(default)]
    stage: Option<String>,
    #[serde(default)]
    substage: Option<String>,
    #[serde(default)]
    stage_detail: Option<String>,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default)]
    provider_stage: Option<String>,
    #[serde(default)]
    event: Option<String>,
    #[serde(default)]
    event_type: Option<String>,
    #[serde(default)]
    raw_event_type: Option<String>,
    #[serde(default)]
    semantic_event_type: Option<String>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    progress_current: Option<i64>,
    #[serde(default)]
    progress_total: Option<i64>,
    #[serde(default)]
    progress_unit: Option<String>,
    #[serde(default)]
    retry_count: Option<u32>,
    #[serde(default)]
    elapsed_ms: Option<i64>,
    #[serde(default)]
    payload: Option<Value>,
}

pub(super) fn load_pipeline_events_jsonl(
    job_id: &str,
    path: &Path,
    base_seq: i64,
) -> Vec<JobEventRecord> {
    let Ok(file) = File::open(path) else {
        warn!(
            job_id,
            path = %path.display(),
            "failed to open pipeline events jsonl"
        );
        return Vec::new();
    };
    let mut reader = BufReader::new(file);
    let mut pending_line: Option<(String, bool, usize)> = None;
    let mut records = Vec::new();
    let mut line_number = 0usize;
    loop {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                let terminated = line.ends_with('\n');
                line_number += 1;
                if let Some((previous_line, previous_terminated, previous_number)) =
                    pending_line.replace((line, terminated, line_number))
                {
                    if !push_pipeline_event_line(
                        job_id,
                        path,
                        base_seq,
                        &mut records,
                        previous_line,
                        previous_terminated,
                        previous_number,
                        false,
                    ) {
                        return records;
                    }
                }
            }
            Err(err) => {
                warn!(
                    job_id,
                    path = %path.display(),
                    error = %err,
                    "failed to read pipeline events jsonl"
                );
                break;
            }
        }
    }

    if let Some((line, terminated, number)) = pending_line {
        push_pipeline_event_line(
            job_id,
            path,
            base_seq,
            &mut records,
            line,
            terminated,
            number,
            true,
        );
    }
    records
}

#[allow(clippy::too_many_arguments)]
fn push_pipeline_event_line(
    job_id: &str,
    path: &Path,
    base_seq: i64,
    records: &mut Vec<JobEventRecord>,
    line: String,
    terminated: bool,
    line_number: usize,
    is_final_line: bool,
) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return true;
    }
    let parsed = match serde_json::from_str::<PipelineEventJsonlRecord>(trimmed) {
        Ok(parsed) => parsed,
        Err(err) => {
            let partial_final_line = is_final_line && !terminated;
            warn!(
                job_id,
                path = %path.display(),
                line = line_number,
                error = %err,
                partial_final_line,
                "failed to parse pipeline events jsonl line"
            );
            return partial_final_line;
        }
    };
    if parsed
        .job_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != job_id)
        .is_some()
    {
        return true;
    }
    let event = normalized_event_name(&parsed);
    let raw_event_type = parsed
        .raw_event_type
        .clone()
        .or_else(|| parsed.event_type.clone())
        .or_else(|| Some(event.clone()));
    let mut payload = parsed.payload.unwrap_or(Value::Object(Default::default()));
    if let Value::Object(map) = &mut payload {
        map.entry("raw_source_kind".to_string())
            .or_insert_with(|| Value::String("pipeline_jsonl".to_string()));
        if let Some(schema) = parsed.schema.as_ref() {
            map.entry("raw_schema".to_string())
                .or_insert_with(|| Value::String(schema.clone()));
        }
        if let Some(schema_version) = parsed.schema_version {
            map.entry("raw_schema_version".to_string())
                .or_insert_with(|| Value::Number(schema_version.into()));
        }
    }
    records.push(JobEventRecord {
        job_id: job_id.to_string(),
        seq: base_seq + line_number as i64,
        ts: parsed.ts.clone().unwrap_or_default(),
        created_at: parsed.ts.unwrap_or_default(),
        level: parsed.level.unwrap_or_else(|| "info".to_string()),
        lane: None,
        display_stage: None,
        user_stage: parsed
            .user_stage
            .map(normalize_user_stage)
            .or_else(|| user_stage_for_event(parsed.stage.as_deref())),
        substage: parsed
            .substage
            .clone()
            .or_else(|| parsed.provider_stage.clone()),
        progress_unit: parsed
            .progress_unit
            .or_else(|| progress_unit_for_event(parsed.stage.as_deref(), &event)),
        stage: parsed.stage,
        stage_detail: parsed.stage_detail,
        provider: parsed.provider,
        provider_stage: parsed.provider_stage,
        event_type: Some(
            parsed
                .semantic_event_type
                .clone()
                .or_else(|| parsed.event_type.clone())
                .unwrap_or_else(|| event.clone()),
        ),
        raw_event_type,
        raw: None,
        progress: None,
        event,
        message: parsed.message.unwrap_or_default(),
        progress_current: parsed.progress_current,
        progress_total: parsed.progress_total,
        retry_count: parsed.retry_count,
        elapsed_ms: parsed.elapsed_ms,
        payload: Some(payload),
    });
    true
}

fn user_stage_for_event(stage: Option<&str>) -> Option<String> {
    job_user_stage(stage).map(str::to_string)
}

fn normalize_user_stage(value: String) -> String {
    normalize_event_user_stage(&value)
        .unwrap_or_else(|| value.trim())
        .to_string()
}

fn progress_unit_for_event(stage: Option<&str>, event: &str) -> Option<String> {
    Some(event_progress_unit(stage, event).to_string())
}

fn normalized_event_name(parsed: &PipelineEventJsonlRecord) -> String {
    parsed
        .event
        .clone()
        .or_else(|| parsed.event_type.clone())
        .unwrap_or_else(|| "diagnostic".to_string())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::load_pipeline_events_jsonl;

    #[test]
    fn ignores_only_unterminated_final_json_fragment() {
        let path = temp_jsonl_path("unterminated-final-fragment");
        fs::write(
            &path,
            concat!(
                r#"{"job_id":"job-a","ts":"2026-04-24T01:00:00Z","stage":"translating","event":"stage_progress","message":"ok"}"#,
                "\n",
                r#"{"job_id":"job-a","ts":"2026-04-24T01:00:01Z","stage""#
            ),
        )
        .expect("write jsonl");

        let records = load_pipeline_events_jsonl("job-a", &path, 10);

        fs::remove_file(path).ok();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].seq, 11);
        assert_eq!(records[0].event, "stage_progress");
        assert_eq!(records[0].stage.as_deref(), Some("translating"));
    }

    #[test]
    fn stops_after_non_final_corrupt_json_line() {
        let path = temp_jsonl_path("middle-corrupt-line");
        fs::write(
            &path,
            concat!(
                r#"{"job_id":"job-a","ts":"2026-04-24T01:00:00Z","stage":"ocr_processing","event":"stage_progress","message":"first"}"#,
                "\n",
                r#"{"job_id":"job-a","ts":"2026-04-24T01:00:01Z","stage""#,
                "\n",
                r#"{"job_id":"job-a","ts":"2026-04-24T01:00:02Z","stage":"rendering","event":"stage_progress","message":"after corrupt"}"#,
                "\n"
            ),
        )
        .expect("write jsonl");

        let records = load_pipeline_events_jsonl("job-a", &path, 20);

        fs::remove_file(path).ok();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].seq, 21);
        assert_eq!(records[0].stage.as_deref(), Some("ocr_processing"));
    }

    fn temp_jsonl_path(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        std::env::temp_dir().join(format!("retainpdf-{name}-{unique}.jsonl"))
    }
}
