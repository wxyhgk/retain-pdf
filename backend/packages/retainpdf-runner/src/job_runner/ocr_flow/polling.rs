use std::time::Instant;

use anyhow::{anyhow, Result};
use tokio::time::{sleep, Duration};

use super::super::cancel_registry::should_stop_ocr_child;
use super::super::ProcessRuntimeDeps;

/// 轮询服务商期间要不要停。以前只看子任务自己的 id——父任务被取消时一直轮询到底。
pub(super) async fn should_stop_polling(
    deps: &ProcessRuntimeDeps,
    job_id: &str,
    parent_job_id: Option<&str>,
) -> bool {
    let parent_ids: Vec<String> = parent_job_id.iter().map(|id| id.to_string()).collect();
    should_stop_ocr_child(deps.canceled_jobs.as_ref(), deps.db.as_ref(), job_id, &parent_ids).await
}

pub(super) async fn wait_next_poll_or_timeout<M>(
    started: Instant,
    timeout_secs: u64,
    poll_interval_secs: u64,
    timeout_message: M,
) -> Result<()>
where
    M: FnOnce() -> String,
{
    wait_next_poll_or_timeout_for(
        started,
        timeout_secs,
        Duration::from_secs(poll_interval_secs),
        timeout_message,
    )
    .await
}

pub(super) async fn wait_next_poll_or_timeout_for<M>(
    started: Instant,
    timeout_secs: u64,
    poll_interval: Duration,
    timeout_message: M,
) -> Result<()>
where
    M: FnOnce() -> String,
{
    if started.elapsed().as_secs() > timeout_secs {
        return Err(anyhow!(timeout_message()));
    }
    sleep(poll_interval).await;
    Ok(())
}

/// 快解析完时查得勤一点：已提取页数到总页数的九成以后每秒查一次，其余照配置（默认 5 秒）。
///
/// 2026-10-30 Jensen 第 12 章（41 页）：:00 看到 40/41，:06 才看到 done，按 5 秒一查平均白等 2.5 秒。
/// 只在最后几页加密，多出来的查询只有几次。
pub(super) fn near_done_poll_interval(
    configured_secs: u64,
    extracted_pages: Option<i64>,
    total_pages: Option<i64>,
) -> Duration {
    let configured = Duration::from_secs(configured_secs.max(1));
    let near_done = matches!(
        (extracted_pages, total_pages),
        (Some(done), Some(total)) if total > 0 && done * 10 >= total * 9
    );
    if near_done {
        configured.min(NEAR_DONE_POLL_INTERVAL)
    } else {
        configured
    }
}

const NEAR_DONE_POLL_INTERVAL: Duration = Duration::from_secs(1);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timeout_detects_expired_window() {
        let started = Instant::now() - Duration::from_secs(3);
        let result = futures_like_block_on(wait_next_poll_or_timeout(started, 1, 0, || {
            "timeout".to_string()
        }));
        assert!(result.is_err());
    }

    #[test]
    fn polls_every_second_once_nine_tenths_of_the_pages_are_extracted() {
        assert_eq!(near_done_poll_interval(5, Some(40), Some(41)), Duration::from_secs(1));
        assert_eq!(near_done_poll_interval(5, Some(37), Some(41)), Duration::from_secs(1));
        assert_eq!(near_done_poll_interval(5, Some(36), Some(41)), Duration::from_secs(5));
        assert_eq!(near_done_poll_interval(5, None, Some(41)), Duration::from_secs(5));
        assert_eq!(near_done_poll_interval(5, Some(3), Some(0)), Duration::from_secs(5));
        // 配置本来就更勤的不放慢
        assert_eq!(near_done_poll_interval(1, Some(1), Some(41)), Duration::from_secs(1));
    }

    #[test]
    fn timeout_allows_fresh_window() {
        let started = Instant::now();
        let result = futures_like_block_on(wait_next_poll_or_timeout(started, 1, 0, || {
            "timeout".to_string()
        }));
        assert!(result.is_ok());
    }

    fn futures_like_block_on<F: std::future::Future>(future: F) -> F::Output {
        tokio::runtime::Runtime::new()
            .expect("runtime")
            .block_on(future)
    }
}
