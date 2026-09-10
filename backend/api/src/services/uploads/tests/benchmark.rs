use super::*;
use lopdf::Document;

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "manual synthetic upload capacity measurement; no model calls"]
async fn benchmark_upload_capacity() {
    let mut pdf = Document::load_mem(&build_test_pdf_bytes()).unwrap();
    pdf.add_object(lopdf::Stream::new(
        lopdf::Dictionary::new(),
        vec![b'x'; 1024 * 1024],
    ));
    let mut input = Vec::new();
    pdf.save_to(&mut input).unwrap();
    for workers in [1, 2, 4, 8] {
        for repeat in 0..4 {
            let root =
                std::env::temp_dir().join(format!("retain-upload-capacity-{}", fastrand::u64(..)));
            let uploads = root.join("uploads");
            let db = Db::new(root.join("db/jobs.db"), root.clone());
            let service = make_service(
                db,
                uploads.clone(),
                "unused-python",
                UploadProcessingConfig {
                    parse_workers: workers,
                    repair_workers: 1,
                    queue_capacity: 32,
                    queue_wait_ms: 30_000,
                    buffer_mib: 512,
                },
            );
            let capacity = service.capacity();
            let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
            let monitor = {
                let stop = stop.clone();
                let capacity = capacity.clone();
                tokio::spawn(async move {
                    let mut gap = 0.0_f64;
                    let mut peak_reserved = 0;
                    while !stop.load(std::sync::atomic::Ordering::Relaxed) {
                        let start = Instant::now();
                        tokio::time::sleep(Duration::from_millis(1)).await;
                        gap = gap.max(start.elapsed().as_secs_f64() * 1000.0);
                        peak_reserved =
                            peak_reserved.max(512 - capacity.buffers.available_permits());
                    }
                    (gap, peak_reserved)
                })
            };
            let started = Instant::now();
            let mut tasks = tokio::task::JoinSet::new();
            for _ in 0..16 {
                let service = service.clone();
                let bytes = input.clone();
                tasks.spawn(async move {
                    let started = Instant::now();
                    let record = service
                        .store(UploadedPdfInput {
                            filename: "synthetic.pdf".into(),
                            bytes,
                            developer_mode: false,
                        })
                        .await
                        .unwrap();
                    assert_eq!(record.page_count, 1);
                    started.elapsed().as_secs_f64() * 1000.0
                });
            }
            let mut latencies = Vec::new();
            while let Some(result) = tasks.join_next().await {
                latencies.push(result.unwrap());
            }
            let elapsed = started.elapsed().as_secs_f64();
            stop.store(true, std::sync::atomic::Ordering::Relaxed);
            let (heartbeat_max_ms, peak_reserved_mib) = monitor.await.unwrap();
            latencies.sort_by(f64::total_cmp);
            if repeat > 0 {
                println!(
                    "upload_capacity_sample={}",
                    serde_json::json!({
                        "parse_workers": workers, "repeat": repeat, "requests": 16,
                        "input_bytes": input.len(), "seconds": elapsed, "uploads_per_second": 16.0 / elapsed,
                        "p50_ms": (latencies[7] + latencies[8]) / 2.0, "p95_ms": latencies[15],
                        "heartbeat_max_ms": heartbeat_max_ms, "sampled_reserved_mib": peak_reserved_mib,
                    })
                );
            }
            std::fs::remove_dir_all(&root).unwrap();
        }
    }
}
