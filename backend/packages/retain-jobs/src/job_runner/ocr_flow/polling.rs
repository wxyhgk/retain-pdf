use std::collections::HashSet;
use std::sync::Arc;
use std::time::Instant;

use anyhow::{anyhow, Result};
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};

use super::super::cancel_registry::is_cancel_requested_with_registry;

pub(super) async fn should_stop_polling(
    canceled_jobs: &Arc<RwLock<HashSet<String>>>,
    job_id: &str,
) -> bool {
    is_cancel_requested_with_registry(canceled_jobs.as_ref(), job_id).await
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
    if started.elapsed().as_secs() > timeout_secs {
        return Err(anyhow!(timeout_message()));
    }
    sleep(Duration::from_secs(poll_interval_secs)).await;
    Ok(())
}

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
