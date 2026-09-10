use super::mineru_retry::{mineru_error_chain_text, should_retry_mineru_poll_error};

pub(super) fn should_retry_mineru_bundle_ready_error(err: &anyhow::Error) -> bool {
    let text = mineru_error_chain_text(err);
    should_retry_mineru_poll_error(err) || text.contains("404") || text.contains("not found")
}

pub(super) fn bundle_ready_timeout_secs(poll_timeout_secs: i64, timeout_cap_secs: u64) -> u64 {
    std::cmp::min(std::cmp::max(poll_timeout_secs, 1) as u64, timeout_cap_secs)
}

pub(super) fn should_fallback_to_direct_download(
    err: &anyhow::Error,
    attempt: usize,
    elapsed_secs: u64,
    timeout_secs: u64,
    ready_retry_limit: usize,
) -> bool {
    should_retry_mineru_bundle_ready_error(err)
        && (elapsed_secs >= timeout_secs || attempt >= ready_retry_limit)
}

#[cfg(test)]
mod tests {
    use super::{
        bundle_ready_timeout_secs, should_fallback_to_direct_download,
        should_retry_mineru_bundle_ready_error,
    };

    #[test]
    fn should_retry_bundle_ready_error_for_not_found_probe() {
        let err = anyhow::anyhow!("404 Not Found")
            .context("MinerU bundle readiness probe returned error status");
        assert!(should_retry_mineru_bundle_ready_error(&err));
    }

    #[test]
    fn should_retry_bundle_ready_error_for_nested_connection_reset() {
        let err = anyhow::anyhow!("Connection reset by peer (os error 104)")
            .context("client error (Connect)")
            .context("MinerU bundle readiness probe failed");
        assert!(should_retry_mineru_bundle_ready_error(&err));
    }

    #[test]
    fn bundle_ready_timeout_uses_wider_cap() {
        assert_eq!(bundle_ready_timeout_secs(0, 120), 1);
        assert_eq!(bundle_ready_timeout_secs(45, 120), 45);
        assert_eq!(bundle_ready_timeout_secs(999, 120), 120);
    }

    #[test]
    fn retryable_probe_error_can_fallback_to_direct_download_after_attempt_budget() {
        let err = anyhow::anyhow!("Connection reset by peer (os error 104)")
            .context("client error (Connect)")
            .context("MinerU bundle readiness probe failed");
        assert!(should_fallback_to_direct_download(&err, 8, 12, 60, 8,));
    }

    #[test]
    fn non_retryable_probe_error_never_falls_back() {
        let err = anyhow::anyhow!("401 unauthorized");
        assert!(!should_fallback_to_direct_download(&err, 99, 120, 60, 8));
    }
}
