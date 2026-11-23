use anyhow::Result;
use std::path::Path;
use tracing::warn;

use crate::config::AppConfig;
use crate::db::{Db, JobProcessRecord};
use crate::job_events::{cas_persist_job_with_resources, persist_job_with_resources};
use crate::models::domain::{now_iso, JobFailureInfo, JobStatusKind};
use crate::storage_paths::{JobPaths, TRANSLATION_REQUEST_JOURNAL_FILE_NAME};
use retainpdf_core::translation_request_journal::{
    parse_translation_request_journal, TranslationRequestJournalState,
};

use super::lifecycle::maintain_document_for_terminal;
use super::worker_identity::{classify_process_record, RecordedWorker};
use super::worker_process::terminate_job_process_tree_blocking;

#[cfg(test)]
#[path = "startup_recovery_auto_resume_tests.rs"]
mod auto_resume_tests;

/// Why a `Running`-status job found when its owning runtime starts is being reconciled.
enum StaleReason {
    /// No pid was ever recorded for this job.
    NoPid,
    /// The recorded pid is no longer alive.
    Dead(u32),
    /// The recorded pid is still alive, but the owning runtime restarted and
    /// can no longer consume its stdout or mark it finished.
    Orphaned(u32),
    /// 这个 pid 现在有进程，但核对身份不是记录里的 worker（号被复用了）：不杀，只清 pid。
    Reused(u32),
}

/// 重启前翻译阶段结果不明的请求：失败分类（登记在 job_failure_catalogue）。
const AMBIGUOUS_TRANSLATION_CATEGORY: &str = "translation_request_ambiguous";

/// 同一个 attempt 连续没有新进度的自动续跑最多几次；再发现它中断，就按失败收尾
/// （崩溃循环熔断：一份能把运行时整个弄崩的输入，每次重启都会被续跑、再弄崩）。
/// 两次中断之间提交过新单元或完成过阶段就从头数，正常的反复重启不会把长任务判死。
pub const MAX_AUTO_RESUMES_WITHOUT_PROGRESS: u32 = 3;

/// 超过自动续跑上限：失败分类（登记在 job_failure_catalogue）。
pub const AUTO_RESUME_LIMIT_CATEGORY: &str = "auto_resume_limit_exceeded";

/// 任务重启前停在翻译阶段、且 journal 显示有结果不明的请求（或 journal 读不了）时，
/// 返回 journal 的读取结论；其余情况（别的阶段、没有 journal、journal 干净）返回 `None`。
///
/// 只看翻译阶段：渲染 / 精修阶段不重发翻译请求，翻译完成后 journal 里残留的历史歧义
/// 不该挡住渲染的自动续跑。
fn ambiguous_translation_requests(
    config: &AppConfig,
    db: &Db,
    job_id: &str,
) -> Result<Option<TranslationRequestJournalState>> {
    if db.running_pipeline_stage_key(job_id)?.as_deref() != Some("translate") {
        return Ok(None);
    }
    let journal = JobPaths::for_job(&config.output_root, job_id)
        .translated_dir
        .join(TRANSLATION_REQUEST_JOURNAL_FILE_NAME);
    if !journal.is_file() {
        return Ok(None);
    }
    let state = parse_translation_request_journal(&journal);
    Ok(state.requires_confirmation.then_some(state))
}

/// Reconcile workers only when the process that owns the runtime starts.
///
/// InProcess mode calls this from the HTTP shell. Remote mode calls it from
/// retain-jobsd. The shell must never call it for jobsd-owned workers.
pub fn reconcile_stale_running_jobs(config: &AppConfig, db: &Db) -> Result<usize> {
    reconcile_running_jobs_matching(config, db, &|_| true, true)
}

