use super::capacity::UploadCapacity;
use super::pdf::run_repair_command;
use super::*;
use crate::db::Db;
use crate::test_support::pdf::build_test_pdf_bytes;
use retain_core::config::UploadProcessingConfig;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use std::time::{Duration, Instant};

fn make_service(
    db: Db,
    uploads_dir: PathBuf,
    python_bin: &str,
    processing: UploadProcessingConfig,
) -> UploadService {
    UploadService::new(
        Arc::new(db),
        UploadServiceConfig {
            uploads_dir,
            python_bin: python_bin.into(),
            upload_max_bytes: 0,
            upload_max_pages: 0,
            processing,
        },
    )
}

#[tokio::test]
async fn disconnected_store_caller_keeps_admission_until_worker_exits() {
    let root = std::env::temp_dir().join(format!("retain-upload-cancel-{}", fastrand::u64(..)));
    let uploads = root.join("uploads");
    let db = Db::new(root.join("db/jobs.db"), root.clone());
    let service = make_service(
        db,
        uploads.clone(),
        "/synthetic-missing-python",
        UploadProcessingConfig {
            parse_workers: 1,
            repair_workers: 1,
            queue_capacity: 1,
            queue_wait_ms: 5000,
            buffer_mib: 1,
        },
    );
    let capacity = service.capacity();
    let occupied = capacity.repair.clone().try_acquire_owned().unwrap();
    let caller = tokio::spawn(async move {
        service
            .store(UploadedPdfInput {
                filename: "broken.pdf".into(),
                bytes: b"broken".to_vec(),
                developer_mode: false,
            })
            .await
    });
    tokio::time::timeout(Duration::from_secs(3), async {
        while capacity.queued.available_permits() != 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    caller.abort();
    assert!(caller.await.unwrap_err().is_cancelled());
    assert_eq!(capacity.admitted.available_permits(), 2);
    assert_eq!(capacity.queued.available_permits(), 0);
    assert_eq!(std::fs::read_dir(&uploads).unwrap().count(), 1);
    drop(occupied);
    tokio::time::timeout(Duration::from_secs(3), async {
        while capacity.admitted.available_permits() != 3 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert_eq!(capacity.queued.available_permits(), 1);
    assert_eq!(capacity.repair.available_permits(), 1);
    assert_eq!(std::fs::read_dir(&uploads).unwrap().count(), 0);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn clones_share_capacity_but_new_services_are_isolated() {
    let root = std::env::temp_dir().join(format!("retain-upload-owner-{}", fastrand::u64(..)));
    let db = Db::new(root.join("db/jobs.db"), root.clone());
    let first = make_service(
        db.clone(),
        root.join("uploads"),
        "unused",
        UploadProcessingConfig::default(),
    );
    let second = make_service(
        db,
        root.join("uploads"),
        "unused",
        UploadProcessingConfig::default(),
    );
    assert!(Arc::ptr_eq(&first.capacity(), &first.clone().capacity()));
    assert!(!Arc::ptr_eq(&first.capacity(), &second.capacity()));
    if root.exists() {
        std::fs::remove_dir_all(root).unwrap();
    }
}

#[tokio::test]
async fn queue_is_bounded_times_out_and_recovers_capacity() {
    let capacity = Arc::new(UploadCapacity::new(UploadProcessingConfig {
        parse_workers: 1,
        repair_workers: 1,
        queue_capacity: 1,
        queue_wait_ms: 40,
        buffer_mib: 2,
    }));
    let running = capacity.parse.clone().try_acquire_owned().unwrap();
    let waiting = {
        let c = capacity.clone();
        tokio::spawn(async move { c.acquire(&c.parse).await })
    };
    tokio::time::timeout(Duration::from_secs(1), async {
        while capacity.queued.available_permits() != 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert!(matches!(
        capacity.acquire(&capacity.parse).await,
        Err(UploadError::Busy)
    ));
    assert!(waiting
        .await
        .unwrap()
        .unwrap_err()
        .to_string()
        .contains("timed out"));
    assert_eq!(capacity.queued.available_permits(), 1);
    drop(running);
    assert!(capacity.acquire(&capacity.parse).await.is_ok());
    let buffer = capacity.reserve_buffer(2 * 1024 * 1024).unwrap();
    assert!(matches!(capacity.reserve_buffer(1), Err(UploadError::Busy)));
    assert!(matches!(
        capacity.reserve_buffer(3 * 1024 * 1024),
        Err(UploadError::PayloadTooLarge(_))
    ));
    drop(buffer);
    assert_eq!(capacity.buffers.available_permits(), 2);
}

#[tokio::test]
async fn repair_waiters_do_not_block_parse_and_cancelled_waiters_release_queue() {
    let capacity = Arc::new(UploadCapacity::new(UploadProcessingConfig {
        parse_workers: 1,
        repair_workers: 1,
        queue_capacity: 1,
        queue_wait_ms: 1000,
        buffer_mib: 2,
    }));
    let repair = capacity.repair.clone().try_acquire_owned().unwrap();
    let waiter = {
        let c = capacity.clone();
        tokio::spawn(async move { c.acquire(&c.repair).await })
    };
    tokio::time::timeout(Duration::from_secs(1), async {
        while capacity.queued.available_permits() != 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert!(capacity.acquire(&capacity.parse).await.is_ok());
    waiter.abort();
    let _ = waiter.await;
    assert_eq!(capacity.queued.available_permits(), 1);
    let waiter = {
        let c = capacity.clone();
        tokio::spawn(async move { c.acquire(&c.repair).await })
    };
    drop(repair);
    assert!(waiter.await.unwrap().is_ok());
}

#[tokio::test]
async fn upload_waiting_for_repair_releases_parse_and_original_buffer() {
    let root = std::env::temp_dir().join(format!(
        "retain-upload-repair-isolation-{}",
        fastrand::u64(..)
    ));
    let uploads = root.join("uploads");
    let db = Db::new(root.join("db/jobs.db"), root.clone());
    let service = make_service(
        db,
        uploads.clone(),
        "/synthetic-missing-python",
        UploadProcessingConfig {
            parse_workers: 1,
            repair_workers: 1,
            queue_capacity: 1,
            queue_wait_ms: 5000,
            buffer_mib: 1,
        },
    );
    let capacity = service.capacity();
    let occupied = capacity.repair.clone().try_acquire_owned().unwrap();
    let bad = {
        let service = service.clone();
        tokio::spawn(async move {
            service
                .store(UploadedPdfInput {
                    filename: "broken.pdf".into(),
                    bytes: b"broken".to_vec(),
                    developer_mode: false,
                })
                .await
        })
    };
    tokio::time::timeout(Duration::from_secs(3), async {
        while capacity.queued.available_permits() != 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert_eq!(capacity.parse.available_permits(), 1);
    assert_eq!(capacity.buffers.available_permits(), 1);
    let good = service
        .store(UploadedPdfInput {
            filename: "good.pdf".into(),
            bytes: build_test_pdf_bytes(),
            developer_mode: false,
        })
        .await
        .unwrap();
    assert_eq!(good.page_count, 1);
    drop(occupied);
    assert!(matches!(
        bad.await.unwrap(),
        Err(UploadError::RepairUnavailable)
    ));
    assert_eq!(std::fs::read_dir(&uploads).unwrap().count(), 1);
    assert_eq!(capacity.admitted.available_permits(), 3);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn repair_timeout_and_failure_are_bounded_and_redacted() {
    let mut command = Command::new("python3");
    command.args([
        "-c",
        "import sys; print('synthetic-private-value', file=sys.stderr); sys.exit(1)",
    ]);
    let error = run_repair_command(&mut command, Duration::from_secs(5)).unwrap_err();
    assert!(matches!(error, UploadError::BadRequest(_)));
    assert!(!error.to_string().contains("synthetic-private-value"));
    let mut command = Command::new("python3");
    command.args(["-c", "import time; time.sleep(30)"]);
    let started = Instant::now();
    let error = run_repair_command(&mut command, Duration::from_millis(100)).unwrap_err();
    assert!(matches!(error, UploadError::RepairTimeout));
    assert!(started.elapsed() < Duration::from_secs(5));
}

mod benchmark;

#[tokio::test]
async fn concurrent_stores_share_buffer_budget_and_recover_after_publication() {
    let root = std::env::temp_dir().join(format!("retain-upload-shared-{}", fastrand::u64(..)));
    let uploads = root.join("uploads");
    let service = make_service(
        Db::new(root.join("db/jobs.db"), root.clone()),
        uploads.clone(),
        "unused-python",
        UploadProcessingConfig {
            parse_workers: 1,
            repair_workers: 1,
            queue_capacity: 1,
            queue_wait_ms: 5000,
            buffer_mib: 1,
        },
    );
    let capacity = service.capacity();
    let occupied = capacity.parse.clone().try_acquire_owned().unwrap();
    let first = {
        let service = service.clone();
        tokio::spawn(async move {
            service
                .store(UploadedPdfInput {
                    filename: "first.pdf".into(),
                    bytes: build_test_pdf_bytes(),
                    developer_mode: false,
                })
                .await
        })
    };
    tokio::time::timeout(Duration::from_secs(3), async {
        while capacity.queued.available_permits() != 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    let result = service
        .store(UploadedPdfInput {
            filename: "second.pdf".into(),
            bytes: build_test_pdf_bytes(),
            developer_mode: false,
        })
        .await;
    assert!(matches!(result, Err(UploadError::Busy)));
    assert!(!uploads.exists());
    drop(occupied);
    let first = first.await.unwrap().unwrap();
    assert_eq!(capacity.buffers.available_permits(), 1);
    assert_eq!(capacity.admitted.available_permits(), 3);
    let second = service
        .store(UploadedPdfInput {
            filename: "second.pdf".into(),
            bytes: build_test_pdf_bytes(),
            developer_mode: false,
        })
        .await
        .unwrap();
    assert_ne!(first.upload_id, second.upload_id);
    assert_eq!(first.content_hash, second.content_hash);
    assert_eq!(std::fs::read_dir(&uploads).unwrap().count(), 2);
    std::fs::remove_dir_all(root).unwrap();
}

#[tokio::test]
async fn cancelling_store_while_waiting_for_parse_releases_all_reservations() {
    let root =
        std::env::temp_dir().join(format!("retain-upload-parse-cancel-{}", fastrand::u64(..)));
    let uploads = root.join("uploads");
    let db = Db::new(root.join("db/jobs.db"), root.clone());
    let service = make_service(
        db,
        uploads.clone(),
        "unused-python",
        UploadProcessingConfig {
            parse_workers: 1,
            repair_workers: 1,
            queue_capacity: 1,
            queue_wait_ms: 5000,
            buffer_mib: 1,
        },
    );
    let capacity = service.capacity();
    let occupied = capacity.parse.clone().try_acquire_owned().unwrap();
    let caller = tokio::spawn(async move {
        service
            .store(UploadedPdfInput {
                filename: "valid.pdf".into(),
                bytes: build_test_pdf_bytes(),
                developer_mode: false,
            })
            .await
    });
    tokio::time::timeout(Duration::from_secs(3), async {
        while capacity.queued.available_permits() != 0 {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert_eq!(capacity.buffers.available_permits(), 0);
    assert_eq!(capacity.admitted.available_permits(), 2);
    caller.abort();
    assert!(caller.await.unwrap_err().is_cancelled());
    assert_eq!(capacity.queued.available_permits(), 1);
    assert_eq!(capacity.buffers.available_permits(), 1);
    assert_eq!(capacity.admitted.available_permits(), 3);
    assert!(!uploads.exists());
    drop(occupied);
    assert_eq!(capacity.parse.available_permits(), 1);
    if root.exists() {
        std::fs::remove_dir_all(root).unwrap();
    }
}

// This is an ownership-level check, not a real PDF parser cancellation test.
#[tokio::test(flavor = "current_thread")]
async fn cancelled_awaiter_does_not_release_a_blocking_closures_parse_permit() {
    let capacity = Arc::new(UploadCapacity::new(UploadProcessingConfig {
        parse_workers: 1,
        repair_workers: 1,
        queue_capacity: 0,
        ..UploadProcessingConfig::default()
    }));
    let permit = capacity.parse.clone().try_acquire_owned().unwrap();
    let (release, wait) = std::sync::mpsc::channel();
    let (started, ready) = tokio::sync::oneshot::channel();
    let caller = tokio::spawn(async move {
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            started.send(()).unwrap();
            wait.recv().unwrap();
        })
        .await
        .unwrap();
    });
    ready.await.unwrap();
    caller.abort();
    assert!(caller.await.unwrap_err().is_cancelled());
    assert_eq!(capacity.parse.available_permits(), 0);
    tokio::time::timeout(Duration::from_secs(1), tokio::task::yield_now())
        .await
        .unwrap();
    release.send(()).unwrap();
    let returned = tokio::time::timeout(
        Duration::from_secs(3),
        capacity.parse.clone().acquire_owned(),
    )
    .await
    .unwrap()
    .unwrap();
    drop(returned);
    assert_eq!(capacity.parse.available_permits(), 1);
}
