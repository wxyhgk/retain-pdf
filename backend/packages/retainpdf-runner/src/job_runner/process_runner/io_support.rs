use std::collections::HashSet;
use std::fs::File;
use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncBufRead, AsyncBufReadExt, BufReader};
use tokio::sync::{Mutex, RwLock};
use tokio::time::timeout;

use crate::db::{PipelineAttemptCursor, PipelineStageObservation, PipelineUnitCommit};
use crate::job_events::cas_persist_job_with_resources;
use crate::models::api::{redact_text, sensitive_values};
use crate::models::domain::{job_user_stage, now_iso, JobRuntimeState};

use crate::job_runner::JobPersistDeps;

use super::super::cancel_registry::{is_cancel_requested_any, job_row_is_gone};
use super::super::runtime_state::apply_job_stdout_line;
use super::super::stdout_parser::{
    parse_artifact_published_line, parse_pipeline_checkpoint_line,
    parse_pipeline_stage_observation_line, PipelineStageObservationLine, PublishedArtifactLine,
};
use super::checkpoint_commit::apply_durable_checkpoint;

/// 只有日志尾巴变了的行（[`persist_key`] 没变），最快隔这么久才落一次库。
///
/// 以前 stdout 每读一行就整行重写一次任务（读出旧行做 diff、重写全部列、重登记产物、提交一次事务），
/// 一本书几千行日志时数据库和磁盘全耗在这上面。阶段、进度、产物这些会派生事件、别人要立刻看到的字段
/// 变了照旧马上写，所以派生出来的事件一条不少；合并的只是纯日志行。
const LOG_ONLY_PERSIST_INTERVAL: Duration = Duration::from_millis(500);

/// 逐行落库连续失败这么多次才当作读取任务出错（偶尔一次 `database is locked` 不该让任务失败）。
const MAX_CONSECUTIVE_PERSIST_FAILURES: u32 = 3;

/// 读一行，不是 UTF-8 的字节按替换字符解码。`lines()` 碰到一行坏字节直接报错，读取任务就退出了。
/// 和 `lines()` 一样去掉行尾的 `\n` / `\r\n`。
///
/// 可以被打断（[`read_stdout`] 套了超时）：`read_until` 被打断时读了一半的字节留在 `buf` 里，
/// 下次调用接着往后读，所以只在拿到整行以后才清空 `buf`。
async fn next_line_lossy<R>(reader: &mut R, buf: &mut Vec<u8>) -> std::io::Result<Option<String>>
where
    R: AsyncBufRead + Unpin,
{
    if reader.read_until(b'\n', buf).await? == 0 && buf.is_empty() {
        return Ok(None);
    }
    if buf.ends_with(b"\n") {
        buf.pop();
        if buf.ends_with(b"\r") {
            buf.pop();
        }
    }
    let line = String::from_utf8_lossy(buf).into_owned();
    buf.clear();
    Ok(Some(line))
}

pub(super) async fn read_stream<R>(reader: R, secrets: Vec<String>) -> Result<String>
where
    R: tokio::io::AsyncRead + Unpin,
{
    let mut reader = BufReader::new(reader);
    let mut buf = Vec::new();
    let mut out = String::new();
    while let Some(line) = next_line_lossy(&mut reader, &mut buf).await? {
        out.push_str(&redact_text(&line, &secrets));
        out.push('\n');
    }
    Ok(out)
}

/// 变了就要马上落库的字段：派生事件看的（状态、阶段、阶段说明、进度、错误、失败）和读的人要立刻拿到的
/// （产物、结果）。剩下 `log_tail`、`updated_at`、`runtime` 只变的行按 [`LOG_ONLY_PERSIST_INTERVAL`] 合并。
fn persist_key(job: &JobRuntimeState) -> serde_json::Value {
    serde_json::json!({
        "status": job.status,
        "stage": job.stage,
        "stage_detail": job.stage_detail,
        "progress_current": job.progress_current,
        "progress_total": job.progress_total,
        "error": job.error,
        "failure": job.failure,
        "result": job.result,
        "artifacts": job.artifacts,
    })
}

