//! 父任务取消后，OCR 子任务不能再发起任何付费调用，并且记成 canceled（不是 failed）。
//!
//! 回归：b13ad5 被取消时，它的 OCR 子任务恰好在同一秒才建出来。父任务收尾时把自己的取消登记
//! 清掉了，子任务只看内存登记、看不见取消，照样把 PDF 交给了 Paddle（白付一次 OCR），最后还因为
//! 源文件被清掉而记成 failed。这里不调真的服务商：本地起一个假 Paddle，只数有没有人连过来。

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use super::execute_ocr_job;
use crate::job_runner::cancel_registry::should_stop_ocr_child;
use crate::job_runner::process_runner::tests::test_runtime_deps;
use crate::models::domain::{now_iso, JobSnapshot, JobStatusKind, UploadRecord};
use crate::models::request::CreateJobInput;

/// 一页的合法 PDF（手写的缺交叉引用表，lopdf 读不进来——子任务会在连服务商之前就失败，
/// 测试就成了假通过；对照测试 `a_running_parent_lets_the_child_reach_the_provider` 盯着这一点）。
fn minimal_pdf() -> Vec<u8> {
    use lopdf::{dictionary, Document, Object, Stream};
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let content_id = doc.add_object(Stream::new(dictionary! {}, b"BT ET".to_vec()));
    let page_id = doc.add_object(dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "Contents" => content_id,
        "MediaBox" => vec![0.into(), 0.into(), 200.into(), 200.into()],
    });
    doc.objects.insert(
        pages_id,
        Object::Dictionary(
            dictionary! { "Type" => "Pages", "Kids" => vec![page_id.into()], "Count" => 1 },
        ),
    );
    let catalog_id = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", catalog_id);
    let mut bytes = Vec::new();
    doc.save_to(&mut bytes).unwrap();
    bytes
}

fn save_job(deps: &crate::job_runner::ProcessRuntimeDeps, job_id: &str, status: JobStatusKind) {
    let mut job = JobSnapshot::new(
        job_id.into(),
        CreateJobInput::default(),
        vec!["noop".into()],
    );
    job.status = status;
    deps.db.save_job(&job).unwrap();
}

#[tokio::test]
async fn the_parent_status_in_the_database_stops_the_child_without_any_cancel_signal() {
    let deps = test_runtime_deps(1);
    save_job(&deps, "p-running", JobStatusKind::Running);
    save_job(&deps, "p-canceled", JobStatusKind::Canceled);
    save_job(&deps, "p-failed", JobStatusKind::Failed);
    let registry = deps.canceled_jobs.as_ref();
    let db = deps.db.as_ref();
    let parent = |id: &str| vec![id.to_string()];

    assert!(!should_stop_ocr_child(registry, db, "p-running-ocr", &parent("p-running")).await);
    assert!(
        should_stop_ocr_child(registry, db, "p-canceled-ocr", &parent("p-canceled")).await,
        "内存里没有登记，库里父任务已取消"
    );
    assert!(should_stop_ocr_child(registry, db, "p-failed-ocr", &parent("p-failed")).await);
    assert!(
        should_stop_ocr_child(registry, db, "p-gone-ocr", &parent("p-gone")).await,
        "父任务被删了"
    );
    assert!(
        !should_stop_ocr_child(registry, db, "standalone-ocr", &[]).await,
        "单独的 OCR 任务没有父任务"
    );
}

/// 假的 Paddle：只数连接，回 502。`on_request` 在回 502 之前执行（用来模拟「请求已经发出去了，
/// 父任务这时才被取消」）。
async fn counting_server(
    on_request: Option<Box<dyn Fn() + Send + Sync>>,
) -> (String, Arc<AtomicUsize>) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let connections = Arc::new(AtomicUsize::new(0));
    let counter = connections.clone();
    let on_request: Arc<Option<Box<dyn Fn() + Send + Sync>>> = Arc::new(on_request);
    tokio::spawn(async move {
        loop {
            let Ok((mut socket, _)) = listener.accept().await else {
                return;
            };
            counter.fetch_add(1, Ordering::SeqCst);
            if let Some(hook) = on_request.as_ref() {
                hook();
            }
            tokio::spawn(async move {
                let mut buf = vec![0_u8; 8192];
                let _ = socket.read(&mut buf).await;
                let _ = socket
                    // 502 而不是 500：Paddle 提交收到 500 会在客户端退避重交（fix/ocr-provider-codes），这里只要一次就失败的错
                    .write_all(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                    .await;
            });
        }
    });
    (base, connections)
}