/// 同上，但只处理 `include` 点头的 running 任务。运行期巡检（`driverless_sweep`）用它回收
/// 「库里是 running、进程内却没有 driver」的任务，规则和启动时完全一样，不另写一份。
///
/// `settle_children` 只在启动时为真：父任务已终态的 OCR 子任务那一步假定没有任何 driver 在跑。
pub(super) fn reconcile_running_jobs_matching(
    config: &AppConfig,
    db: &Db,
    include: &dyn Fn(&JobProcessRecord) -> bool,
    settle_children: bool,
) -> Result<usize> {
    let running_jobs = db.list_job_process_records_with_status(&JobStatusKind::Running)?;
    let mut reconciled = 0usize;
    for job_record in running_jobs {
        if !include(&job_record) {
            continue;
        }
        // 杀之前核对身份：库里的 pid 可能早就归了别的进程（长时间宕机、重启机器之后），
        // 只凭 `kill(pid, 0)` 会把它整组杀掉。见 worker_identity.rs。
        let reason = match classify_process_record(&job_record) {
            Some((pid, RecordedWorker::Ours)) => StaleReason::Orphaned(pid),
            Some((pid, RecordedWorker::Gone)) => StaleReason::Dead(pid),
            Some((pid, RecordedWorker::NotOurs)) => {
                warn!(
                    "runtime startup: recorded worker pid={pid} of job {} now belongs to another process (pid reused); leaving it alone",
                    job_record.job_id
                );
                StaleReason::Reused(pid)
            }
            None => StaleReason::NoPid,
        };

        if let StaleReason::Orphaned(pid) = reason {
            warn!(
                "runtime startup found live orphaned worker process pid={pid} for job {} still running; terminating its process tree before recovering job state",
                job_record.job_id
            );
            if let Err(error) = terminate_job_process_tree_blocking(
                pid,
                config.job_runner.worker_terminate_grace_secs,
                config.job_runner.worker_terminate_poll_ms,
            ) {
                warn!(
                    "failed to terminate orphaned worker process pid={pid} for job {}: {error:#}",
                    job_record.job_id
                );
            }
        }

        let (detail, failure_category, failure_code) = match reason {
            StaleReason::Orphaned(pid) => (
                format!(
                    "任务运行时启动时发现遗留 running 任务，worker 进程 {pid} 仍在运行（孤儿进程），已终止该进程"
                ),
                "worker_orphaned_after_restart",
                "worker_orphaned_after_restart",
            ),
            StaleReason::Dead(pid) => (
                format!("任务运行时启动时发现遗留 running 任务，但 worker 进程 {pid} 已不存在"),
                "worker_process_missing",
                "worker_process_missing",
            ),
            StaleReason::Reused(pid) => (
                format!(
                    "任务运行时启动时发现遗留 running 任务，worker 已不存在：库里记的 pid {pid} 现在属于别的进程（pid 已被复用），没有终止它"
                ),
                "worker_process_missing",
                "worker_process_missing",
            ),
            StaleReason::NoPid => (
                "任务运行时启动时发现遗留 running 任务，但未记录 worker pid".to_string(),
                "worker_process_missing",
                "worker_process_missing",
            ),
        };
        let timestamp = now_iso();
        let has_attempt = db.has_running_pipeline_attempt(&job_record.job_id)?;
        // 翻译阶段有「已发出、没有终态」的请求时不自动续跑：续跑的 Python 会把它们
        // 原样再发一遍，用户没机会拒绝重复计费。手动重试要确认重复风险，自动路径同理。
        let ambiguous_translation = if has_attempt {
            ambiguous_translation_requests(config, db, &job_record.job_id)?
        } else {
            None
        };
        let resumable = has_attempt && ambiguous_translation.is_none();
        // 自动续跑计数（启动恢复和运行期巡检都走这里）：超过上限就不再续跑。
        let resume_tally = if resumable {
            db.next_auto_resume_tally(&job_record.job_id)?
        } else {
            None
        };
        let resume_limit_hit =
            resume_tally.is_some_and(|tally| tally.count > MAX_AUTO_RESUMES_WITHOUT_PROGRESS);
        let resumable = resumable && !resume_limit_hit;
        match db.get_job(&job_record.job_id) {
            Ok(mut job) => {
                job.updated_at = timestamp.clone();
                job.pid = None;
                let committed_render_output = restore_committed_render_output(
                    &mut job,
                    committed_render_output_path(db, &job_record.job_id)?,
                );
                if committed_render_output {
                    job.append_log(&format!("WARN: {detail}"));
                    job.append_log(
                        "INFO: committed render output recovered; task completed without rerender",
                    );
                    job.status = JobStatusKind::Succeeded;
                    job.stage = Some("finished".to_string());
                    job.stage_detail =
                        Some("runtime restart recovered committed render output".to_string());
                    job.error = None;
                    job.finished_at = Some(timestamp.clone());
                    job.replace_failure_info(None);
                } else if resumable {
                    job.append_log(&format!("WARN: {detail}"));
                    job.append_log(
                        "INFO: durable pipeline checkpoint found; job requeued for automatic resume",
                    );
                    job.status = JobStatusKind::Queued;
                    job.stage_detail = Some(
                        "runtime restart recovered durable checkpoint; waiting to resume"
                            .to_string(),
                    );
                    job.error = None;
                    job.finished_at = None;
                    job.replace_failure_info(None);
                } else if let Some(journal) = ambiguous_translation.as_ref() {
                    let summary = format!(
                        "重启前翻译阶段有 {} 个已发出但结果不明的上游请求（journal 状态 {}），不自动续跑",
                        journal.unresolved_dispatches.max(journal.active_ambiguous_request_keys),
                        journal.status
                    );
                    job.append_log(&format!("WARN: {detail}"));
                    job.append_log(&format!("ERROR: {summary}"));
                    job.status = JobStatusKind::Failed;
                    job.stage = Some("failed".to_string());
                    job.stage_detail = Some(summary.clone());
                    job.error = Some(summary.clone());
                    job.finished_at = Some(timestamp.clone());
                    let recovery = retainpdf_core::job_failure_catalogue::recovery_for(
                        AMBIGUOUS_TRANSLATION_CATEGORY,
                    );
                    job.replace_failure_info(Some(JobFailureInfo {
                        stage: "translation".to_string(),
                        category: AMBIGUOUS_TRANSLATION_CATEGORY.to_string(),
                        code: None,
                        failed_stage: Some("translation".to_string()),
                        failure_code: Some(AMBIGUOUS_TRANSLATION_CATEGORY.to_string()),
                        failure_category: Some("translation".to_string()),
                        provider_stage: None,
                        provider_code: None,
                        summary: "重启时翻译请求的结果不明，已暂停自动续跑".to_string(),
                        root_cause: Some(summary.clone()),
                        retryable: true,
                        upstream_host: None,
                        provider: None,
                        suggestion: Some(
                            "确认可接受重复请求（可能重复计费）后，用 retry-stage（translation）并带 ambiguous_request_policy=accept_duplicate_risk 重试".to_string(),
                        ),
                        last_log_line: Some(summary.clone()),
                        raw_excerpt: Some(summary.clone()),
                        raw_error_excerpt: Some(summary.clone()),
                        raw_diagnostic: None,
                        ai_diagnostic: None,
                        resume_from: recovery.resume_from.map(|s| s.as_str().to_string()),
                        recovery_hint: Some(recovery.hint.to_string()),
                        upstream: None,
                    }));
                } else if resume_limit_hit {
                    fail_for_auto_resume_limit(&mut job, &detail, &timestamp);
                } else {
                    job.append_log(&format!("ERROR: {detail}"));
                    job.status = JobStatusKind::Failed;
                    job.stage = Some("failed".to_string());
                    job.stage_detail =
                        Some("runtime startup stale running job recovered".to_string());
                    job.error = Some(detail.clone());
                    job.finished_at = Some(timestamp.clone());
                    // 查目录而不是写死:新增失败类型只该改 job_failure_catalogue 一处。
                    let recovery =
                        retainpdf_core::job_failure_catalogue::recovery_for(failure_category);
                    job.replace_failure_info(Some(JobFailureInfo {
                        stage: "startup_recovery".to_string(),
                        category: failure_category.to_string(),
                        code: None,
                        failed_stage: Some("startup_recovery".to_string()),
                        failure_code: Some(failure_code.to_string()),
                        failure_category: Some("internal".to_string()),
                        provider_stage: None,
                        provider_code: None,
                        summary: "任务运行时启动时回收了遗留 running 任务".to_string(),
                        root_cause: Some(detail.clone()),
                        retryable: true,
                        upstream_host: None,
                        provider: None,
                        suggestion: Some(
                            "该任务对应的 worker 已不在运行；请重新提交或手动重试".to_string(),
                        ),
                        last_log_line: Some(detail.clone()),
                        raw_excerpt: Some(detail.clone()),
                        raw_error_excerpt: Some(detail.clone()),
                        raw_diagnostic: None,
                        ai_diagnostic: None,
                        resume_from: recovery.resume_from.map(|s| s.as_str().to_string()),
                        recovery_hint: Some(recovery.hint.to_string()),
                        upstream: None,
                    }));
                }
                job.sync_runtime_state();
                // 落库前再确认一次没人接手；用 CAS（只认 running），万一这一瞬间 driver 起来
                // 改了行，就让它的结果算数，不去覆盖。
                if !include(&job_record)
                    || !cas_persist_job_with_resources(
                        db,
                        &config.data_root,
                        &config.output_root,
                        &job,
                        &["running"],
                    )?
                {
                    warn!(
                        "stale running job {} changed under reconciliation; left as is",
                        job_record.job_id
                    );
                    continue;
                }
                if committed_render_output {
                    db.finish_latest_pipeline_attempt(&job_record.job_id, "succeeded")?;
                } else if ambiguous_translation.is_some() || resume_limit_hit {
                    // 任务已落 Failed：attempt 必须收尾，否则它还会出现在自动续跑名单里。
                    db.finish_latest_pipeline_attempt(&job_record.job_id, "failed")?;
                } else if job.status == JobStatusKind::Queued {
                    if let Some(tally) = resume_tally.as_ref() {
                        db.record_auto_resume(&job_record.job_id, tally)?;
                    }
                }
                // 终态不是 run_job 写的,书卡和全文索引要在这里补(重新排队的不是终态,不动)。
                if matches!(job.status, JobStatusKind::Succeeded | JobStatusKind::Failed) {
                    maintain_document_for_terminal(
                        config,
                        db,
                        &job_record.job_id,
                        job.upload_id.as_deref(),
                        &job.status,
                    );
                }
            }
            Err(error) => {
                warn!(
                    "runtime startup reconciliation fell back to raw DB recovery for {}: {}",
                    job_record.job_id, error
                );
                db.recover_stale_running_job(&job_record.job_id, &detail, &timestamp)?;
                maintain_document_for_terminal(
                    config,
                    db,
                    &job_record.job_id,
                    None,
                    &JobStatusKind::Failed,
                );
            }
        }
        reconciled += 1;
        warn!(
            "recovered stale running job during runtime startup: {} resumable={resumable}",
            job_record.job_id
        );
    }
    if reconciled > 0 {
        warn!("runtime startup reconciliation recovered {reconciled} stale running job(s)");
    }
    // 放在上面的循环之后：那一轮会把当时在跑的父任务判成 queued（随后恢复）或 failed，
    // 判完再看哪些子任务的父任务已经终态。
    if settle_children {
        settle_orphaned_ocr_children(config, db)?;
    }
    Ok(reconciled)
}