/// 逐行落库的节流：上一次写进去的 [`persist_key`] 和时间。
struct PersistGate {
    key: serde_json::Value,
    at: Instant,
}

impl PersistGate {
    fn new(job: &JobRuntimeState, now: Instant) -> Self {
        Self {
            key: persist_key(job),
            at: now,
        }
    }

    fn should_persist(&self, key: &serde_json::Value, now: Instant) -> bool {
        *key != self.key || now.duration_since(self.at) >= LOG_ONLY_PERSIST_INTERVAL
    }

    fn persisted(&mut self, key: serde_json::Value, now: Instant) {
        self.key = key;
        self.at = now;
    }
}

/// 什么算"有进展"(`timeout_seconds` 从最近一次进展算起,见 `execution::TimeoutKind`):阶段事件的
/// (阶段, 子阶段, 进度, 总数) 和上一条不同,或者提交了检查点、发布了产物。只换说明文字、反复报同一个进度
/// 的行不算,否则一个原地打转、不停打印的 worker 永远不会被判卡住。
#[derive(Default)]
struct ProgressMark {
    last: Option<(String, String, Option<i64>, Option<i64>)>,
}

impl ProgressMark {
    fn advanced_by(&mut self, observation: &PipelineStageObservationLine) -> bool {
        let mark = (
            observation.stage.clone(),
            observation.substage.clone(),
            observation.progress_current,
            observation.progress_total,
        );
        if self.last.as_ref() == Some(&mark) {
            return false;
        }
        self.last = Some(mark);
        true
    }
}

