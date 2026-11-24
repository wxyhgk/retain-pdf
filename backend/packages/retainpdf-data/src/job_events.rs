use std::path::Path;

use anyhow::Result;
use serde_json::Value;
use tracing::warn;

use crate::db::{Db, DerivedRunWrite, NewRunWrite};
use crate::models::api::JobEventRecord;
use crate::models::domain::{JobRuntimeState, JobSnapshot, JobStatusKind};
mod derivation;
mod jsonl;

use derivation::{
    custom_event, derive_events, normalize_user_stage, progress_unit_for_event,
    user_stage_for_event, PendingJobEvent,
};
use jsonl::append_event_jsonl;

tokio::task_local! {
    /// 当前 driver 所属的运行：`(任务编号, 运行代次)`。见 [`with_driver_run`]。
    static DRIVER_RUN: (String, u64);
}

/// 让 `fut`（一个任务的 driver 及其内联的全部阶段）里对**这个任务**的 CAS 写，一律以 driver
/// 自己那次运行的代次为准，而不是写入时手里那份快照带的代次。
///
/// 快照是随手 `get_job` 读来的：上一次运行遗留的 driver 在任务被原地重跑之后再读一次，读到的
/// 就是新一次运行的代次，CAS 会放行它。把代次钉在 driver 上，旧 driver 无论重读多少次都是旧代次。
/// 别的任务（OCR 子任务）的写不受影响。
pub async fn with_driver_run<F: std::future::Future>(
    job_id: String,
    generation: u64,
    fut: F,
) -> F::Output {
    DRIVER_RUN.scope((job_id, generation), fut).await
}

/// 当前 driver 钉住的代次（只在 `job_id` 就是 driver 所属任务时有值）。
pub fn driver_run_generation(job_id: &str) -> Option<u64> {
    DRIVER_RUN
        .try_with(|(pinned_job, generation)| (pinned_job == job_id).then_some(*generation))
        .ok()
        .flatten()
}

/// 当前 driver 的钉住信息，给 `tokio::spawn` 出去的子任务带过去（task-local 不跨 spawn）。
pub fn current_driver_run() -> Option<(String, u64)> {
    DRIVER_RUN.try_with(|run| run.clone()).ok()
}

/// 在 `run`（来自 [`current_driver_run`]）下执行 `fut`；`run` 为空就原样执行。
pub async fn with_optional_driver_run<F: std::future::Future>(
    run: Option<(String, u64)>,
    fut: F,
) -> F::Output {
    match run {
        Some((job_id, generation)) => with_driver_run(job_id, generation, fut).await,
        None => fut.await,
    }
}

fn pinned_for_write(job: &JobSnapshot) -> JobSnapshot {
    let mut current = job.clone();
    current.sync_runtime_state();
    if let Some(generation) = driver_run_generation(&current.job_id) {
        current.run_generation = generation;
    }
    current
}

/// 开始一次新的运行：整行落库并把 `run_generation` 加一（见 `Db::save_job_as_new_run`），
/// 返回的快照带着新代次。事件的派生同 [`persist_job_with_resources`]。
pub fn persist_job_as_new_run_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
) -> Result<JobSnapshot> {
    let previous = db.get_job(&job.job_id).ok();
    let mut current = job.clone();
    current.sync_runtime_state();
    current.run_generation = db.save_job_as_new_run(&current)?;
    emit_job_events_best_effort(db, data_root, output_root, previous.as_ref(), &current);
    Ok(current)
}

/// 同 [`persist_job_as_new_run_with_resources`]，但这是从 `source_job_id` 派生的新任务（续跑、重试阶段）：
/// 源任务已经有排队中 / 运行中的派生任务时不写（见 `Db::save_derived_job_as_new_run`），
/// 返回 `Ok(Err(那个任务的编号))`，不派生事件。
pub fn persist_derived_job_as_new_run_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    source_job_id: &str,
) -> Result<std::result::Result<JobSnapshot, String>> {
    let previous = db.get_job(&job.job_id).ok();
    let mut current = job.clone();
    current.sync_runtime_state();
    match db.save_derived_job_as_new_run(&current, source_job_id)? {
        DerivedRunWrite::Started(generation) => {
            current.run_generation = generation;
            emit_job_events_best_effort(db, data_root, output_root, previous.as_ref(), &current);
            Ok(Ok(current))
        }
        DerivedRunWrite::SourceBusy { active_job_id } => Ok(Err(active_job_id)),
    }
}