/// 自动续跑次数超过上限：按失败收尾，写清原因（前端照 failure 的 summary / suggestion 显示）。
fn fail_for_auto_resume_limit(
    job: &mut crate::models::domain::JobSnapshot,
    detail: &str,
    timestamp: &str,
) {
    let summary = "自动续跑次数超过上限，疑似导致运行时崩溃".to_string();
    let root_cause = format!(
        "{detail}；这个任务已连续自动续跑 {MAX_AUTO_RESUMES_WITHOUT_PROGRESS} 次，每次都没有新进度就又中断了，\
         疑似这份输入让任务运行时崩溃，不再自动续跑"
    );
    job.append_log(&format!("WARN: {detail}"));
    job.append_log(&format!("ERROR: {root_cause}"));
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.stage_detail = Some(summary.clone());
    job.error = Some(root_cause.clone());
    job.finished_at = Some(timestamp.to_string());
    let recovery = retainpdf_core::job_failure_catalogue::recovery_for(AUTO_RESUME_LIMIT_CATEGORY);
    job.replace_failure_info(Some(JobFailureInfo {
        stage: "startup_recovery".to_string(),
        category: AUTO_RESUME_LIMIT_CATEGORY.to_string(),
        code: None,
        failed_stage: Some("startup_recovery".to_string()),
        failure_code: Some(AUTO_RESUME_LIMIT_CATEGORY.to_string()),
        failure_category: Some("internal".to_string()),
        provider_stage: None,
        provider_code: None,
        summary,
        root_cause: Some(root_cause.clone()),
        retryable: true,
        upstream_host: None,
        provider: None,
        suggestion: Some(
            "先看任务日志里最后处理到哪一页、哪一步，排查后再手动重试（手动重试会重新计数）".to_string(),
        ),
        last_log_line: Some(root_cause.clone()),
        raw_excerpt: Some(root_cause.clone()),
        raw_error_excerpt: Some(root_cause),
        raw_diagnostic: None,
        ai_diagnostic: None,
        resume_from: recovery.resume_from.map(|s| s.as_str().to_string()),
        recovery_hint: Some(recovery.hint.to_string()),
        upstream: None,
    }));
}

