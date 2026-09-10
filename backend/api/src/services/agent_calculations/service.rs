//! Durable, browser-safe projections for deterministic Agent calculations.
//!
//! The AI service executes only fixed, in-memory calculation tools.  Rust owns
//! scope validation, durable state, and controlled artifact publication.  Raw
//! expressions, table values, credentials, and model requests are never stored.

use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use retain_core::models::domain::build_job_id;
use retain_data::db::{
    AgentCalculationArtifactInput, AgentCalculationRunCreate, AgentCalculationRunRecord,
    AgentCalculationStatus, AgentCalculationTransitionResult, Db,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::error::AppError;

pub const AGENT_CALCULATION_CREATE_SCHEMA: &str = "agent_calculation_create_v1";
pub const AGENT_CALCULATION_COMPLETE_SCHEMA: &str = "agent_calculation_complete_v1";
pub const AGENT_CALCULATION_FAIL_SCHEMA: &str = "agent_calculation_fail_v1";
pub const AGENT_CALCULATION_VIEW_SCHEMA: &str = "agent_calculation_v1";

const MAX_RESULT_BYTES: usize = 64 * 1024;
const MAX_ARTIFACT_BYTES: usize = 512 * 1024;
const MAX_ARTIFACTS: usize = 10;
const ALLOWED_TOOLS: [&str; 4] = [
    "calculate_expression",
    "calculate_statistics",
    "analyze_table",
    "generate_chart",
];

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AgentCalculationInputRefs {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page_idx: Option<u32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub block_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub source_calculation_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateAgentCalculationInput {
    pub schema: String,
    #[serde(default)]
    pub calculation_id: String,
    pub conversation_id: String,
    pub request_message_id: String,
    #[serde(default)]
    pub document_id: String,
    #[serde(default)]
    pub job_id: String,
    pub tool_name: String,
    pub tool_call_id: String,
    #[serde(default)]
    pub input_refs: AgentCalculationInputRefs,
    pub input_sha256: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CompleteAgentCalculationArtifactInput {
    pub artifact_id: String,
    pub kind: String,
    pub mime_type: String,
    pub sha256: String,
    pub content_base64: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CompleteAgentCalculationInput {
    pub schema: String,
    pub result: Value,
    #[serde(default)]
    pub artifacts: Vec<CompleteAgentCalculationArtifactInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FailAgentCalculationInput {
    pub schema: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct AgentCalculationListQuery {
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentCalculationArtifactView {
    pub artifact_id: String,
    pub kind: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub sha256: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentCalculationFailureView {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentCalculationView {
    pub schema: &'static str,
    pub calculation_id: String,
    pub conversation_id: String,
    pub request_message_id: String,
    pub document_id: Option<String>,
    pub job_id: Option<String>,
    pub tool_name: String,
    pub tool_call_id: String,
    pub input_refs: Value,
    pub status: AgentCalculationStatus,
    pub result: Option<Value>,
    pub failure: Option<AgentCalculationFailureView>,
    pub artifacts: Vec<AgentCalculationArtifactView>,
    pub created_at: String,
    pub updated_at: String,
    pub finished_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentCalculationListView {
    pub calculations: Vec<AgentCalculationView>,
    pub total: u64,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone)]
pub struct AgentCalculationArtifactDownload {
    pub path: PathBuf,
    pub mime_type: String,
}

pub fn create_agent_calculation(
    db: &Db,
    input: &CreateAgentCalculationInput,
) -> Result<AgentCalculationView, AppError> {
    require_schema(&input.schema, AGENT_CALCULATION_CREATE_SCHEMA)?;
    let conversation_id = checked_id("conversation_id", &input.conversation_id)?;
    let request_message_id = checked_id("request_message_id", &input.request_message_id)?;
    let tool_call_id = checked_id("tool_call_id", &input.tool_call_id)?;
    if !ALLOWED_TOOLS.contains(&input.tool_name.as_str()) {
        return Err(AppError::bad_request("unsupported calculation tool"));
    }
    let document_id = optional_id("document_id", &input.document_id)?;
    let job_id = optional_id("job_id", &input.job_id)?;
    validate_hash(&input.input_sha256)?;
    validate_scope(db, conversation_id, request_message_id, document_id, job_id)?;
    validate_refs(&input.input_refs, document_id, job_id)?;

    let calculation_id = if input.calculation_id.trim().is_empty() {
        format!("calc-{}", build_job_id())
    } else {
        checked_id("calculation_id", &input.calculation_id)?.to_string()
    };
    let input_refs = serde_json::to_value(&input.input_refs)
        .map_err(|error| AppError::internal(format!("serialize calculation refs: {error}")))?;
    let create = AgentCalculationRunCreate {
        calculation_id: calculation_id.clone(),
        conversation_id: conversation_id.to_string(),
        request_message_id: request_message_id.to_string(),
        document_id: document_id.map(str::to_string),
        job_id: job_id.map(str::to_string),
        tool_name: input.tool_name.clone(),
        tool_call_id: tool_call_id.to_string(),
        input_refs,
        input_sha256: input.input_sha256.to_ascii_lowercase(),
    };
    if let Some(existing) = db
        .get_agent_calculation_run(&calculation_id)
        .map_err(internal_error)?
    {
        if same_calculation(&existing, &create) {
            return Ok(project(existing));
        }
        return Err(AppError::conflict(
            "calculation_id is already bound to different input",
        ));
    }
    db.create_agent_calculation_run(&create)
        .map(project)
        .map_err(internal_error)
}

pub fn complete_agent_calculation(
    db: &Db,
    data_root: &Path,
    calculation_id: &str,
    input: &CompleteAgentCalculationInput,
) -> Result<AgentCalculationView, AppError> {
    require_schema(&input.schema, AGENT_CALCULATION_COMPLETE_SCHEMA)?;
    checked_id("calculation_id", calculation_id)?;
    match db
        .get_agent_calculation_run(calculation_id)
        .map_err(internal_error)?
    {
        Some(record) if record.status == AgentCalculationStatus::Completed => {
            return Ok(project(record));
        }
        Some(record) if record.status == AgentCalculationStatus::Failed => {
            return Err(AppError::conflict("calculation is already terminal"));
        }
        Some(_) => {}
        None => {
            return Err(AppError::not_found(format!(
                "calculation not found: {calculation_id}"
            )));
        }
    }
    let result_json = safe_result_json(&input.result)?;
    if input.artifacts.len() > MAX_ARTIFACTS {
        return Err(AppError::bad_request("too many calculation artifacts"));
    }
    let mut files = Vec::with_capacity(input.artifacts.len());
    let mut metadata = Vec::with_capacity(input.artifacts.len());
    let mut artifact_ids = HashSet::new();
    for artifact in &input.artifacts {
        if !artifact_ids.insert(artifact.artifact_id.as_str()) {
            cleanup_files(&files);
            return Err(AppError::bad_request("duplicate calculation artifact_id"));
        }
        let (created_path, entry) = match materialize_artifact(data_root, calculation_id, artifact)
        {
            Ok(value) => value,
            Err(error) => {
                cleanup_files(&files);
                return Err(error);
            }
        };
        if let Some(path) = created_path {
            files.push(path);
        }
        metadata.push(entry);
    }
    match db
        .complete_agent_calculation_run(calculation_id, &result_json, &metadata)
        .map_err(internal_error)?
    {
        AgentCalculationTransitionResult::Completed(record) => Ok(project(record)),
        AgentCalculationTransitionResult::AlreadyTerminal(record)
            if record.status == AgentCalculationStatus::Completed =>
        {
            cleanup_unreferenced_files(data_root, &files, &record);
            Ok(project(record))
        }
        AgentCalculationTransitionResult::AlreadyTerminal(_) => {
            cleanup_files(&files);
            Err(AppError::conflict("calculation is already terminal"))
        }
        AgentCalculationTransitionResult::NotFound => {
            cleanup_files(&files);
            Err(AppError::not_found(format!(
                "calculation not found: {calculation_id}"
            )))
        }
        AgentCalculationTransitionResult::Failed(_) => {
            cleanup_files(&files);
            Err(AppError::internal(
                "invalid calculation completion transition",
            ))
        }
    }
}

pub fn fail_agent_calculation(
    db: &Db,
    calculation_id: &str,
    input: &FailAgentCalculationInput,
) -> Result<AgentCalculationView, AppError> {
    require_schema(&input.schema, AGENT_CALCULATION_FAIL_SCHEMA)?;
    checked_id("calculation_id", calculation_id)?;
    let code = checked_failure_text("code", &input.code, 64)?;
    let message = checked_failure_text("message", &input.message, 512)?;
    let failure_json = serde_json::json!({"code": code, "message": message}).to_string();
    match db
        .fail_agent_calculation_run(calculation_id, &failure_json)
        .map_err(internal_error)?
    {
        AgentCalculationTransitionResult::Failed(record) => Ok(project(record)),
        AgentCalculationTransitionResult::AlreadyTerminal(record)
            if record.status == AgentCalculationStatus::Failed =>
        {
            Ok(project(record))
        }
        AgentCalculationTransitionResult::AlreadyTerminal(_) => {
            Err(AppError::conflict("calculation is already terminal"))
        }
        AgentCalculationTransitionResult::NotFound => Err(AppError::not_found(format!(
            "calculation not found: {calculation_id}"
        ))),
        AgentCalculationTransitionResult::Completed(_) => {
            Err(AppError::internal("invalid calculation failure transition"))
        }
    }
}

pub fn get_agent_calculation(
    db: &Db,
    calculation_id: &str,
) -> Result<AgentCalculationView, AppError> {
    checked_id("calculation_id", calculation_id)?;
    db.get_agent_calculation_run(calculation_id)
        .map_err(internal_error)?
        .map(project)
        .ok_or_else(|| AppError::not_found(format!("calculation not found: {calculation_id}")))
}

pub fn list_agent_calculations(
    db: &Db,
    conversation_id: &str,
    query: &AgentCalculationListQuery,
) -> Result<AgentCalculationListView, AppError> {
    let conversation_id = checked_id("conversation_id", conversation_id)?;
    if db
        .get_conversation(conversation_id)
        .map_err(internal_error)?
        .is_none()
    {
        return Err(AppError::not_found(format!(
            "conversation not found: {conversation_id}"
        )));
    }
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let total = db
        .count_agent_calculation_runs_for_conversation(conversation_id)
        .map_err(internal_error)?;
    let records = db
        .list_agent_calculation_runs_for_conversation(conversation_id, limit, query.offset)
        .map_err(internal_error)?;
    let returned = records.len() as u64;
    Ok(AgentCalculationListView {
        calculations: records.into_iter().map(project).collect(),
        total,
        limit,
        offset: query.offset,
        has_more: u64::from(query.offset).saturating_add(returned) < total,
    })
}

pub fn agent_calculation_artifact_download(
    db: &Db,
    data_root: &Path,
    calculation_id: &str,
    artifact_id: &str,
) -> Result<AgentCalculationArtifactDownload, AppError> {
    checked_id("calculation_id", calculation_id)?;
    checked_id("artifact_id", artifact_id)?;
    let record = db
        .get_agent_calculation_run(calculation_id)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::not_found(format!("calculation not found: {calculation_id}")))?;
    let artifact = record
        .artifacts
        .iter()
        .find(|artifact| artifact.artifact_id == artifact_id)
        .ok_or_else(|| {
            AppError::not_found(format!("calculation artifact not found: {artifact_id}"))
        })?;
    let path = safe_data_path(data_root, &artifact.relative_path)?;
    let bytes =
        fs::read(&path).map_err(|_| AppError::not_found("calculation artifact file is missing"))?;
    if bytes.len() as u64 != artifact.size_bytes || sha256_hex(&bytes) != artifact.sha256 {
        return Err(AppError::conflict(
            "calculation artifact integrity check failed",
        ));
    }
    Ok(AgentCalculationArtifactDownload {
        path,
        mime_type: artifact.mime_type.clone(),
    })
}

fn project(record: AgentCalculationRunRecord) -> AgentCalculationView {
    let result = record
        .result_summary
        .as_deref()
        .and_then(|value| serde_json::from_str(value).ok());
    let failure = record.failure_summary.as_deref().and_then(|value| {
        let value: Value = serde_json::from_str(value).ok()?;
        Some(AgentCalculationFailureView {
            code: value.get("code")?.as_str()?.to_string(),
            message: value.get("message")?.as_str()?.to_string(),
        })
    });
    AgentCalculationView {
        schema: AGENT_CALCULATION_VIEW_SCHEMA,
        calculation_id: record.calculation_id.clone(),
        conversation_id: record.conversation_id,
        request_message_id: record.request_message_id,
        document_id: record.document_id,
        job_id: record.job_id,
        tool_name: record.tool_name,
        tool_call_id: record.tool_call_id,
        input_refs: record.input_refs,
        status: record.status,
        result,
        failure,
        artifacts: record
            .artifacts
            .into_iter()
            .map(|artifact| AgentCalculationArtifactView {
                url: format!(
                    "/api/v1/ai/calculations/{}/artifacts/{}",
                    record.calculation_id, artifact.artifact_id
                ),
                artifact_id: artifact.artifact_id,
                kind: artifact.kind,
                mime_type: artifact.mime_type,
                size_bytes: artifact.size_bytes,
                sha256: artifact.sha256,
            })
            .collect(),
        created_at: record.created_at,
        updated_at: record.updated_at,
        finished_at: record.finished_at,
    }
}

fn validate_scope(
    db: &Db,
    conversation_id: &str,
    request_message_id: &str,
    document_id: Option<&str>,
    job_id: Option<&str>,
) -> Result<(), AppError> {
    let conversation = db
        .get_conversation(conversation_id)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::not_found(format!("conversation not found: {conversation_id}")))?;
    if db
        .get_message(conversation_id, request_message_id)
        .map_err(internal_error)?
        .is_none()
    {
        return Err(AppError::conflict(
            "request_message_id does not belong to the conversation",
        ));
    }
    if conversation.document_id.as_deref() != document_id {
        return Err(AppError::conflict(
            "calculation document scope does not match the conversation",
        ));
    }
    if let Some(job_id) = job_id {
        let expected = document_id.ok_or_else(|| {
            AppError::conflict("a job-scoped calculation also requires document scope")
        })?;
        let document = db
            .get_document_by_job_id(job_id)
            .map_err(internal_error)?
            .ok_or_else(|| AppError::not_found(format!("job not found: {job_id}")))?;
        if document.document_id != expected {
            return Err(AppError::conflict(
                "calculation job does not belong to the document",
            ));
        }
    }
    Ok(())
}

fn validate_refs(
    refs: &AgentCalculationInputRefs,
    document_id: Option<&str>,
    job_id: Option<&str>,
) -> Result<(), AppError> {
    if refs
        .document_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        != document_id
    {
        return Err(AppError::conflict("input_refs document scope mismatch"));
    }
    if refs
        .job_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        != job_id
    {
        return Err(AppError::conflict("input_refs job scope mismatch"));
    }
    if refs.block_ids.len() > 128 || refs.source_calculation_ids.len() > 32 {
        return Err(AppError::bad_request(
            "too many calculation input references",
        ));
    }
    for value in refs.block_ids.iter().chain(&refs.source_calculation_ids) {
        checked_id("input reference", value)?;
    }
    Ok(())
}

fn materialize_artifact(
    data_root: &Path,
    calculation_id: &str,
    artifact: &CompleteAgentCalculationArtifactInput,
) -> Result<(Option<PathBuf>, AgentCalculationArtifactInput), AppError> {
    let artifact_id = checked_id("artifact_id", &artifact.artifact_id)?;
    if artifact.kind != "svg_chart" || artifact.mime_type != "image/svg+xml" {
        return Err(AppError::unsupported_media_type(
            "only controlled SVG chart artifacts are supported",
        ));
    }
    validate_hash(&artifact.sha256)?;
    let bytes = STANDARD
        .decode(&artifact.content_base64)
        .map_err(|_| AppError::bad_request("invalid calculation artifact encoding"))?;
    if bytes.is_empty() || bytes.len() > MAX_ARTIFACT_BYTES {
        return Err(AppError::payload_too_large(
            "calculation artifact exceeds the size limit",
        ));
    }
    if sha256_hex(&bytes) != artifact.sha256.to_ascii_lowercase() {
        return Err(AppError::bad_request("calculation artifact hash mismatch"));
    }
    validate_svg(&bytes)?;
    let relative_path = format!("agent-calculations/{calculation_id}/{artifact_id}.svg");
    let path = safe_data_path(data_root, &relative_path)?;
    let parent = path
        .parent()
        .ok_or_else(|| AppError::internal("invalid calculation artifact directory"))?;
    fs::create_dir_all(parent).map_err(internal_error)?;
    let temp = parent.join(format!(".{artifact_id}-{}.tmp", build_job_id()));
    let write_result = (|| -> std::io::Result<bool> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        match fs::hard_link(&temp, &path) {
            Ok(()) => {
                fs::remove_file(&temp)?;
                Ok(true)
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                fs::remove_file(&temp)?;
                let existing = fs::read(&path)?;
                if existing == bytes {
                    Ok(false)
                } else {
                    Err(std::io::Error::new(
                        std::io::ErrorKind::AlreadyExists,
                        "artifact id is already bound to different content",
                    ))
                }
            }
            Err(error) => Err(error),
        }
    })();
    let created = match write_result {
        Ok(created) => created,
        Err(error) => {
            let _ = fs::remove_file(&temp);
            return Err(AppError::internal(format!(
                "write calculation artifact: {error}"
            )));
        }
    };
    Ok((
        created.then_some(path),
        AgentCalculationArtifactInput {
            artifact_id: artifact_id.to_string(),
            kind: artifact.kind.clone(),
            sha256: artifact.sha256.to_ascii_lowercase(),
            relative_path,
            mime_type: artifact.mime_type.clone(),
            size_bytes: bytes.len() as u64,
        },
    ))
}

fn validate_svg(bytes: &[u8]) -> Result<(), AppError> {
    let text = std::str::from_utf8(bytes)
        .map_err(|_| AppError::bad_request("SVG artifact must be UTF-8"))?;
    let compact = text.trim_start().to_ascii_lowercase();
    if !compact.starts_with("<svg")
        || [
            "<script",
            "<foreignobject",
            "javascript:",
            "data:",
            "xlink:href",
            " href=",
            "url(",
        ]
        .iter()
        .any(|forbidden| compact.contains(forbidden))
    {
        return Err(AppError::bad_request("unsafe SVG calculation artifact"));
    }
    Ok(())
}

fn safe_result_json(result: &Value) -> Result<String, AppError> {
    let object = result
        .as_object()
        .ok_or_else(|| AppError::bad_request("calculation result must be an object"))?;
    let schema = object
        .get("schema")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if ![
        "retainpdf.calculation-result.v1",
        "retainpdf.table-analysis.v1",
        "retainpdf.calculation-artifact.v1",
    ]
    .contains(&schema)
    {
        return Err(AppError::bad_request(
            "unsupported calculation result schema",
        ));
    }
    let encoded = serde_json::to_string(result)
        .map_err(|error| AppError::bad_request(format!("invalid calculation result: {error}")))?;
    if encoded.len() > MAX_RESULT_BYTES {
        return Err(AppError::payload_too_large(
            "calculation result exceeds the size limit",
        ));
    }
    let lowered = encoded.to_ascii_lowercase();
    if lowered.contains("content_base64") || lowered.contains("\"content\"") {
        return Err(AppError::bad_request(
            "artifact content must use the controlled artifact field",
        ));
    }
    Ok(encoded)
}

fn same_calculation(
    record: &AgentCalculationRunRecord,
    create: &AgentCalculationRunCreate,
) -> bool {
    record.conversation_id == create.conversation_id
        && record.request_message_id == create.request_message_id
        && record.document_id == create.document_id
        && record.job_id == create.job_id
        && record.tool_name == create.tool_name
        && record.input_refs == create.input_refs
        && record
            .input_sha256
            .eq_ignore_ascii_case(&create.input_sha256)
}

fn safe_data_path(data_root: &Path, relative: &str) -> Result<PathBuf, AppError> {
    let path = Path::new(relative);
    if path.is_absolute()
        || path
            .components()
            .any(|part| !matches!(part, std::path::Component::Normal(_)))
    {
        return Err(AppError::internal("unsafe calculation artifact path"));
    }
    Ok(data_root.join(path))
}

fn checked_id<'a>(name: &str, value: &'a str) -> Result<&'a str, AppError> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > 256
        || value
            .chars()
            .any(|character| !(character.is_ascii_alphanumeric() || "-_ .".contains(character)))
        || value.contains(' ')
    {
        return Err(AppError::bad_request(format!("invalid {name}")));
    }
    Ok(value)
}

fn optional_id<'a>(name: &str, value: &'a str) -> Result<Option<&'a str>, AppError> {
    if value.trim().is_empty() {
        Ok(None)
    } else {
        checked_id(name, value).map(Some)
    }
}

fn validate_hash(value: &str) -> Result<(), AppError> {
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(AppError::bad_request(
            "input_sha256 must be a SHA-256 hex digest",
        ));
    }
    Ok(())
}

fn checked_failure_text<'a>(name: &str, value: &'a str, max: usize) -> Result<&'a str, AppError> {
    let value = value.trim();
    if value.is_empty() || value.len() > max || value.contains(['\r', '\n', '\0']) {
        return Err(AppError::bad_request(format!(
            "invalid calculation failure {name}"
        )));
    }
    Ok(value)
}

