use std::io::{Error as IoError, ErrorKind};

use anyhow::{Context, Result};
use rusqlite::types::Type;
use rusqlite::Row;

use crate::models::api::JobEventRecord;
use crate::models::domain::{
    event_progress_unit, job_user_stage, GlossaryRecord, JobArtifactRecord, JobFailureInfo,
    JobRecord, JobRuntimeInfo, JobSnapshot, ResolvedJobSpec,
};

/// 任务的「运行信息」里存在库里的几样（v33 起拆开存）：进入当前阶段的时间、最后出错和重试的时间、重试次数、
/// 阶段历史（`job_stage_history`，按顺序）。拼成和 `JobRuntimeInfo` 同名字段的 JSON 交给 Rust 解，其余字段读出后按
/// `JobRecord::fill_derived_runtime` 算。占原来 `runtime_json` 的列号（18），后面的列号不变。
macro_rules! job_runtime_parts_sql {
    () => {
        r#"json_object(
            'stage_started_at', jobs.stage_entered_at,
            'last_error_at', jobs.last_error_at,
            'retry_count', jobs.retry_count,
            'last_retry_at', jobs.last_retry_at,
            'stage_history', json(COALESCE((
                SELECT json_group_array(json_object(
                    'stage', h.stage, 'detail', h.detail, 'enter_at', h.enter_at, 'exit_at', h.exit_at,
                    'duration_ms', h.duration_ms, 'terminal_status', h.terminal_status,
                    'progress_current', h.progress_current, 'progress_total', h.progress_total
                ) ORDER BY h.seq)
                FROM job_stage_history h WHERE h.job_id = jobs.job_id
            ), '[]'))
        )"#
    };
}

macro_rules! job_select_sql {
    ($tail:literal) => {
        concat!(
            r#"
    SELECT
        jobs.job_id, jobs.workflow, jobs.status, jobs.created_at, jobs.updated_at,
        jobs.started_at, jobs.finished_at, jobs.upload_id, jobs.pid, jobs.command_json,
        jobs.request_json, jobs.error, jobs.stage, jobs.stage_detail,
        jobs.progress_current, jobs.progress_total, jobs.log_tail_json, jobs.result_json,
        "#,
            job_runtime_parts_sql!(),
            r#", jobs.failure_json,
        artifacts.artifacts_json"#,
            $tail,
            r#"
    FROM jobs
    LEFT JOIN artifacts ON artifacts.job_id = jobs.job_id
"#
        )
    };
}

pub(super) const JOB_SELECT_SQL: &str = job_select_sql!("");

/// 同 [`JOB_SELECT_SQL`]，末尾多一列 `jobs.run_generation`（列号 21），只给 `get_job` 用。
/// 不能直接改 `JOB_SELECT_SQL`：`select_jobs`、事件投影的外层查询按固定列号接着往后读。
pub(super) const JOB_SELECT_SQL_WITH_GENERATION: &str = job_select_sql!(", jobs.run_generation");

pub(super) fn row_to_job_snapshot(row: &Row<'_>) -> rusqlite::Result<JobSnapshot> {
    let result_json: Option<String> = row.get(17)?;
    let runtime_json: Option<String> = row.get(18)?;
    let failure_json: Option<String> = row.get(19)?;
    let artifacts_json: Option<String> = row.get(20)?;
    let workflow: String = row.get(1)?;
    let status: String = row.get(2)?;
    let request_json: String = row.get(10)?;
    let mut snapshot = JobSnapshot {
        record: JobRecord {
            job_id: row.get(0)?,
            workflow: parse_text_column(1, "workflow", &workflow)?,
            status: parse_text_column(2, "status", &status)?,
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
            // 不在 JOB_SELECT_SQL 里（外层查询按固定列号接着读），只有 `get_job` 补上。
            run_generation: 0,
        },
        artifacts: artifacts_json
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(None),
    };
    // 运行信息里没存的几项（当前阶段、结束原因、耗时、最终失败……）按写的时候同一套规则算回来。
    snapshot.record.fill_derived_runtime();
    Ok(snapshot)
}

