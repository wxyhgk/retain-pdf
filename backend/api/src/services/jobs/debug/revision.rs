//! 单块译文修订写回与修订历史。
//!
//! Rust 只管「谁能写、什么时候能写」(鉴权在路由层,任务在跑的 409 在 facade);
//! 校验、改页文件、推进 checkpoint、追加 `translated/revisions.v1.jsonl` 全部交给
//! `retainpdf-pipeline translation-revise`——校验必须和翻译时是同一套 Python 代码,
//! 这里不重写一遍。

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use axum::http::StatusCode;
use serde_json::{json, Value};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::error::AppError;
use crate::models::api::{
    redact_text, sensitive_values, ReviseTranslationItemRequest, TranslationRevisionHistoryView,
};
use crate::models::domain::JobSnapshot;
use crate::services::jobs::deps::ReplayDeps;
use crate::storage_paths::{resolve_job_root, resolve_translation_manifest};

use super::item::load_translation_debug_item_view;

pub(crate) const TRANSLATION_REVISIONS_FILE_NAME: &str = "revisions.v1.jsonl";
/// 与 Python 侧 MAX_REVISION_TEXT_CHARS 一致;这里先挡一道,免得大请求白起一个进程。
const MAX_REVISION_TEXT_CHARS: usize = 20_000;
const MAX_REVISION_REASON_CHARS: usize = 2_000;
/// 写回只读写本任务的几十个页文件,正常是亚秒级;超时说明进程卡住了。
const REVISION_TIMEOUT: Duration = Duration::from_secs(120);

/// Python 子命令的成功结果(committed / unchanged)。
pub(crate) struct RevisionOutcome {
    pub(crate) changed: bool,
    pub(crate) generation: u64,
    pub(crate) item: Value,
    pub(crate) validation: Value,
    pub(crate) revision: Option<Value>,
    pub(crate) page_hashes: Value,
    /// 本任务自己的 `translated/`;修订登记从这里读 checkpoint 与修订日志。
    pub(crate) translations_dir: PathBuf,
}

pub(crate) fn validate_item_id(item_id: &str) -> Result<(), AppError> {
    let valid = !item_id.is_empty()
        && item_id.len() <= 128
        && item_id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | ':' | '.'));
    if valid {
        Ok(())
    } else {
        Err(AppError::bad_request(format!("invalid translation item id: {item_id}")))
    }
}

fn validate_request(request: &ReviseTranslationItemRequest) -> Result<(), AppError> {
    if request.translated_text.chars().count() > MAX_REVISION_TEXT_CHARS {
        return Err(AppError::bad_request(format!(
            "translated_text exceeds {MAX_REVISION_TEXT_CHARS} characters"
        )));
    }
    if request.reason.chars().count() > MAX_REVISION_REASON_CHARS {
        return Err(AppError::bad_request(format!(
            "reason exceeds {MAX_REVISION_REASON_CHARS} characters"
        )));
    }
    Ok(())
}

/// 修订只写任务自己的 `translated/`。从别的任务复用译文的渲染任务(retry-stage
/// create_new_job=true 产生的)指向源任务的目录,在这里改会悄悄改掉源任务。
fn owned_job_root(data_root: &Path, job: &JobSnapshot) -> Result<PathBuf, AppError> {
    let job_root = resolve_job_root(job, data_root)
        .ok_or_else(|| AppError::not_found(format!("job root not found: {}", job.job_id)))?;
    let manifest = resolve_translation_manifest(job, data_root).ok_or_else(|| {
        AppError::not_found(format!("translation manifest not found: {}", job.job_id))
    })?;
    let owned = manifest
        .parent()
        .and_then(|dir| dir.canonicalize().ok())
        .zip(job_root.join("translated").canonicalize().ok())
        .is_some_and(|(actual, expected)| actual == expected);
    if !owned {
        return Err(AppError::translation_revision(
            StatusCode::CONFLICT,
            "translations_owned_by_another_job",
            "this job reuses translations owned by another job; revise them on the source job",
            json!({ "source_job_id": job.request_payload.source.artifact_job_id }),
        ));
    }
    Ok(job_root)
}

pub(crate) async fn revise_translation_item(
    deps: &ReplayDeps<'_>,
    job: &JobSnapshot,
    item_id: &str,
    request: &ReviseTranslationItemRequest,
) -> Result<RevisionOutcome, AppError> {
    validate_item_id(item_id)?;
    validate_request(request)?;
    let job_root = owned_job_root(deps.data_root, job)?;
    let body = json!({
        "translated_text": request.translated_text,
        "source": request.source.as_str(),
        "reason": request.reason,
        "expected_generation": request.expected_generation,
    });
    let mut command = Command::new(deps.pipeline_command);
    command
        .arg("translation-revise")
        .arg("--job-root")
        .arg(&job_root)
        .arg("--item-id")
        .arg(item_id)
        .current_dir(deps.project_root)
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = command
        .spawn()
        .map_err(|err| AppError::internal(format!("spawn translation-revise: {err}")))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(body.to_string().as_bytes())
            .await
            .map_err(|err| AppError::internal(format!("write translation-revise stdin: {err}")))?;
    }
    let output = tokio::time::timeout(REVISION_TIMEOUT, child.wait_with_output())
        .await
        .map_err(|_| AppError::internal("translation-revise timed out"))?
        .map_err(|err| AppError::internal(format!("wait translation-revise: {err}")))?;
    let secrets = sensitive_values(&job.request_payload);
    if !output.status.success() {
        let stderr = redact_text(String::from_utf8_lossy(&output.stderr).trim(), &secrets);
        // 只留尾部:Python 的 traceback 最有用的是最后几行。
        let skip = stderr.chars().count().saturating_sub(600);
        let excerpt: String = stderr.chars().skip(skip).collect();
        return Err(AppError::internal(format!(
            "translation-revise failed ({}): {}",
            output.status,
            if excerpt.is_empty() { "<no stderr>" } else { &excerpt }
        )));
    }
    let payload: Value = serde_json::from_slice(&output.stdout).map_err(|err| {
        let stdout = redact_text(String::from_utf8_lossy(&output.stdout).trim(), &secrets);
        AppError::internal(format!(
            "parse translation-revise output: {err}; stdout={}",
            stdout.chars().take(240).collect::<String>()
        ))
    })?;
    outcome_from_payload(payload, job_root.join("translated"))
}

