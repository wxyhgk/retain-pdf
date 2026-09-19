use std::collections::HashSet;

use tokio::sync::RwLock;

pub async fn request_cancel_with_registry(canceled_jobs: &RwLock<HashSet<String>>, job_id: &str) {
    let mut canceled_jobs = canceled_jobs.write().await;
    canceled_jobs.insert(job_id.to_string());
}

pub async fn clear_cancel_request_with_registry(
    canceled_jobs: &RwLock<HashSet<String>>,
    job_id: &str,
) {
    let mut canceled_jobs = canceled_jobs.write().await;
    canceled_jobs.remove(job_id);
}

pub(super) async fn is_cancel_requested_with_registry(
    canceled_jobs: &RwLock<HashSet<String>>,
    job_id: &str,
) -> bool {
    let canceled_jobs = canceled_jobs.read().await;
    canceled_jobs.contains(job_id)
}

pub(super) async fn is_cancel_requested_any(
    canceled_jobs: &RwLock<HashSet<String>>,
    job_id: &str,
    extra_cancel_job_ids: &[String],
) -> bool {
    if is_cancel_requested_with_registry(canceled_jobs, job_id).await {
        return true;
    }
    let canceled_jobs = canceled_jobs.read().await;
    extra_cancel_job_ids
        .iter()
        .any(|value| canceled_jobs.contains(value))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn registry(ids: &[&str]) -> RwLock<HashSet<String>> {
        RwLock::new(ids.iter().map(|v| v.to_string()).collect())
    }

    /// 取消 book 父任务时，`-ocr` 子任务必须也停。
    ///
    /// 取消只登记被点的那个 id。子任务自查的是**自己**的 id，所以在
    /// `extra_cancel_job_ids` 接上父 id 之前，它永远看不到信号——OCR 会一路
    /// 跑到成功，产物随即被丢弃。job 20260919094352-fa6af6 就是这么来的。
    #[tokio::test]
    async fn child_stops_when_only_the_parent_was_canceled() {
        let reg = registry(&["job-parent"]);

        // 改动前的行为：只看自己的 id —— 看不见父任务的取消。
        assert!(
            !is_cancel_requested_with_registry(&reg, "job-parent-ocr").await,
            "子任务自己的 id 本来就不在注册表里，这是前提"
        );

        // 改动后：带上父 id 就能看见。
        let parent = vec!["job-parent".to_string()];
        assert!(
            is_cancel_requested_any(&reg, "job-parent-ocr", &parent).await,
            "父任务被取消时，子任务必须停下——否则 OCR 白跑、产物白丢"
        );
    }

    /// 反向保证：父任务没被取消时，子任务不能被误停。
    #[tokio::test]
    async fn child_keeps_running_when_nobody_was_canceled() {
        let reg = registry(&["some-other-job"]);
        let parent = vec!["job-parent".to_string()];
        assert!(!is_cancel_requested_any(&reg, "job-parent-ocr", &parent).await);
    }
}
