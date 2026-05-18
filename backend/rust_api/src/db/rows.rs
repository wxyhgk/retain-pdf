use std::io::{Error as IoError, ErrorKind};

use anyhow::{Context, Result};
use rusqlite::types::Type;
use rusqlite::Row;

use crate::models::{
    GlossaryRecord, JobArtifactRecord, JobEventRecord, JobFailureInfo, JobRuntimeInfo, JobSnapshot,
    ResolvedJobSpec,
};

pub(super) const JOB_SELECT_SQL: &str = r#"
    SELECT
        jobs.job_id, jobs.workflow, jobs.status_json, jobs.created_at, jobs.updated_at,
        jobs.started_at, jobs.finished_at, jobs.upload_id, jobs.pid, jobs.command_json,
        jobs.request_json, jobs.error, jobs.stage, jobs.stage_detail,
        jobs.progress_current, jobs.progress_total, jobs.log_tail_json, jobs.result_json,
        jobs.runtime_json, jobs.failure_json,
        artifacts.artifacts_json
    FROM jobs
    LEFT JOIN artifacts ON artifacts.job_id = jobs.job_id
"#;

pub(super) fn row_to_job_snapshot(row: &Row<'_>) -> rusqlite::Result<JobSnapshot> {
    let result_json: Option<String> = row.get(17)?;
    let runtime_json: Option<String> = row.get(18)?;
    let failure_json: Option<String> = row.get(19)?;
    let artifacts_json: Option<String> = row.get(20)?;
    let workflow_json: String = row.get(1)?;
    let status_json: String = row.get(2)?;
    let request_json: String = row.get(10)?;
    Ok(JobSnapshot {
        record: crate::models::JobRecord {
            job_id: row.get(0)?,
            workflow: parse_json_column(1, "workflow", &workflow_json)?,
            status: parse_json_column(2, "status_json", &status_json)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
            started_at: row.get(5)?,
            finished_at: row.get(6)?,
            upload_id: row.get(7)?,
            pid: row.get::<_, Option<i64>>(8)?.map(|v| v as u32),
            command: serde_json::from_str(&row.get::<_, String>(9)?).unwrap_or_default(),
            request_payload: deserialize_request_spec_column(10, &request_json)?,
            error: row.get(11)?,
            stage: row.get(12)?,
            stage_detail: row.get(13)?,
            progress_current: row.get(14)?,
            progress_total: row.get(15)?,
            log_tail: serde_json::from_str(&row.get::<_, String>(16)?).unwrap_or_default(),
            result: result_json
                .and_then(|text| serde_json::from_str(&text).ok())
                .unwrap_or(None),
            runtime: runtime_json
                .and_then(|text| serde_json::from_str::<JobRuntimeInfo>(&text).ok()),
            failure: failure_json
                .and_then(|text| serde_json::from_str::<JobFailureInfo>(&text).ok()),
        },
        artifacts: artifacts_json
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(None),
    })
}

pub(super) fn row_to_job_event(row: &Row<'_>) -> rusqlite::Result<JobEventRecord> {
    let payload_json: Option<String> = row.get(12)?;
    let event: String = row.get(8)?;
    let event_type: Option<String> = row.get(9)?;
    let stage: Option<String> = row.get(4)?;
    let provider_stage: Option<String> = row.get(7)?;
    Ok(JobEventRecord {
        job_id: row.get(0)?,
        seq: row.get(1)?,
        ts: row.get(2)?,
        level: row.get(3)?,
        user_stage: user_stage_for_event(stage.as_deref()),
        stage: stage.clone(),
        substage: provider_stage.clone(),
        stage_detail: row.get(5)?,
        provider: row.get(6)?,
        provider_stage,
        event: event.clone(),
        event_type: event_type.or_else(|| Some(event.clone())),
        progress_current: row.get(10)?,
        progress_total: row.get(11)?,
        progress_unit: progress_unit_for_event(stage.as_deref(), &event),
        retry_count: row.get::<_, Option<i64>>(13)?.map(|value| value as u32),
        elapsed_ms: row.get(14)?,
        payload: payload_json.and_then(|text| serde_json::from_str(&text).ok()),
        message: row.get(15)?,
    })
}

fn user_stage_for_event(stage: Option<&str>) -> Option<String> {
    match stage.map(str::trim).unwrap_or_default() {
        "ocr_upload" | "ocr_processing" | "ocr_result_ready" | "normalizing" => {
            Some("ocr".to_string())
        }
        "translation_prepare"
        | "translating"
        | "translation_batches"
        | "continuation_review"
        | "page_policies"
        | "domain_inference"
        | "garbled_repair" => Some("translate".to_string()),
        "render_prepare" | "rendering" | "compile" | "overlay" | "saving" => {
            Some("render".to_string())
        }
        "finished" | "done" => Some("done".to_string()),
        _ => None,
    }
}

fn progress_unit_for_event(stage: Option<&str>, event: &str) -> Option<String> {
    let unit = match stage.map(str::trim).unwrap_or_default() {
        "translating" | "translation_batches" => "batch",
        "ocr_processing"
        | "continuation_review"
        | "page_policies"
        | "domain_inference"
        | "garbled_repair"
        | "rendering" => "page",
        "compile"
        | "overlay"
        | "saving"
        | "render_prepare"
        | "translation_prepare"
        | "normalizing" => "step",
        _ if event == "stage_progress" => "step",
        _ => "none",
    };
    Some(unit.to_string())
}

pub(super) fn row_to_job_artifact_record(row: &Row<'_>) -> rusqlite::Result<JobArtifactRecord> {
    Ok(JobArtifactRecord {
        job_id: row.get(0)?,
        artifact_key: row.get(1)?,
        artifact_group: row.get(2)?,
        artifact_kind: row.get(3)?,
        relative_path: row.get(4)?,
        file_name: row.get(5)?,
        content_type: row.get(6)?,
        ready: row.get::<_, i64>(7)? != 0,
        size_bytes: row.get::<_, Option<i64>>(8)?.map(|value| value as u64),
        checksum: row.get(9)?,
        source_stage: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

pub(super) fn row_to_glossary_record(row: &Row<'_>) -> rusqlite::Result<GlossaryRecord> {
    let entries_json: String = row.get(2)?;
    Ok(GlossaryRecord {
        glossary_id: row.get(0)?,
        name: row.get(1)?,
        entries: serde_json::from_str(&entries_json).unwrap_or_default(),
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn json_column_decode_error(
    column_idx: usize,
    column_name: &str,
    error: impl std::fmt::Display,
) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(
        column_idx,
        Type::Text,
        Box::new(IoError::new(
            ErrorKind::InvalidData,
            format!("failed to decode {column_name}: {error}"),
        )),
    )
}

fn parse_json_column<T>(column_idx: usize, column_name: &str, raw: &str) -> rusqlite::Result<T>
where
    T: serde::de::DeserializeOwned,
{
    serde_json::from_str::<T>(raw)
        .map_err(|error| json_column_decode_error(column_idx, column_name, error))
}

fn deserialize_request_spec_column(
    column_idx: usize,
    raw: &str,
) -> rusqlite::Result<ResolvedJobSpec> {
    deserialize_request_spec(raw)
        .map_err(|error| json_column_decode_error(column_idx, "request_json", error))
}

fn deserialize_request_spec(raw: &str) -> Result<ResolvedJobSpec> {
    serde_json::from_str::<ResolvedJobSpec>(raw).context("failed to deserialize job request/spec")
}
