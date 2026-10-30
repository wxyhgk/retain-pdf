//! 单块译文修订写回与修订历史。
//!
//! Rust 只管「谁能写、什么时候能写」(鉴权在路由层,任务在跑的 409 在 facade);
//! 校验、改页文件、推进 checkpoint、追加 `translated/revisions.v1.jsonl` 全部交给
//! `retainpdf-pipeline translation-revise`——校验必须和翻译时是同一套 Python 代码,
//! 这里不重写一遍。

use std::path::{Path, PathBuf};
use std::process::{Output, Stdio};
use std::time::Duration;

use axum::http::StatusCode;
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::api::{redact_text, sensitive_values};
use crate::views::{ReviseTranslationItemRequest, TranslationRevisionHistoryView};
use retainpdf_core::models::domain::JobSnapshot;
use crate::deps::ReplayDeps;
use retainpdf_core::storage_paths::resolve_job_root;

use crate::translations::item::load_translation_debug_item_view;
use crate::{stored_path, StoredFile};

pub(crate) const TRANSLATION_REVISIONS_FILE_NAME: &str = "revisions.v1.jsonl";
/// 与 Python 侧 MAX_REVISION_TEXT_CHARS 一致;这里先挡一道,免得大请求白起一个进程。
const MAX_REVISION_TEXT_CHARS: usize = 20_000;
const MAX_REVISION_REASON_CHARS: usize = 2_000;
/// 写回只读写本任务的几十个页文件,正常是亚秒级;超时说明进程卡住了。
const REVISION_TIMEOUT: Duration = Duration::from_secs(120);
/// 超时后先发 SIGTERM,让 Python 的处理函数把这一次写回原样回滚;宽限期过了才 SIGKILL。
/// SIGKILL 之后留下的半截状态由 Python 侧的意图记录在下一次进来时恢复。
const REVISION_TERM_GRACE_SECS: u64 = 5;
/// 重翻一条要调一次模型,比写回慢得多;超时说明进程或上游卡住了,进程随请求一起被杀。
pub(super) const REPLAY_TIMEOUT: Duration = Duration::from_secs(300);

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
    let job_root = resolve_job_root(job, data_root).ok_or_else(|| AppError::not_ready("translation manifest"))?;
    let manifest = stored_path(job, data_root, StoredFile::TranslationManifest)
        .ok_or_else(|| AppError::not_ready("translation manifest"))?;
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
            json!({ "source_job_id": job.source_job_id().unwrap_or("") }),
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
    let process = ReviseProcess {
        program: deps.pipeline_command.to_string(),
        project_root: deps.project_root.to_path_buf(),
        job_root: job_root.clone(),
        item_id: item_id.to_string(),
        stdin_body: body.to_string(),
    };
    let output = run_revise_detached(process).await?;
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

/// 起一个 `translation-revise` 子进程要的全部输入(自有的,好交给独立任务)。
struct ReviseProcess {
    program: String,
    project_root: PathBuf,
    job_root: PathBuf,
    item_id: String,
    stdin_body: String,
}

/// 在独立任务里跑子进程,请求这边只等任务的结果。
///
/// 客户端断开时 axum 会丢弃处理函数的 future;子进程若归这个 future 所有,就被
/// SIGKILL 在「页文件已改、checkpoint 未写」的半路上。现在子进程归 spawn 出去的
/// 任务所有,处理函数被丢弃只是不再等结果,写回照样做完。
async fn run_revise_detached(process: ReviseProcess) -> Result<Output, AppError> {
    tokio::spawn(run_revise_process(
        process,
        REVISION_TIMEOUT,
        REVISION_TERM_GRACE_SECS,
    ))
    .await
    .map_err(|err| AppError::internal(format!("translation-revise task failed: {err}")))?
}