/// 同 [`persist_job_as_new_run_with_resources`]，但只在库里还是读到时的状态和代次时才写
/// （见 `Db::cas_save_job_as_new_run`）。写进去了返回带新代次的快照，没写进去原样返回库的回答，
/// 不派生事件。
pub fn cas_persist_job_as_new_run_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    expected_status: &JobStatusKind,
    expected_generation: u64,
) -> Result<std::result::Result<JobSnapshot, NewRunWrite>> {
    let previous = db.get_job(&job.job_id).ok();
    let mut current = job.clone();
    current.sync_runtime_state();
    match db.cas_save_job_as_new_run(&current, expected_status, expected_generation)? {
        NewRunWrite::Started(generation) => {
            current.run_generation = generation;
            emit_job_events_best_effort(db, data_root, output_root, previous.as_ref(), &current);
            Ok(Ok(current))
        }
        refused => Ok(Err(refused)),
    }
}

pub fn persist_job_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
) -> Result<()> {
    let previous = db.get_job(&job.job_id).ok();
    let mut current = job.clone();
    current.sync_runtime_state();
    db.save_job(&current)?;
    emit_job_events_best_effort(db, data_root, output_root, previous.as_ref(), &current);
    Ok(())
}

pub fn cas_persist_job_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    expected_statuses: &[&str],
) -> Result<bool> {
    let previous = db.get_job(&job.job_id).ok();
    let current = pinned_for_write(job);
    let updated = db.cas_save_job(&current, expected_statuses)?;
    if updated {
        emit_job_events_best_effort(db, data_root, output_root, previous.as_ref(), &current);
    }
    Ok(updated)
}

/// 同 [`cas_persist_job_with_resources`] 的 CAS 写，但**不派生事件**。
///
/// 只给「顺带同步一下别的任务的行」这种镜像写用：那份进度已经由真正的来源
/// 自己发过事件了，再从这一行的 diff 派生一套，读者就会看到同一条消息两遍。
/// 典型例子是 OCR 子任务往父任务镜像阶段——子任务的事件本来就会被导入父任务
/// 的事件流。
///
/// 后续正常写入仍用 `previous`（即这里落下的行）做 diff，所以跳过的只是这一次
/// 镜像本身产生的变化，不会让下一次写多派生或少派生。
pub fn cas_persist_job_row_without_events(
    db: &Db,
    job: &JobSnapshot,
    expected_statuses: &[&str],
) -> Result<bool> {
    let current = pinned_for_write(job);
    db.cas_save_job(&current, expected_statuses)
}

pub fn persist_runtime_job_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobRuntimeState,
) -> Result<()> {
    let snapshot = job.snapshot();
    persist_job_with_resources(db, data_root, output_root, &snapshot)
}

pub fn record_custom_job_event_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    level: &str,
    event: &str,
    message: impl Into<String>,
    payload: Option<Value>,
) {
    let pending = custom_event(job, level, event, message, payload);
    if let Err(err) = append_pending_event(db, data_root, output_root, job, pending) {
        warn!("failed to append job event for {}: {}", job.job_id, err);
    }
}

pub fn record_custom_runtime_event_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    level: &str,
    event: &str,
    message: impl Into<String>,
    payload: Option<Value>,
) {
    record_custom_job_event_with_resources(
        db,
        data_root,
        output_root,
        job,
        level,
        event,
        message,
        payload,
    );
}

fn emit_job_events_best_effort(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    previous: Option<&JobSnapshot>,
    current: &JobSnapshot,
) {
    for pending in derive_events(previous, current) {
        if let Err(err) = append_pending_event(db, data_root, output_root, current, pending) {
            warn!("failed to append job event for {}: {}", current.job_id, err);
        }
    }
}

fn append_pending_event(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    pending: PendingJobEvent,
) -> Result<JobEventRecord> {
    let event = db.append_event(
        &job.job_id,
        &pending.level,
        pending.stage.clone(),
        pending.stage_detail.clone(),
        pending.provider.clone(),
        pending.provider_stage.clone(),
        &pending.event,
        Some(pending.event.clone()),
        &pending.message,
        pending.progress_current,
        pending.progress_total,
        pending.payload.clone(),
        pending.retry_count,
        pending.elapsed_ms,
    )?;
    let event = JobEventRecord {
        user_stage: pending
            .user_stage
            .clone()
            .map(normalize_user_stage)
            .or_else(|| user_stage_for_event(event.stage.as_deref())),
        substage: pending
            .substage
            .clone()
            .or_else(|| event.provider_stage.clone()),
        progress_unit: pending
            .progress_unit
            .clone()
            .or_else(|| progress_unit_for_event(event.stage.as_deref(), &event.event)),
        ..event
    };
    append_event_jsonl(data_root, output_root, job, &event)?;
    Ok(event)
}