/// 父任务已终态的 OCR 子任务一次性落终态，并收尾悬空的 pipeline attempt。
///
/// 历史上子任务的 attempt 从没人收尾（只有顶层 driver 收尾自己的），于是子任务行可能
/// 已经 succeeded/failed 而 attempt 还 running；子任务跑着时重启，又会被上面的循环改回
/// queued、被恢复查询排除，永远卡住；父任务在建子任务的窗口被取消，子任务行留在 queued。
/// 父任务都结束了，不会再有人推进这些子任务：
/// - 行还在 queued/running：父任务取消 → canceled，其余 → failed；
/// - 然后按行的终态收尾 attempt（已经终态的行只收尾 attempt，状态不动）。
fn settle_orphaned_ocr_children(config: &AppConfig, db: &Db) -> Result<usize> {
    let children = db.list_unsettled_ocr_children()?;
    for (child_id, parent_status) in &children {
        let mut child = match db.get_job(child_id) {
            Ok(child) => child,
            Err(error) => {
                warn!("runtime startup failed to load orphaned ocr child {child_id}: {error:#}");
                continue;
            }
        };
        if matches!(child.status, JobStatusKind::Queued | JobStatusKind::Running) {
            let timestamp = now_iso();
            let canceled = *parent_status == JobStatusKind::Canceled;
            let detail = if canceled {
                "父任务已取消，OCR 子任务随之取消（启动时收尾）"
            } else {
                "父任务已结束而 OCR 子任务未收尾（启动时收尾）"
            };
            child.status = if canceled {
                JobStatusKind::Canceled
            } else {
                JobStatusKind::Failed
            };
            child.stage = Some(if canceled { "canceled" } else { "failed" }.to_string());
            child.stage_detail = Some(detail.to_string());
            child.error = (!canceled).then(|| detail.to_string());
            child.pid = None;
            child.updated_at = timestamp.clone();
            child.finished_at = Some(timestamp);
            child.append_log(&format!("WARN: {detail}"));
            child.sync_runtime_state();
            persist_job_with_resources(db, &config.data_root, &config.output_root, &child)?;
        }
        let status = match child.status {
            JobStatusKind::Succeeded => "succeeded",
            JobStatusKind::Canceled => "canceled",
            _ => "failed",
        };
        if status != "succeeded" {
            // 进程死在「已写下提交意图、还没拿到回执」之间：请求有没有送到服务商说不清。
            // 子任务从此不会再有人续跑，把它标成 ambiguous，重试、重跑的闸门才认得出来
            // （闸门只认 ambiguous；同一个 attempt 被再次认领时才会自己转，子任务等不到）。
            if let Err(error) = db.mark_open_dispatch_intents_ambiguous(
                child_id,
                "runtime restarted after the OCR request intent was recorded and before a provider receipt was stored",
            ) {
                warn!("runtime startup failed to mark OCR dispatch of {child_id} ambiguous: {error:#}");
            }
        }
        db.finish_latest_pipeline_attempt(child_id, status)?;
    }
    if !children.is_empty() {
        warn!(
            "runtime startup settled {} orphaned OCR child job(s) whose parent already finished",
            children.len()
        );
    }
    Ok(children.len())
}