/// 建一个 Paddle 子任务（源文件已上传）并跑一遍，返回结束时的状态、库里的状态（失败由调用方落库，
/// 取消在这里就落库）和假服务器收到的连接数。
async fn run_paddle_child(
    parent_status: JobStatusKind,
    cancel_parent_when_provider_is_called: bool,
) -> (JobStatusKind, Option<JobStatusKind>, usize) {
    let deps = test_runtime_deps(1);
    let hook: Option<Box<dyn Fn() + Send + Sync>> =
        cancel_parent_when_provider_is_called.then(|| {
            let db = deps.db.clone();
            Box::new(move || {
                let mut parent = db.get_job("job-parent").unwrap();
                parent.status = JobStatusKind::Canceled;
                db.save_job(&parent).unwrap();
            }) as Box<dyn Fn() + Send + Sync>
        });
    let (paddle_url, connections) = counting_server(hook).await;
    save_job(&deps, "job-parent", parent_status);
    assert!(
        deps.canceled_jobs.read().await.is_empty(),
        "内存里没有任何取消登记"
    );

    let pdf_bytes = minimal_pdf();
    let upload_dir = deps.config.uploads_dir.join("up-cancel");
    std::fs::create_dir_all(&upload_dir).unwrap();
    let pdf = upload_dir.join("input.pdf");
    std::fs::write(&pdf, &pdf_bytes).unwrap();
    deps.db
        .save_upload(&UploadRecord {
            upload_id: "up-cancel".into(),
            filename: "input.pdf".into(),
            stored_path: pdf.to_string_lossy().into_owned(),
            bytes: pdf_bytes.len() as u64,
            page_count: 1,
            uploaded_at: now_iso(),
            developer_mode: false,
            content_hash: String::new(),
        })
        .unwrap();
    let mut input = CreateJobInput {
        workflow: crate::models::domain::WorkflowKind::Ocr,
        ..Default::default()
    };
    input.source.upload_id = "up-cancel".into();
    input.ocr.provider = "paddle".into();
    input.ocr.paddle_token = "paddle-test-token".into();
    input.ocr.paddle_api_url = paddle_url;
    let mut child = JobSnapshot::new("job-parent-ocr".into(), input, vec![]);
    child.upload_id = Some("up-cancel".into());
    deps.db.save_job(&child).unwrap();

    let finished = tokio::time::timeout(
        Duration::from_secs(20),
        execute_ocr_job(
            deps.clone(),
            child.into_runtime(),
            None,
            Some("job-parent".into()),
        ),
    )
    .await
    .expect("child should finish quickly")
    .expect("child run");
    let stored = deps.db.job_status("job-parent-ocr").unwrap();
    (
        finished.status.clone(),
        stored,
        connections.load(Ordering::SeqCst),
    )
}

/// 对照：父任务还在跑时，这套夹具确实会把请求打到（假的）服务商——否则下面那条测试就是假通过。
#[tokio::test]
async fn a_running_parent_lets_the_child_reach_the_provider() {
    let (status, _, connections) = run_paddle_child(JobStatusKind::Running, false).await;
    assert!(
        connections >= 1,
        "夹具没把请求送到假服务商（status={status:?}）"
    );
    assert_eq!(
        status,
        JobStatusKind::Failed,
        "假服务商回 502，子任务应当失败"
    );
}

/// 回归 b13ad5：父任务在库里已经取消、内存登记已被清掉时建出来的子任务，一次都不能连服务商，
/// 并且记成 canceled。
#[tokio::test]
async fn a_child_started_after_its_parent_was_canceled_never_calls_the_provider() {
    let (status, stored, connections) = run_paddle_child(JobStatusKind::Canceled, false).await;
    assert_eq!(connections, 0, "父任务取消后不能再连服务商");
    assert_eq!(
        status,
        JobStatusKind::Canceled,
        "因父任务取消而停的子任务要记成 canceled"
    );
    assert_eq!(stored, Some(JobStatusKind::Canceled));
}

/// 请求已经发给服务商之后父任务才被取消、服务商随后报错：这次费用收不回，但子任务要记成
/// canceled，别在统计里多出一个「失败」（b13ad5-ocr 原来记成了 failed）。
#[tokio::test]
async fn a_provider_failure_after_the_parent_was_canceled_is_recorded_as_canceled() {
    let (status, stored, connections) = run_paddle_child(JobStatusKind::Running, true).await;
    assert_eq!(connections, 1, "请求在父任务取消前就发出去了");
    assert_eq!(status, JobStatusKind::Canceled);
    assert_eq!(stored, Some(JobStatusKind::Canceled));
}