pub(super) async fn read_stdout(
    persist: JobPersistDeps,
    canceled_jobs: Arc<RwLock<HashSet<String>>>,
    mut job: JobRuntimeState,
    stdout: tokio::process::ChildStdout,
    runtime_secrets: Vec<String>,
    extra_cancel_job_ids: Vec<String>,
    last_output_at: Arc<Mutex<Instant>>,
    last_progress_at: Arc<Mutex<Instant>>,
    row_gone: Arc<AtomicBool>,
) -> Result<(String, JobRuntimeState)> {
    let mut out = String::new();
    let mut secrets = sensitive_values(&job.request_payload);
    secrets.extend(runtime_secrets);
    let mut reader = BufReader::new(stdout);
    let mut line_buf = Vec::new();
    let stage_key = durable_stage_key(job.stage.as_deref());
    let worker_id = format!(
        "{}:{}",
        job.job_id,
        job.pid
            .map(|pid| pid.to_string())
            .unwrap_or_else(|| "no-pid".to_string())
    );
    let mut pipeline_cursor = persist.db.acquire_pipeline_attempt(
        &job.job_id,
        &worker_id,
        stage_key,
        durable_stage_order(stage_key),
    )?;
    let mut gate = PersistGate::new(&job, Instant::now());
    let mut progress = ProgressMark::default();
    // 读过、但还没写进库的行（被合并掉了，或者刚读到还没走到落库）。
    let mut pending = false;
    // 被取消、别人落了终态、行没了：不再写这个任务。
    let mut stopped = false;
    let outcome: Result<()> = async {
        let mut persist_failures = 0;
        loop {
            // 有没写的行时，下一行最多等到合并窗口结束：worker 打完最后几行就不出声（卡住、孙进程占着管道）
            // 时，这几行照样半秒内进库。
            let next = if pending {
                let wait = LOG_ONLY_PERSIST_INTERVAL.saturating_sub(gate.at.elapsed());
                match timeout(wait, next_line_lossy(&mut reader, &mut line_buf)).await {
                    Ok(next) => next?,
                    Err(_) => {
                        match write_progress(&persist, &job, &row_gone, &mut persist_failures)? {
                            ProgressWrite::Written => {
                                gate.persisted(persist_key(&job), Instant::now());
                                pending = false;
                            }
                            ProgressWrite::Retry => gate.at = Instant::now(),
                            ProgressWrite::Stop => {
                                stopped = true;
                                return Ok(());
                            }
                        }
                        continue;
                    }
                }
            } else {
                next_line_lossy(&mut reader, &mut line_buf).await?
            };
            let Some(raw_line) = next else {
                return Ok(());
            };
            let line = redact_text(&raw_line, &secrets);
            // 收到任何一行就算"还在动"。放在所有 break 之前:进程有没有活着,
            // 与这行内容是什么、要不要继续处理它无关。
            *last_output_at.lock().await = Instant::now();
            if is_cancel_requested_any(&canceled_jobs, &job.job_id, &extra_cancel_job_ids).await {
                stopped = true;
                return Ok(());
            }
            out.push_str(&line);
            out.push('\n');
            apply_job_stdout_line(&mut job, &line);
            pending = true;
            if let Some(observation) = parse_pipeline_stage_observation_line(&line) {
                if progress.advanced_by(&observation) {
                    *last_progress_at.lock().await = Instant::now();
                }
                apply_durable_stage_observation(
                    persist.db.as_ref(),
                    &mut pipeline_cursor,
                    observation,
                )?;
            }
            if let Some(observation) = parse_pipeline_checkpoint_line(&line) {
                *last_progress_at.lock().await = Instant::now();
                apply_durable_checkpoint(persist.db.as_ref(), &mut pipeline_cursor, observation)?;
            }
            if let Some(artifact) = parse_artifact_published_line(&line) {
                *last_progress_at.lock().await = Instant::now();
                apply_durable_artifact_commit(persist.db.as_ref(), &mut pipeline_cursor, artifact)?;
            }
            if is_cancel_requested_any(&canceled_jobs, &job.job_id, &extra_cancel_job_ids).await {
                stopped = true;
                return Ok(());
            }
            job.updated_at = now_iso();
            let key = persist_key(&job);
            let now = Instant::now();
            if !gate.should_persist(&key, now) {
                continue;
            }
            // 逐行进度也走 CAS。上面那次取消检查和这次写之间不是原子的,无条件写会把
            // 期间落库的终态(通常是取消)盖回 running——和 driver 推进阶段是同一个
            // lost update,只是这里每读一行就有一次机会。
            match write_progress(&persist, &job, &row_gone, &mut persist_failures)? {
                ProgressWrite::Written => {
                    gate.persisted(key, now);
                    pending = false;
                }
                ProgressWrite::Retry => gate.at = now,
                ProgressWrite::Stop => {
                    stopped = true;
                    return Ok(());
                }
            }
        }
    }
    .await;
    // 没写的行补写进去。读到结尾时收尾还会用内存里这份再写一次终态；但读取任务出错退出时，收尾
    // （`persist_failed_job`）从库里重读任务，不补写的话最后几行——往往就是报错原因——就丢了。
    if pending && !stopped {
        if let Err(error) = cas_persist_job_with_resources(
            persist.db.as_ref(),
            &persist.data_root,
            &persist.output_root,
            &job.snapshot(),
            &["queued", "running"],
        ) {
            tracing::warn!("job={}: stdout 读取收尾时补写进度失败: {error:#}", job.job_id);
        }
    }
    outcome?;
    Ok((out, job))
}

enum ProgressWrite {
    Written,
    /// 这次没写进去，下一行（或下一个窗口）再写。
    Retry,
    /// CAS 没写进去：别人已经给这个任务落了终态，或者行被删了。继续读它的 stdout 也没有意义。
    Stop,
}