fn outcome_from_payload(
    payload: Value,
    translations_dir: PathBuf,
) -> Result<RevisionOutcome, AppError> {
    let outcome = payload.get("outcome").and_then(Value::as_str).unwrap_or("");
    let reason = payload.get("reason").and_then(Value::as_str).unwrap_or("");
    let message = payload
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("translation revision refused")
        .to_string();
    let extra = |keys: &[&str]| {
        Value::Object(
            keys.iter()
                .filter_map(|key| payload.get(*key).map(|value| (key.to_string(), value.clone())))
                .collect(),
        )
    };
    match outcome {
        "committed" | "unchanged" => Ok(RevisionOutcome {
            changed: payload.get("changed").and_then(Value::as_bool).unwrap_or(false),
            generation: payload
                .get("generation")
                .and_then(Value::as_u64)
                .ok_or_else(|| AppError::internal("translation-revise output has no generation"))?,
            item: payload.get("item").cloned().unwrap_or(Value::Null),
            validation: payload.get("validation").cloned().unwrap_or(Value::Null),
            revision: payload.get("revision").filter(|value| !value.is_null()).cloned(),
            page_hashes: payload.get("page_hashes").cloned().unwrap_or_else(|| json!({})),
            translations_dir,
        }),
        "rejected" => Err(AppError::translation_revision(
            StatusCode::UNPROCESSABLE_ENTITY,
            reason,
            message,
            extra(&["validation"]),
        )),
        "conflict" => Err(AppError::translation_revision(
            StatusCode::CONFLICT,
            reason,
            message,
            extra(&["current_generation"]),
        )),
        "not_found" => Err(AppError::not_found(message)),
        "invalid" => Err(AppError::bad_request(message)),
        other => Err(AppError::internal(format!(
            "unexpected translation-revise outcome: {other}"
        ))),
    }
}

/// 一个块的修订历史。块本身不存在时 404(而不是空列表),免得 id 拼错时静默成功。
pub(crate) fn load_translation_revision_history(
    data_root: &Path,
    job: &JobSnapshot,
    item_id: &str,
) -> Result<TranslationRevisionHistoryView, AppError> {
    validate_item_id(item_id)?;
    load_translation_debug_item_view(data_root, job, item_id)?;
    let manifest = resolve_translation_manifest(job, data_root).ok_or_else(|| {
        AppError::not_found(format!("translation manifest not found: {}", job.job_id))
    })?;
    let path = manifest
        .parent()
        .unwrap_or(&manifest)
        .join(TRANSLATION_REVISIONS_FILE_NAME);
    let text = match std::fs::read_to_string(&path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(error.into()),
    };
    let mut revisions = Vec::new();
    for (index, line) in text.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let record: Value = serde_json::from_str(line).map_err(|err| {
            AppError::internal(format!(
                "parse {} line {}: {err}",
                path.display(),
                index + 1
            ))
        })?;
        if record.get("item_id").and_then(Value::as_str) == Some(item_id) {
            revisions.push(record);
        }
    }
    Ok(TranslationRevisionHistoryView {
        job_id: job.job_id.clone(),
        item_id: item_id.to_string(),
        total: revisions.len(),
        revisions,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_ids_are_restricted_to_payload_id_characters() {
        for valid in ["p003-b004", "__cg__:cg-002-001", "p1.b2"] {
            assert!(validate_item_id(valid).is_ok(), "{valid}");
        }
        for invalid in ["", "../x", "p1 b2", "p1/b2", &"a".repeat(129)] {
            assert!(validate_item_id(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn python_outcomes_map_to_http_statuses() {
        let status = |payload: Value| match outcome_from_payload(payload, PathBuf::new()) {
            Ok(_) => StatusCode::OK,
            Err(AppError::TranslationRevision { status, .. }) => status,
            Err(AppError::NotFound(_)) => StatusCode::NOT_FOUND,
            Err(AppError::BadRequest(_)) => StatusCode::BAD_REQUEST,
            Err(other) => panic!("unexpected error: {other:?}"),
        };
        assert_eq!(
            status(json!({"outcome": "committed", "changed": true, "generation": 3})),
            StatusCode::OK
        );
        assert_eq!(
            status(json!({"outcome": "rejected", "reason": "validation_failed"})),
            StatusCode::UNPROCESSABLE_ENTITY
        );
        assert_eq!(
            status(json!({"outcome": "conflict", "reason": "checkpoint_locked"})),
            StatusCode::CONFLICT
        );
        assert_eq!(status(json!({"outcome": "not_found"})), StatusCode::NOT_FOUND);
        assert_eq!(status(json!({"outcome": "invalid"})), StatusCode::BAD_REQUEST);
        assert!(outcome_from_payload(json!({"outcome": "weird"}), PathBuf::new()).is_err());
    }
}
