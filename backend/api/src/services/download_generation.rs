//! Bounded, in-flight-only generation of expensive download artifacts.
//! Request cancellation never cancels an admitted blocking writer.
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use tokio::sync::{watch, Semaphore};

use super::jobs::FileDownload;
use crate::error::AppError;

type Outcome = Result<FileDownload, AppError>;
type Completion = watch::Sender<Option<Outcome>>;

pub struct DownloadGeneration {
    slots: Arc<Semaphore>,
    in_flight: Mutex<HashMap<String, Completion>>,
    max_keys: usize,
}

impl Default for DownloadGeneration {
    fn default() -> Self {
        Self::with_limits(2, 128)
    }
}

impl DownloadGeneration {
    fn with_limits(slots: usize, max_keys: usize) -> Self {
        Self {
            slots: Arc::new(Semaphore::new(slots.max(1))),
            in_flight: Mutex::new(HashMap::new()),
            max_keys: max_keys.max(1),
        }
    }

    pub async fn run(
        self: &Arc<Self>,
        key: String,
        work: impl FnOnce() -> Outcome + Send + 'static,
    ) -> Outcome {
        // No await between admission and spawning the independent supervisor:
        // dropping the requesting future cannot leave an ownerless map entry.
        let mut completion = {
            let mut in_flight = self.in_flight.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(existing) = in_flight.get(&key) {
                existing.subscribe()
            } else {
                // Includes running work. Existing keys can always join even
                // when distinct-key admission is at capacity.
                if in_flight.len() >= self.max_keys {
                    return Err(AppError::too_many_requests(
                        "download generation queue is full",
                    ));
                }
                let (sender, receiver) = watch::channel(None);
                in_flight.insert(key.clone(), sender.clone());
                let owner = Arc::clone(self);
                tokio::spawn(async move {
                    let outcome = match owner.slots.clone().acquire_owned().await {
                        Ok(permit) => {
                            match tokio::task::spawn_blocking(move || {
                                // The blocking writer, not a cancellable HTTP
                                // future, owns its capacity until it finishes.
                                let _permit = permit;
                                work()
                            })
                            .await
                            {
                                Ok(result) => result,
                                Err(_) => {
                                    Err(AppError::internal("download generation task failed"))
                                }
                            }
                        }
                        Err(_) => Err(AppError::service_unavailable(
                            "download generation unavailable",
                        )),
                    };
                    let mut in_flight = owner.in_flight.lock().unwrap_or_else(|e| e.into_inner());
                    // Publish even if every original caller disconnected. The
                    // channel can publish without receivers; no result is
                    // retained as a historical artifact cache.
                    sender.send_replace(Some(outcome));
                    in_flight.remove(&key);
                });
                receiver
            }
        };
        loop {
            if let Some(result) = completion.borrow_and_update().clone() {
                return result;
            }
            if completion.changed().await.is_err() {
                return Err(AppError::internal("download generation task unavailable"));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        sync::atomic::{AtomicUsize, Ordering},
        time::Duration,
    };
    use tokio::sync::mpsc;

    fn artifact() -> Outcome {
        Ok(FileDownload::new(
            "offline.pdf".into(),
            "application/pdf",
            None,
        ))
    }

    async fn wait_for_joiners(generation: &DownloadGeneration, key: &str, count: usize) {
        tokio::time::timeout(Duration::from_secs(2), async {
            loop {
                let receivers = generation
                    .in_flight
                    .lock()
                    .unwrap()
                    .get(key)
                    .map(|receiver| receiver.receiver_count())
                    .unwrap_or(0);
                if receivers >= count {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("callers joined generation");
    }

    #[tokio::test(flavor = "current_thread")]
    async fn blocking_generation_does_not_block_runtime_timers() {
        let generation = Arc::new(DownloadGeneration::default());
        let (started_tx, mut started_rx) = mpsc::unbounded_channel();
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        let worker = generation.clone();
        let task = tokio::spawn(async move {
            worker
                .run("job:pdf".into(), move || {
                    started_tx.send(()).unwrap();
                    // Bounded fallback prevents a broken implementation hanging
                    // the entire current-thread test indefinitely.
                    release_rx
                        .recv_timeout(Duration::from_secs(2))
                        .expect("timer released writer");
                    artifact()
                })
                .await
        });
        started_rx.recv().await.unwrap();
        tokio::time::sleep(Duration::from_millis(10)).await;
        release_tx
            .send(())
            .expect("writer remains blocked while timer runs");
        assert!(task.await.unwrap().is_ok());
    }

    #[tokio::test]
    async fn same_key_shares_one_success_and_retains_no_completed_cache() {
        let generation = Arc::new(DownloadGeneration::default());
        let calls = Arc::new(AtomicUsize::new(0));
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        let count = calls.clone();
        let owner = generation.clone();
        let first = tokio::spawn(async move {
            owner
                .run("job:pdf".into(), move || {
                    count.fetch_add(1, Ordering::SeqCst);
                    release_rx.recv_timeout(Duration::from_secs(2)).unwrap();
                    artifact()
                })
                .await
        });
        wait_for_joiners(&generation, "job:pdf", 1).await;
        let owner = generation.clone();
        let count = calls.clone();
        let second = tokio::spawn(async move {
            owner
                .run("job:pdf".into(), move || {
                    count.fetch_add(1, Ordering::SeqCst);
                    artifact()
                })
                .await
        });
        wait_for_joiners(&generation, "job:pdf", 2).await;
        release_tx.send(()).unwrap();
        assert_eq!(
            first.await.unwrap().unwrap().path,
            second.await.unwrap().unwrap().path
        );
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert!(generation.in_flight.lock().unwrap().is_empty());
        generation
            .run("job:pdf".into(), || artifact())
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn different_keys_respect_global_capacity() {
        let generation = Arc::new(DownloadGeneration::default());
        let (started_tx, mut started_rx) = mpsc::unbounded_channel();
        let mut releases = Vec::new();
        let mut tasks = Vec::new();
        for index in 0..3 {
            let (release_tx, release_rx) = std::sync::mpsc::channel();
            releases.push(release_tx);
            let started = started_tx.clone();
            let owner = generation.clone();
            tasks.push(tokio::spawn(async move {
                owner
                    .run(format!("job:{index}"), move || {
                        started.send(index).unwrap();
                        release_rx.recv_timeout(Duration::from_secs(2)).unwrap();
                        artifact()
                    })
                    .await
            }));
        }
        let first = started_rx.recv().await.unwrap();
        let _second = started_rx.recv().await.unwrap();
        assert!(
            tokio::time::timeout(Duration::from_millis(20), started_rx.recv())
                .await
                .is_err()
        );
        releases[first].send(()).unwrap();
        started_rx.recv().await.unwrap();
        for release in releases {
            let _ = release.send(());
        }
        for task in tasks {
            assert!(task.await.unwrap().is_ok());
        }
    }

    #[tokio::test]
    async fn dropped_caller_keeps_writer_permit_and_key_until_completion() {
        let generation = Arc::new(DownloadGeneration::with_limits(1, 128));
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        let (started_tx, mut started_rx) = mpsc::unbounded_channel();
        let owner = generation.clone();
        let first = tokio::spawn(async move {
            owner
                .run("job:pdf".into(), move || {
                    started_tx.send(()).unwrap();
                    release_rx.recv_timeout(Duration::from_secs(2)).unwrap();
                    artifact()
                })
                .await
        });
        started_rx.recv().await.unwrap();
        first.abort();
        assert!(first.await.unwrap_err().is_cancelled());
        assert_eq!(generation.slots.available_permits(), 0);
        let owner = generation.clone();
        let joined = tokio::spawn(async move {
            owner
                .run("job:pdf".into(), || panic!("duplicate writer"))
                .await
        });
        wait_for_joiners(&generation, "job:pdf", 1).await;
        release_tx.send(()).unwrap();
        assert!(joined.await.unwrap().is_ok());
        assert_eq!(generation.slots.available_permits(), 1);
        assert!(generation.in_flight.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn errors_and_panics_are_shared_then_retryable() {
        for panic_work in [false, true] {
            let generation = Arc::new(DownloadGeneration::with_limits(1, 128));
            let (release_tx, release_rx) = std::sync::mpsc::channel();
            let owner = generation.clone();
            let first = tokio::spawn(async move {
                owner
                    .run("job:pdf".into(), move || {
                        release_rx.recv_timeout(Duration::from_secs(2)).unwrap();
                        if panic_work {
                            panic!("synthetic private panic detail");
                        }
                        Err(AppError::conflict("generation failed"))
                    })
                    .await
            });
            wait_for_joiners(&generation, "job:pdf", 1).await;
            let owner = generation.clone();
            let joined = tokio::spawn(async move { owner.run("job:pdf".into(), artifact).await });
            wait_for_joiners(&generation, "job:pdf", 2).await;
            release_tx.send(()).unwrap();
            let first_error = first.await.unwrap().unwrap_err();
            let joined_error = joined.await.unwrap().unwrap_err();
            assert_eq!(first_error.to_string(), joined_error.to_string());
            assert!(!first_error.to_string().contains("synthetic private"));
            assert_eq!(generation.slots.available_permits(), 1);
            assert!(generation.in_flight.lock().unwrap().is_empty());
            assert!(generation.run("job:pdf".into(), artifact).await.is_ok());
        }
    }

    #[tokio::test]
    async fn distinct_key_limit_rejects_new_work_but_allows_joining() {
        let generation = Arc::new(DownloadGeneration::with_limits(1, 1));
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        let owner = generation.clone();
        let first = tokio::spawn(async move {
            owner
                .run("job:pdf".into(), move || {
                    release_rx.recv_timeout(Duration::from_secs(2)).unwrap();
                    artifact()
                })
                .await
        });
        wait_for_joiners(&generation, "job:pdf", 1).await;
        assert!(matches!(
            generation.run("other:pdf".into(), artifact).await,
            Err(AppError::TooManyRequests(_))
        ));
        let owner = generation.clone();
        let joined = tokio::spawn(async move {
            owner
                .run("job:pdf".into(), || panic!("duplicate writer"))
                .await
        });
        wait_for_joiners(&generation, "job:pdf", 2).await;
        release_tx.send(()).unwrap();
        assert!(first.await.unwrap().is_ok());
        assert!(joined.await.unwrap().is_ok());
        assert!(generation.run("other:pdf".into(), artifact).await.is_ok());
    }
}
