//! 阅读页 HTML 页的旧书补排（2026-11-28 用户定：「打开时自动补 + 批量命令」）。
//!
//! 版面（`reader/layout`）以前是临时文件，2026-11-28 以前排的书都没留下（`not_kept`）。补一本就是拿现在的引擎
//! 原地重新渲染一次，不调模型、不花钱。清单接口发现没有、又能补时，把这本登记进来（读接口只登记、不发起任务）；
//! 这里的后台循环一次只补一本：上一本还在排队或在跑就等它。每本在这个进程里只自动试一次，补完还是没有
//! （比如回退了 Typst）就留给 `generate` 按钮，不来回重排。只补本来就是引擎排的书（`not_kept`），
//! Typst 排的书不自动换引擎。

use std::collections::{HashSet, VecDeque};
use std::time::Duration;

use serde_json::Value;

use super::jobs::build_jobs_facade_from_state;
use super::state::AppState;
use crate::models::api::RetryStageRequest;
use crate::models::domain::JobStatusKind;

/// 轮询间隔：看上一本跑完没有、有没有新登记的。
const TICK: Duration = Duration::from_secs(3);

#[derive(Debug, Default)]
pub(crate) struct ReaderLayoutBackfill {
    /// 正在补的那本（任务编号）；它跑完之前不开下一本。
    current: Option<String>,
    /// 这个进程里登记过的（排着的、补过的），不再登记。
    seen: HashSet<String>,
    /// 等着补的：(任务编号, retry-stage 的请求体)。
    queue: VecDeque<(String, Value)>,
}

/// 登记一本要补的书。第一次登记返回 true；已经排着、补过的返回 false。
pub(crate) fn request(state: &AppState, job_id: &str, body: Value) -> bool {
    let Ok(mut backfill) = state.reader_layout_backfill.lock() else {
        return false;
    };
    if !backfill.seen.insert(job_id.to_string()) {
        return false;
    }
    backfill.queue.push_back((job_id.to_string(), body));
    true
}

/// 这本是不是排在补排队列里（还没开始跑）。
pub(crate) fn is_queued(state: &AppState, job_id: &str) -> bool {
    state
        .reader_layout_backfill
        .lock()
        .map(|backfill| backfill.queue.iter().any(|(queued, _)| queued == job_id))
        .unwrap_or(false)
}

fn job_is_active(state: &AppState, job_id: &str) -> bool {
    state
        .db
        .get_job(job_id)
        .map(|job| matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running))
        .unwrap_or(false)
}

/// 走一步：上一本还在跑就什么都不做；否则开队列里的下一本（开不成的跳过，接着开下一本）。返回开了的那本。
pub(crate) fn run_once(state: &AppState) -> Option<String> {
    let current = state.reader_layout_backfill.lock().ok()?.current.clone();
    if current.as_deref().is_some_and(|job_id| job_is_active(state, job_id)) {
        return None;
    }
    loop {
        let (job_id, body) = {
            let mut backfill = state.reader_layout_backfill.lock().ok()?;
            backfill.current = None;
            backfill.queue.pop_front()?
        };
        let request = match serde_json::from_value::<RetryStageRequest>(body) {
            Ok(request) => request,
            Err(error) => {
                tracing::warn!("reader layout backfill: bad request for {job_id}: {error}");
                continue;
            }
        };
        // 链接用不上（没人看这次提交的返回），给个本机地址
        match build_jobs_facade_from_state(state).retry_stage_submission("http://127.0.0.1", &job_id, request) {
            Ok(_) => {
                tracing::info!("reader layout backfill: re-rendering {job_id} in place");
                if let Ok(mut backfill) = state.reader_layout_backfill.lock() {
                    backfill.current = Some(job_id.clone());
                }
                return Some(job_id);
            }
            Err(error) => {
                tracing::warn!("reader layout backfill: {job_id} not started: {error:?}");
            }
        }
    }
}

/// 后台循环，只在真实服务里开（单测直接调 [`run_once`]）。
pub(crate) fn spawn(state: AppState) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(TICK);
        loop {
            interval.tick().await;
            let has_work = state
                .reader_layout_backfill
                .lock()
                .map(|backfill| backfill.current.is_some() || !backfill.queue.is_empty())
                .unwrap_or(false);
            if !has_work {
                continue;
            }
            let state = state.clone();
            if let Err(error) = tokio::task::spawn_blocking(move || run_once(&state)).await {
                tracing::warn!("reader layout backfill step panicked: {error}");
            }
        }
    })
}