/// Re-drive queued jobs that never started a durable attempt.
///
/// Startup-only contract (see `Db::list_stuck_queued_job_ids`): right after
/// a runtime (re)start no driver task owns any queued job, so re-driving is
/// safe. Jobs with a running attempt are excluded here; they resume through
/// `list_resumable_pipeline_job_ids` instead, so the two paths never
/// double-drive the same job.
pub fn requeue_stuck_queued_jobs(config: &AppConfig, db: &Db) -> Result<Vec<String>> {
    requeue_stuck_queued_jobs_matching(config, db, &|_| true)
}

/// 同上，但只处理 `include` 点头的任务；运行期巡检用它排除还有 driver 的、还没过宽限期的。
/// 「没有 driver」由调用方的 `include` 保证——这正是 `list_stuck_queued_job_ids` 文档里
/// 「只许启动时调」的那个前提在运行期的替代。
pub(super) fn requeue_stuck_queued_jobs_matching(
    config: &AppConfig,
    db: &Db,
    include: &dyn Fn(&str) -> bool,
) -> Result<Vec<String>> {
    let mut stuck = db.list_stuck_queued_job_ids()?;
    stuck.retain(|job_id| include(job_id));
    let timestamp = now_iso();
    for job_id in &stuck {
        match db.get_job(job_id) {
            Ok(mut job) => {
                job.updated_at = timestamp.clone();
                job.stage_detail = Some(
                    "runtime startup requeued stuck queued job for automatic resume".to_string(),
                );
                job.append_log(
                    "WARN: runtime startup found queued job with no driver; requeued for automatic resume",
                );
                job.sync_runtime_state();
                if let Err(error) =
                    persist_job_with_resources(db, &config.data_root, &config.output_root, &job)
                {
                    warn!("runtime startup failed to mark requeued job {job_id}: {error:#}");
                }
            }
            Err(error) => {
                warn!("runtime startup found stuck queued job {job_id} but failed to load it: {error:#}");
            }
        }
        warn!("runtime startup requeued stuck queued job {job_id}");
    }
    if !stuck.is_empty() {
        warn!(
            "runtime startup reconciliation requeued {} stuck queued job(s)",
            stuck.len()
        );
    }
    Ok(stuck)
}

fn committed_render_output_path(db: &Db, job_id: &str) -> Result<Option<String>> {
    let Some(stage) = db.running_pipeline_stage_state(job_id)? else {
        return Ok(None);
    };
    if stage.stage_key != "render" || stage.status != "completed" {
        return Ok(None);
    }
    let units = db.list_pipeline_units(job_id, stage.attempt, "render")?;
    Ok(units.into_iter().rev().find_map(|unit| {
        (unit.unit_key == "output-pdf"
            && unit
                .payload
                .get("unit_kind")
                .and_then(serde_json::Value::as_str)
                == Some("render_output"))
        .then(|| {
            unit.payload
                .get("path")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        })
        .flatten()
    }))
}

fn restore_committed_render_output(
    job: &mut crate::models::domain::JobSnapshot,
    committed_output_path: Option<String>,
) -> bool {
    let Some(output_path) = committed_output_path else {
        return false;
    };
    job.artifacts
        .get_or_insert_with(Default::default)
        .output_pdf = Some(output_path);
    render_artifacts_are_ready(job)
}