fn require_schema(actual: &str, expected: &str) -> Result<(), AppError> {
    if actual != expected {
        return Err(AppError::bad_request(format!(
            "unsupported calculation schema: {actual}"
        )));
    }
    Ok(())
}

fn cleanup_files(paths: &[PathBuf]) {
    for path in paths {
        let _ = fs::remove_file(path);
    }
}

fn cleanup_unreferenced_files(
    data_root: &Path,
    created_paths: &[PathBuf],
    terminal: &AgentCalculationRunRecord,
) {
    let referenced = terminal
        .artifacts
        .iter()
        .filter_map(|artifact| safe_data_path(data_root, &artifact.relative_path).ok())
        .collect::<HashSet<_>>();
    for path in created_paths {
        // Another completion may have won the database transition after this
        // request published identical bytes. Never delete the winner's file.
        if !referenced.contains(path) {
            let _ = fs::remove_file(path);
        }
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn internal_error(error: impl std::fmt::Display) -> AppError {
    AppError::internal(error.to_string())
}

#[cfg(test)]
mod tests {
    use retain_data::db::AgentCalculationArtifactRecord;

    use super::*;

    struct TestRoot(PathBuf);

    impl Drop for TestRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn terminal_winner_artifact_is_not_deleted_by_losing_completion_cleanup() {
        let root = TestRoot(std::env::temp_dir().join(format!(
            "agent-calculation-concurrent-cleanup-{}",
            fastrand::u64(..)
        )));
        let referenced_relative = "agent-calculations/calc-race/chart-a.svg";
        let orphan_relative = "agent-calculations/calc-race/chart-orphan.svg";
        let referenced = root.0.join(referenced_relative);
        let orphan = root.0.join(orphan_relative);
        fs::create_dir_all(referenced.parent().expect("artifact parent"))
            .expect("artifact directory");
        fs::write(&referenced, b"winner").expect("winner artifact");
        fs::write(&orphan, b"loser").expect("orphan artifact");
        let terminal = AgentCalculationRunRecord {
            calculation_id: "calc-race".to_string(),
            conversation_id: "conv-race".to_string(),
            request_message_id: "msg-race".to_string(),
            document_id: None,
            job_id: None,
            tool_name: "generate_chart".to_string(),
            tool_call_id: "tool-race".to_string(),
            input_refs: serde_json::json!({}),
            input_sha256: "a".repeat(64),
            status: AgentCalculationStatus::Completed,
            result_summary: Some(
                serde_json::json!({"schema": "retainpdf.calculation-artifact.v1"}).to_string(),
            ),
            failure_summary: None,
            created_at: String::new(),
            updated_at: String::new(),
            finished_at: Some(String::new()),
            artifacts: vec![AgentCalculationArtifactRecord {
                artifact_id: "chart-a".to_string(),
                calculation_id: "calc-race".to_string(),
                kind: "svg_chart".to_string(),
                sha256: "b".repeat(64),
                relative_path: referenced_relative.to_string(),
                mime_type: "image/svg+xml".to_string(),
                size_bytes: 6,
                created_at: String::new(),
            }],
        };

        cleanup_unreferenced_files(&root.0, &[referenced.clone(), orphan.clone()], &terminal);

        assert!(referenced.is_file());
        assert!(!orphan.exists());
    }
}