pub(super) fn row_to_job_event(row: &Row<'_>) -> rusqlite::Result<JobEventRecord> {
    row_to_job_event_at(row, 0)
}

/// 同 [`row_to_job_event`]，事件的列从第 `at` 列（下标）起：进度流读条目时把原始事件接在条目的列后面（v35）。
pub(super) fn row_to_job_event_at(row: &Row<'_>, at: usize) -> rusqlite::Result<JobEventRecord> {
    let payload_json: Option<String> = row.get(at + 12)?;
    let event: String = row.get(at + 8)?;
    let event_type: Option<String> = row.get(at + 9)?;
    let stage: Option<String> = row.get(at + 4)?;
    let provider_stage: Option<String> = row.get(at + 7)?;
    let payload: Option<serde_json::Value> =
        payload_json.and_then(|text| serde_json::from_str(&text).ok());
    let progress_unit = explicit_pipeline_progress_unit(payload.as_ref())
        .unwrap_or_else(|| event_progress_unit(stage.as_deref(), &event).to_string());
    Ok(JobEventRecord {
        job_id: row.get(at + 0)?,
        seq: row.get(at + 1)?,
        ts: row.get(at + 2)?,
        created_at: row.get(at + 2)?,
        level: row.get(at + 3)?,
        lane: None,
        display_stage: None,
        user_stage: job_user_stage(stage.as_deref()).map(str::to_string),
        stage: stage.clone(),
        substage: provider_stage.clone(),
        stage_detail: row.get(at + 5)?,
        provider: row.get(at + 6)?,
        provider_stage,
        event: event.clone(),
        event_type: event_type.or_else(|| Some(event.clone())),
        raw_event_type: Some(event.clone()),
        raw: None,
        progress: None,
        progress_current: row.get(at + 10)?,
        progress_total: row.get(at + 11)?,
        progress_unit: Some(progress_unit),
        retry_count: row.get::<_, Option<i64>>(at + 13)?.map(|value| value as u32),
        elapsed_ms: row.get(at + 14)?,
        payload,
        message: row.get(at + 15)?,
    })
}

/// 阶段观察派生的事件(payload 带 `authority`)会把 pipeline 声明的
/// progress_unit 存进 payload。只认这一类,其余事件仍按 stage 推断。
fn explicit_pipeline_progress_unit(payload: Option<&serde_json::Value>) -> Option<String> {
    let payload = payload?;
    payload.get("authority")?;
    payload
        .get("progress_unit")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|unit| !unit.is_empty())
        .map(str::to_string)
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
    let entries_json: String = row.get(6)?;
    Ok(GlossaryRecord {
        glossary_id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        source_lang: row.get(3)?,
        target_lang: row.get(4)?,
        enabled: row.get::<_, i64>(5)? != 0,
        // 读坏了报错（接口 500），不当成空表：用户看到 0 条再保存一次就真没了。
        entries: serde_json::from_str(&entries_json)
            .map_err(|error| json_column_decode_error(6, "entries_json", error))?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
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

/// 状态、流程这类纯文本取值列（`jobs.status`、`jobs.workflow`，v32 起不再是 JSON 字符串）按 serde 的取值读成枚举。
fn parse_text_column<T>(column_idx: usize, column_name: &str, raw: &str) -> rusqlite::Result<T>
where
    T: serde::de::DeserializeOwned,
{
    serde_json::from_value::<T>(serde_json::Value::String(raw.to_string()))
        .map_err(|error| json_column_decode_error(column_idx, column_name, error))
}

/// `jobs.status` 的纯文本读成状态；不认识的取值是 None（CHECK 钉着，正常碰不到）。
pub(super) fn parse_status_text(raw: &str) -> Option<crate::models::domain::JobStatusKind> {
    serde_json::from_value(serde_json::Value::String(raw.to_string())).ok()
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