/// 逐行进度落库一次。进度只是镜像，写失败记日志等下次；连续 [`MAX_CONSECUTIVE_PERSIST_FAILURES`] 次
/// 都不行才返回错误（读取任务出错，worker 会被停掉）。
fn write_progress(
    persist: &JobPersistDeps,
    job: &JobRuntimeState,
    row_gone: &AtomicBool,
    failures: &mut u32,
) -> Result<ProgressWrite> {
    match cas_persist_job_with_resources(
        persist.db.as_ref(),
        &persist.data_root,
        &persist.output_root,
        &job.snapshot(),
        &["queued", "running"],
    ) {
        Ok(true) => {
            *failures = 0;
            Ok(ProgressWrite::Written)
        }
        Ok(false) => {
            // 行被删了（强制删除）和「别人已落终态」不同：后者 worker 由取消路径负责杀，
            // 前者没有人会来杀它，通知等待方把进程树终止掉。
            if job_row_is_gone(persist.db.as_ref(), &job.job_id) {
                row_gone.store(true, Ordering::SeqCst);
            }
            Ok(ProgressWrite::Stop)
        }
        Err(error) => {
            *failures += 1;
            if *failures >= MAX_CONSECUTIVE_PERSIST_FAILURES {
                return Err(error.context(format!(
                    "persisting stdout progress for job {} failed {failures} times in a row",
                    job.job_id
                )));
            }
            tracing::warn!(
                "job={}: 逐行进度落库失败（第 {failures} 次），下一次再试: {error:#}",
                job.job_id
            );
            Ok(ProgressWrite::Retry)
        }
    }
}

fn apply_durable_artifact_commit(
    db: &crate::db::Db,
    cursor: &mut PipelineAttemptCursor,
    artifact: PublishedArtifactLine,
) -> Result<()> {
    if cursor.stage_key != "render" || artifact.artifact_key != "output_pdf" {
        return Ok(());
    }
    let path = std::path::Path::new(&artifact.path);
    if !path.is_file() {
        anyhow::bail!(
            "published render output is not a regular file for job {}: {}",
            cursor.job_id,
            path.display()
        );
    }
    let output_hash = sha256_file(path)?;
    let checkpoint = db.commit_pipeline_unit(
        cursor,
        &PipelineUnitCommit {
            unit_key: "output-pdf".to_string(),
            // Reserve the largest SQLite INTEGER order for the final artifact;
            // any future page units can remain naturally ordered below it.
            unit_order: i64::MAX as u64,
            page_index: None,
            page_hash: output_hash,
            producer_generation: None,
            payload: serde_json::json!({
                "unit_kind": "render_output",
                "artifact_key": artifact.artifact_key,
                "path": artifact.path,
                "hash_kind": "sha256",
            }),
        },
    )?;
    cursor.generation = checkpoint.generation;
    let checkpoint = db.complete_pipeline_stage(cursor)?;
    cursor.generation = checkpoint.generation;
    Ok(())
}

fn sha256_file(path: &std::path::Path) -> Result<String> {
    let mut file = File::open(path)
        .with_context(|| format!("failed to open durable artifact {}", path.display()))?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .with_context(|| format!("failed to hash durable artifact {}", path.display()))?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(digest
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn apply_durable_stage_observation(
    db: &crate::db::Db,
    cursor: &mut PipelineAttemptCursor,
    observation: PipelineStageObservationLine,
) -> Result<()> {
    if observation.job_id.trim() != cursor.job_id {
        anyhow::bail!(
            "pipeline stage observation job mismatch: worker={} authoritative={}",
            observation.job_id,
            cursor.job_id
        );
    }
    let Some(stage_key) = durable_stage_key_for_observation(&observation) else {
        return Ok(());
    };
    let activate_stage = observation.substage.trim() != "render_prewarm";
    let next = db.observe_pipeline_stage(
        cursor,
        stage_key,
        durable_stage_order(stage_key),
        activate_stage,
        &PipelineStageObservation {
            producer_seq: observation.seq,
            producer_ts: observation.ts,
            event_type: observation.event_type,
            raw_stage: observation.stage,
            substage: optional_text(observation.substage),
            stage_detail: optional_text(observation.stage_detail),
            message: observation.message,
            provider: optional_text(observation.provider),
            provider_stage: optional_text(observation.provider_stage),
            progress_current: observation.progress_current,
            progress_total: observation.progress_total,
            progress_unit: optional_text(observation.progress_unit),
            payload: observation.payload,
        },
    )?;
    *cursor = next;
    Ok(())
}

fn durable_stage_key_for_observation(
    observation: &PipelineStageObservationLine,
) -> Option<&'static str> {
    match observation.user_stage.trim() {
        "ocr" => Some("ocr"),
        "translate" | "translation" => Some("translate"),
        "render" => Some("render"),
        _ => match job_user_stage(Some(observation.stage.trim())) {
            Some("ocr") => Some("ocr"),
            Some("translation") => Some("translate"),
            Some("render") => Some("render"),
            _ => None,
        },
    }
}

fn optional_text(value: String) -> Option<String> {
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_string())
}