async fn run_revise_process(
    process: ReviseProcess,
    timeout: Duration,
    term_grace_secs: u64,
) -> Result<Output, AppError> {
    let mut command = Command::new(&process.program);
    command
        .arg("translation-revise")
        .arg("--job-root")
        .arg(&process.job_root)
        .arg("--item-id")
        .arg(&process.item_id)
        .current_dir(&process.project_root)
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        // 不靠 drop 杀进程:任务被取消(运行时关闭)时让它自己写完,
        // 写不完的半截状态由 Python 侧的意图记录恢复。
        .kill_on_drop(false);
    // 自成进程组,超时才能连子孙一起 SIGTERM/SIGKILL。
    retainpdf_proc::configure_child_process(&mut command);
    let mut child = command
        .spawn()
        .map_err(|err| AppError::internal(format!("spawn translation-revise: {err}")))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(process.stdin_body.as_bytes())
            .await
            .map_err(|err| AppError::internal(format!("write translation-revise stdin: {err}")))?;
    }
    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();
    let work = async {
        let stdout = async {
            let mut buffer = Vec::new();
            if let Some(pipe) = stdout_pipe.as_mut() {
                let _ = pipe.read_to_end(&mut buffer).await;
            }
            buffer
        };
        let stderr = async {
            let mut buffer = Vec::new();
            if let Some(pipe) = stderr_pipe.as_mut() {
                let _ = pipe.read_to_end(&mut buffer).await;
            }
            buffer
        };
        let (status, stdout, stderr) = tokio::join!(child.wait(), stdout, stderr);
        status.map(|status| Output { status, stdout, stderr })
    };
    match tokio::time::timeout(timeout, work).await {
        Ok(result) => {
            result.map_err(|err| AppError::internal(format!("wait translation-revise: {err}")))
        }
        Err(_) => {
            retainpdf_proc::terminate_child_process_tree(&mut child, term_grace_secs).await;
            Err(AppError::internal("translation-revise timed out"))
        }
    }
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
    let manifest = stored_path(job, data_root, StoredFile::TranslationManifest)
        .ok_or_else(|| AppError::not_ready("translation manifest"))?;
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

    #[cfg(unix)]
    fn fake_revise(dir: &Path, name: &str, script_body: &str) -> ReviseProcess {
        use std::os::unix::fs::PermissionsExt;
        let program = dir.join(name);
        std::fs::write(&program, format!("#!/bin/sh\n[ -n \"$REVISE_WARMUP\" ] && exit 0\n{script_body}\n"))
            .expect("write script");
        std::fs::set_permissions(&program, std::fs::Permissions::from_mode(0o755)).expect("chmod");
        // 先空跑一次，见 files::test_scripts：不然脚本还没装上 trap 就收到 SIGTERM，超时、宽限的几条测试时红时绿
        crate::files::test_scripts::warm_up_fresh_script(&program, "REVISE_WARMUP");
        ReviseProcess {
            program: program.to_string_lossy().into_owned(),
            project_root: dir.to_path_buf(),
            job_root: dir.to_path_buf(),
            item_id: "p001-b001".to_string(),
            stdin_body: "{}".to_string(),
        }
    }

    #[cfg(unix)]
    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("revise-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn timeout_sends_sigterm_first_so_the_child_can_roll_back() {
        let dir = temp_dir("term");
        let marker = dir.join("got-term");
        let process = fake_revise(
            &dir,
            "revise.sh",
            &format!("trap 'echo term > {}; exit 143' TERM\nsleep 30 &\nwait $!", marker.display()),
        );
        // 超时要留足:macOS 上第一次执行刚写出的脚本可能要上百毫秒,太早发 SIGTERM
        // 会赶在脚本装 trap 之前。
        let started = std::time::Instant::now();
        let error = run_revise_process(process, Duration::from_secs(2), 10)
            .await
            .expect_err("must time out");
        assert!(format!("{error:?}").contains("timed out"), "{error:?}");
        // 子进程自己处理了 SIGTERM 并退出:没有等满宽限期,更没有被 SIGKILL。
        assert!(marker.exists(), "child never saw SIGTERM");
        assert!(started.elapsed() < Duration::from_secs(6), "{:?}", started.elapsed());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn timeout_escalates_to_sigkill_after_the_grace_period() {
        let dir = temp_dir("kill");
        let pid_file = dir.join("pid");
        let process = fake_revise(
            &dir,
            "revise.sh",
            &format!("trap '' TERM\necho $$ > {}\nwhile true; do sleep 1; done", pid_file.display()),
        );
        let started = std::time::Instant::now();
        let error = run_revise_process(process, Duration::from_secs(2), 1)
            .await
            .expect_err("must time out");
        assert!(format!("{error:?}").contains("timed out"), "{error:?}");
        assert!(started.elapsed() >= Duration::from_secs(3), "SIGKILL came before the grace period: {:?}", started.elapsed());
        let pid: u32 = std::fs::read_to_string(&pid_file).expect("pid").trim().parse().expect("pid");
        assert!(!retainpdf_proc::worker_process_exists(pid), "child survived SIGKILL");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn dropping_the_waiting_future_does_not_kill_the_child() {
        let dir = temp_dir("detach");
        let marker = dir.join("finished");
        let process = fake_revise(
            &dir,
            "revise.sh",
            &format!("sleep 1\necho done > {}\necho '{{}}'", marker.display()),
        );
        let waiting = run_revise_detached(process);
        // 等的这一边在子进程跑到一半时被丢弃(客户端断开)。
        let _ = tokio::time::timeout(Duration::from_millis(200), waiting).await;
        assert!(!marker.exists());
        // 子进程睡 1 秒后写标记：轮询到它出现就行，最多等 5 秒（以前固定睡 2.5 秒）
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        while !marker.exists() && std::time::Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        assert!(marker.exists(), "child was killed together with the dropped future");
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