fn render_artifacts_are_ready(job: &crate::models::domain::JobSnapshot) -> bool {
    let Some(artifacts) = job.artifacts.as_ref() else {
        return false;
    };
    let outputs = artifacts.render_outputs();
    outputs
        .output_pdf
        .as_deref()
        .map(Path::new)
        .is_some_and(Path::is_file)
        && outputs
            .summary
            .as_deref()
            .map(Path::new)
            .is_some_and(Path::is_file)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{render_artifacts_are_ready, restore_committed_render_output};
    use crate::models::domain::JobSnapshot;
    use crate::models::request::CreateJobInput;

    #[test]
    fn committed_render_recovery_requires_output_and_summary_files() {
        let root = std::env::temp_dir().join(format!(
            "retain-render-recovery-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        fs::create_dir_all(&root).expect("fixture root");
        let output = root.join("output.pdf");
        let summary = root.join("pipeline_summary.json");
        let mut job = JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        let artifacts = job.artifacts.get_or_insert_with(Default::default);
        artifacts.output_pdf = Some(output.to_string_lossy().into_owned());
        artifacts.summary = Some(summary.to_string_lossy().into_owned());

        fs::write(&output, b"pdf").expect("output");
        assert!(!render_artifacts_are_ready(&job));
        fs::write(&summary, b"{}").expect("summary");
        assert!(render_artifacts_are_ready(&job));

        job.artifacts.as_mut().expect("artifacts").output_pdf = None;
        assert!(restore_committed_render_output(
            &mut job,
            Some(output.to_string_lossy().into_owned())
        ));
        assert_eq!(
            job.artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.output_pdf.as_deref()),
            Some(output.to_string_lossy().as_ref())
        );

        let _ = fs::remove_dir_all(root);
    }

    fn save(db: &crate::db::Db, id: &str, status: crate::models::domain::JobStatusKind) {
        let mut job = JobSnapshot::new(id.to_string(), CreateJobInput::default(), vec![]);
        job.status = status;
        db.save_job(&job).expect("save job");
    }

    /// 父任务已终态的 OCR 子任务，启动时必须落终态、收尾悬空 attempt。
    ///
    /// 数据库拷贝上的现状：pipeline_attempts 里 31 条 running 全是 `-ocr` 子任务（25 个行已
    /// succeeded、6 个 failed），父任务全部终态 —— 子任务的 attempt 从没人收尾。
    #[test]
    fn startup_settles_ocr_children_whose_parent_already_finished() {
        use crate::models::domain::JobStatusKind::*;
        let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
        let db = deps.db.as_ref();
        let running_attempt = |id: &str| db.has_running_pipeline_attempt(id).unwrap();

        // 行已 succeeded、attempt 还 running（历史残留的主体）。
        save(db, "p-done", Succeeded);
        save(db, "p-done-ocr", Succeeded);
        db.acquire_pipeline_attempt("p-done-ocr", "native-ocr:1:p-done-ocr", "ocr", 0).unwrap();
        // 父任务失败，子任务跑到一半（重启前）：行 running、attempt running。
        save(db, "p-failed", Failed);
        save(db, "p-failed-ocr", Running);
        db.acquire_pipeline_attempt("p-failed-ocr", "native-ocr:1:p-failed-ocr", "ocr", 0).unwrap();
        // 父任务在建子任务的窗口里被取消：子任务行留在 queued、没有 attempt。
        save(db, "p-canceled", Canceled);
        save(db, "p-canceled-ocr", Queued);
        // 父任务还会恢复：子任务不碰。
        save(db, "p-queued", Queued);
        save(db, "p-queued-ocr", Queued);
        db.acquire_pipeline_attempt("p-queued-ocr", "native-ocr:1:p-queued-ocr", "ocr", 0).unwrap();
        // 名字碰巧以 -ocr 结尾的独立任务：没有父任务，不碰。
        save(db, "solo-ocr", Queued);

        super::reconcile_stale_running_jobs(&deps.config, db).expect("startup recovery");

        assert!(!running_attempt("p-done-ocr"), "已成功的子任务 attempt 仍是 running");
        assert_eq!(db.get_job("p-done-ocr").unwrap().status, Succeeded, "已终态的子任务状态不该变");
        assert_eq!(db.get_job("p-failed-ocr").unwrap().status, Failed);
        assert!(!running_attempt("p-failed-ocr"));
        assert_eq!(db.get_job("p-canceled-ocr").unwrap().status, Canceled);
        assert!(running_attempt("p-queued-ocr"), "父任务还会恢复，子任务 attempt 不能动");
        assert_eq!(db.get_job("p-queued-ocr").unwrap().status, Queued);
        assert_eq!(db.get_job("solo-ocr").unwrap().status, Queued);

        // 幂等：再启动一次什么都不剩。
        assert!(db.list_unsettled_ocr_children().unwrap().is_empty());
    }

    const DISPATCH_T1: &str = "{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1,\"event\":\"dispatch\",\"request_token\":\"t1\",\"request_key\":\"k1\"}\n";
    const TERMINAL_T1: &str = "{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1,\"event\":\"terminal\",\"request_token\":\"t1\",\"request_key\":\"k1\",\"outcome\":\"succeeded\"}\n";

    /// 重启前正在翻译阶段的 Running 任务：和真实启动序列一样，先 `reconcile_stale_running_jobs`，
    /// 再看 `list_resumable_pipeline_job_ids`（API / jobsd 就是据此自动续跑的）。
    fn seed_running_translation_job(
        deps: &crate::job_runner::ProcessRuntimeDeps,
        job_id: &str,
        journal: Option<&str>,
    ) {
        let mut job = JobSnapshot::new(job_id.to_string(), CreateJobInput::default(), vec![]);
        job.status = crate::models::domain::JobStatusKind::Running;
        job.stage = Some("translating".to_string());
        deps.db.save_job(&job).expect("save job");
        deps.db
            .acquire_pipeline_attempt(job_id, &format!("attempt:{job_id}"), "translate", 0)
            .expect("attempt");
        if let Some(journal) = journal {
            let dir = deps.config.output_root.join(job_id).join("translated");
            fs::create_dir_all(&dir).expect("translated dir");
            fs::write(dir.join("translation-request-journal.v1.jsonl"), journal)
                .expect("write journal");
        }
    }

    /// 回归：journal 里有已发出但没有终态的请求（结果不明），重启后不能自动续跑——
    /// 续跑的 Python 会把这些请求原样再发一遍，用户没机会拒绝重复计费。
    /// 应当落成 Failed（带 translation_request_ambiguous），由用户走
    /// retry-stage(translation) + accept_duplicate_risk 确认。
    #[test]
    fn startup_does_not_auto_resume_translation_with_ambiguous_request_journal() {
        use crate::models::domain::JobStatusKind::*;
        let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
        let db = deps.db.as_ref();
        seed_running_translation_job(&deps, "tr-ambiguous", Some(DISPATCH_T1));

        super::reconcile_stale_running_jobs(&deps.config, db).expect("startup recovery");

        let job = db.get_job("tr-ambiguous").unwrap();
        assert_eq!(job.status, Failed, "结果不明的在途请求不能被自动续跑");
        assert!(
            !db.list_resumable_pipeline_job_ids().unwrap().contains(&"tr-ambiguous".to_string()),
            "不能出现在启动自动续跑名单里"
        );
        assert!(!db.has_running_pipeline_attempt("tr-ambiguous").unwrap(), "attempt 要收尾");
        let failure = job.failure.as_ref().expect("failure info");
        assert_eq!(failure.failure_code.as_deref(), Some("translation_request_ambiguous"));
        assert_eq!(failure.resume_from.as_deref(), Some("translation"));
        assert!(job.finished_at.is_some());
        let _ = fs::remove_dir_all(deps.config.project_root.clone());
    }

    /// journal 干净（每个 dispatch 都有终态）或还没有 journal：照旧自动续跑。
    #[test]
    fn startup_still_auto_resumes_translation_with_clean_or_missing_journal() {
        use crate::models::domain::JobStatusKind::*;
        let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
        let db = deps.db.as_ref();
        seed_running_translation_job(&deps, "tr-clean", Some(&format!("{DISPATCH_T1}{TERMINAL_T1}")));
        seed_running_translation_job(&deps, "tr-nojournal", None);

        super::reconcile_stale_running_jobs(&deps.config, db).expect("startup recovery");

        for id in ["tr-clean", "tr-nojournal"] {
            assert_eq!(db.get_job(id).unwrap().status, Queued, "{id}");
            assert!(db.list_resumable_pipeline_job_ids().unwrap().contains(&id.to_string()), "{id}");
        }
        let _ = fs::remove_dir_all(deps.config.project_root.clone());
    }

    fn seed_document(db: &crate::db::Db) -> String {
        let upload = crate::models::domain::UploadRecord {
            upload_id: "up-1".into(),
            filename: "book.pdf".into(),
            stored_path: "uploads/up-1/book.pdf".into(),
            bytes: 1,
            page_count: 10,
            uploaded_at: crate::models::domain::now_iso(),
            developer_mode: false,
            content_hash: "d".repeat(64),
        };
        db.save_upload(&upload).unwrap();
        db.upsert_document_from_upload(&upload).unwrap();
        "d".repeat(64)
    }

    fn document_job(
        db: &crate::db::Db,
        id: &str,
        created_at: &str,
        status: crate::models::domain::JobStatusKind,
    ) {
        let mut job = JobSnapshot::new(id.to_string(), CreateJobInput::default(), vec![]);
        job.status = status;
        job.created_at = created_at.to_string();
        job.upload_id = Some("up-1".to_string());
        db.save_job(&job).expect("save job");
        db.link_job_to_document(id, "up-1").expect("link job");
    }

    /// 回归（状态审计 明细2 #8）：启动恢复把遗留 running 任务判成失败，也要像运行时终态那样
    /// 退回书卡（`maintain_document_after_terminal`），否则书卡一直停在这个任务上。
    #[test]
    fn startup_recovery_failing_a_job_hands_the_book_card_back_like_runtime() {
        use crate::models::domain::JobStatusKind::*;
        let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
        let db = deps.db.as_ref();
        let document_id = seed_document(db);
        document_job(db, "old", "2026-10-01T00:00:00", Succeeded);
        document_job(db, "stuck", "2026-10-02T00:00:00", Running);
        db.set_document_active_job(&document_id, "stuck", None).unwrap();

        super::reconcile_stale_running_jobs(&deps.config, db).expect("startup recovery");

        assert_eq!(db.get_job("stuck").unwrap().status, Failed);
        assert_eq!(
            db.get_document(&document_id).unwrap().active_job_id.as_deref(),
            Some("old"),
            "启动恢复把任务判成失败后没有维护书卡"
        );
    }

    /// 只有这一个任务时没有可退回的：书卡保留失败任务（能看到错误、能重试）。
    #[test]
    fn startup_recovery_keeps_the_failure_card_when_there_is_nothing_to_fall_back_to() {
        use crate::models::domain::JobStatusKind::*;
        let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
        let db = deps.db.as_ref();
        let document_id = seed_document(db);
        document_job(db, "only", "2026-10-02T00:00:00", Running);
        db.set_document_active_job(&document_id, "only", None).unwrap();

        super::reconcile_stale_running_jobs(&deps.config, db).expect("startup recovery");

        assert_eq!(db.get_job("only").unwrap().status, Failed);
        assert_eq!(
            db.get_document(&document_id).unwrap().active_job_id.as_deref(),
            Some("only")
        );
    }

    /// 自成进程组的 sleep，和真实 worker 一样（`configure_child_process`），组杀只会打到它。
    #[cfg(unix)]
    fn spawn_group_leader_sleep() -> std::process::Child {
        use std::os::unix::process::CommandExt;
        std::process::Command::new("sleep")
            .arg("60")
            .process_group(0)
            .spawn()
            .expect("spawn sleep")
    }

    #[cfg(unix)]
    fn seed_running_with_pid(db: &crate::db::Db, id: &str, pid: u32, updated_at: Option<&str>) {
        let mut job = JobSnapshot::new(id.to_string(), CreateJobInput::default(), vec![]);
        job.status = crate::models::domain::JobStatusKind::Running;
        job.stage = Some("translating".to_string());
        job.pid = Some(pid);
        if let Some(updated_at) = updated_at {
            job.updated_at = updated_at.to_string();
        }
        db.save_job(&job).expect("save job");
    }

    #[cfg(unix)]
    fn still_running(child: &mut std::process::Child) -> bool {
        // 给 SIGTERM 一点时间生效，免得「还没来得及死」被当成「没杀」。
        std::thread::sleep(std::time::Duration::from_millis(200));
        child.try_wait().expect("poll child").is_none()
    }

    /// 回归（状态审计 1-#9 / 6-#3）：库里记的 pid 已经被别的进程复用（身份对不上），启动对账不能
    /// 把它整组杀掉，只清 pid、按 worker 已不在处理。
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    #[test]
    fn startup_recovery_does_not_kill_a_process_that_reused_the_recorded_pid() {
        use crate::models::domain::JobStatusKind::*;
        let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
        let db = deps.db.as_ref();
        let mut stranger = spawn_group_leader_sleep();
        let pid = stranger.id();
        seed_running_with_pid(db, "reused", pid, None);
        // 当初那个 worker 的身份：同一个 pid、另一个启动时间。
        db.record_worker_identity("reused", Some(&format!("{pid}@darwin:1.000000")))
            .unwrap();

        super::reconcile_stale_running_jobs(&deps.config, db).expect("startup recovery");

        assert!(still_running(&mut stranger), "pid 被复用的别的进程被启动对账杀掉了");
        let job = db.get_job("reused").unwrap();
        assert_eq!(job.status, Failed);
        assert_eq!(job.pid, None);
        assert!(
            job.error.as_deref().is_some_and(|detail| detail.contains("复用")),
            "{:?}",
            job.error
        );
        let _ = stranger.kill();
        let _ = stranger.wait();
        let _ = fs::remove_dir_all(deps.config.project_root.clone());
    }

    /// 升级前写的老行没有身份信息：进程启动得比任务行最后一次写入还晚得多（重启机器、长时间
    /// 宕机后 pid 被复用的典型情形），不能是那一行记的 worker，不杀。
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    #[test]
    fn startup_recovery_spares_a_legacy_pid_that_started_after_the_row_was_last_written() {
        let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
        let db = deps.db.as_ref();
        let mut stranger = spawn_group_leader_sleep();
        seed_running_with_pid(db, "legacy", stranger.id(), Some("2020-01-01T00:00:00Z"));

        super::reconcile_stale_running_jobs(&deps.config, db).expect("startup recovery");

        assert!(still_running(&mut stranger), "老行的 pid 晚于任务行写入才起来，仍被杀了");
        assert_eq!(db.get_job("legacy").unwrap().pid, None);
        let _ = stranger.kill();
        let _ = stranger.wait();
        let _ = fs::remove_dir_all(deps.config.project_root.clone());
    }

    /// 身份对得上的孤儿 worker 照旧要杀：哪怕任务行很久没写过（worker 跑了很久）。
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    #[test]
    fn startup_recovery_still_kills_its_own_orphan_worker() {
        let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
        let db = deps.db.as_ref();
        let mut orphan = spawn_group_leader_sleep();
        let pid = orphan.id();
        seed_running_with_pid(db, "orphan", pid, Some("2020-01-01T00:00:00Z"));
        db.record_worker_identity("orphan", retainpdf_proc::process_identity(pid).as_deref())
            .unwrap();

        super::reconcile_stale_running_jobs(&deps.config, db).expect("startup recovery");

        let status = orphan.wait().expect("reap orphan");
        assert!(!status.success(), "孤儿 worker 应被信号终止");
        let job = db.get_job("orphan").unwrap();
        assert_eq!(job.pid, None);
        assert!(job.error.as_deref().is_some_and(|detail| detail.contains("孤儿")));
        let _ = fs::remove_dir_all(deps.config.project_root.clone());
    }
}