fn durable_stage_key(stage: Option<&str>) -> &'static str {
    match job_user_stage(stage) {
        Some("ocr") => "ocr",
        Some("translation") => "translate",
        Some("render") => "render",
        _ => "pipeline",
    }
}

fn durable_stage_order(stage: &str) -> u32 {
    match stage {
        "ocr" => 0,
        "translate" => 1,
        "render" => 2,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::db::Db;
    use crate::models::domain::JobSnapshot;
    use crate::models::request::CreateJobInput;

    #[tokio::test]
    async fn lossy_lines_strip_line_endings_and_replace_bad_bytes() {
        let mut reader = BufReader::new(&b"one\r\ntwo\n\xffthree"[..]);
        let mut buf = Vec::new();
        let mut lines = Vec::new();
        while let Some(line) = next_line_lossy(&mut reader, &mut buf).await.unwrap() {
            lines.push(line);
        }
        assert_eq!(lines, ["one", "two", "\u{fffd}three"]);
    }

    #[test]
    fn persist_gate_merges_log_only_lines_but_not_visible_changes() {
        let mut job = JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        )
        .into_runtime();
        let start = Instant::now();
        let gate = PersistGate::new(&job, start);
        let soon = start + Duration::from_millis(100);

        // 只多了一行日志：窗口内不写，过了窗口写。
        job.append_log("plain log line");
        let key = persist_key(&job);
        assert!(!gate.should_persist(&key, soon));
        assert!(gate.should_persist(&key, start + LOG_ONLY_PERSIST_INTERVAL));

        // 阶段说明、进度、产物变了：马上写（派生事件看的就是这些）。
        let mut detail = job.clone();
        detail.stage_detail = Some("正在翻译第 3 批".to_string());
        assert!(gate.should_persist(&persist_key(&detail), soon));
        let mut progress = job.clone();
        progress.progress_current = Some(3);
        assert!(gate.should_persist(&persist_key(&progress), soon));
        let mut artifacts = job.clone();
        crate::job_runner::runtime_state::job_artifacts_mut(&mut artifacts).output_pdf =
            Some("/tmp/out.pdf".to_string());
        assert!(gate.should_persist(&persist_key(&artifacts), soon));
    }

    #[test]
    fn published_render_output_commits_final_unit_and_completes_stage() {
        let root = std::env::temp_dir().join(format!(
            "retain-render-output-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        fs::create_dir_all(&root).expect("fixture root");
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().expect("init db");
        db.save_job(&JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        ))
        .expect("seed job");
        let output = root.join("output.pdf");
        fs::write(&output, b"stable rendered pdf bytes").expect("render output");
        let mut cursor = db
            .acquire_pipeline_attempt("job-1", "worker-a", "render", 2)
            .expect("render attempt");

        apply_durable_artifact_commit(
            &db,
            &mut cursor,
            PublishedArtifactLine {
                artifact_key: "output_pdf".to_string(),
                path: output.to_string_lossy().into_owned(),
            },
        )
        .expect("commit render output");

        let units = db
            .list_pipeline_units("job-1", cursor.attempt, "render")
            .expect("render units");
        assert_eq!(units.len(), 1);
        assert_eq!(units[0].unit_key, "output-pdf");
        assert_eq!(units[0].page_index, None);
        assert_eq!(units[0].payload["unit_kind"], "render_output");
        let stage = db
            .running_pipeline_stage_state("job-1")
            .expect("stage state")
            .expect("running attempt stage");
        assert_eq!(stage.stage_key, "render");
        assert_eq!(stage.status, "completed");

        let _ = fs::remove_dir_all(root);
    }
}
