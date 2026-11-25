//! 原地重渲染不丢上一份译文 PDF：发射失败什么都不动，没跑成（失败 / 取消）接回上一份，
//! 两个同时来的原地重跑只有一个开跑。审计见
//! `docs/ops/planning/api-reorg/20261019-正确性与状态一致性审计明细/`（1-4、3-2、6-8）。

use std::sync::Arc;

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use serde_json::json;
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::{build_app, build_jobs_facade_with_launcher};
use crate::error::AppError;
use crate::models::{JobArtifacts, JobSnapshot, JobStatusKind};
use crate::services::jobs::{JobLaunchDeps, JobRuntimeLauncher};

use super::common::{seed_translation_result_files, source_job_with_artifacts};

/// 一个已经排好 PDF 的任务（可以原地重渲染：译文、OCR、原文都在），外加一个上一轮遗留的
/// `<id>-ocr` 子任务。返回上一份 PDF 的内容。
fn seed_rendered_job(state: &crate::AppState, id: &str, status: JobStatusKind) -> Vec<u8> {
    let mut job = source_job_with_artifacts(
        id,
        JobArtifacts {
            job_root: Some(format!("jobs/{id}")),
            source_pdf: Some(format!("jobs/{id}/source/input.pdf")),
            normalized_document_json: Some(format!("jobs/{id}/ocr/document.v1.json")),
            translations_dir: Some(format!("jobs/{id}/translated")),
            output_pdf: Some(format!("jobs/{id}/rendered/out.pdf")),
            ..JobArtifacts::default()
        },
    );
    job.status = status;
    job.finished_at = Some("2026-10-19T08:00:00Z".to_string());
    seed_translation_result_files(state, &job);
    let pdf = minimal_pdf_bytes(612, 792);
    let rendered = state.config.data_root.join(format!("jobs/{id}/rendered"));
    std::fs::create_dir_all(&rendered).unwrap();
    std::fs::write(rendered.join("out.pdf"), &pdf).unwrap();
    state.db.save_job(&job).unwrap();

    let ocr_child = JobSnapshot::new(format!("{id}-ocr"), job.request_payload.clone(), Vec::new());
    state.db.save_job(&ocr_child).unwrap();
    std::fs::create_dir_all(state.config.data_root.join(format!("jobs/{id}-ocr"))).unwrap();
    pdf
}

async fn translated_pdf(state: &crate::AppState, id: &str) -> (StatusCode, Vec<u8>) {
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{id}/files/output/translated.pdf?watermark=0"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, body.to_vec())
}

fn no_launch() -> JobRuntimeLauncher {
    JobRuntimeLauncher::new(Arc::new(|_| {}))
}

/// 用 Rust 模型执行器的任务在执行器没开时重跑：落库之前就 503。以前在这之前已经删了
/// `rendered/` 和 `-ocr` 子任务，任务还是 succeeded，PDF 却 404 了。
#[tokio::test]
async fn rerun_that_cannot_launch_keeps_the_old_pdf_and_the_ocr_child() {
    let state = test_state("rerender-launch-refused");
    let id = "job-rerender-launch-refused";
    let pdf = seed_rendered_job(&state, id, JobStatusKind::Succeeded);
    let mut job = state.db.get_job(id).unwrap();
    job.request_payload.translation.execution_connection = Some(
        serde_json::from_value(json!({
            "id":"test", "revision":1, "provider":"qwen", "base_url":"https://example.org/v1",
            "model":"qwen3.8-flash", "credential_ref":"cred_test", "concurrency":2
        }))
        .unwrap(),
    );
    state.db.save_job(&job).unwrap();

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{id}/actions/resume"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);

    let job = state.db.get_job(id).unwrap();
    assert_eq!(job.status, JobStatusKind::Succeeded);
    assert_eq!(job.run_generation, 0, "没开跑，代次不变");
    assert!(state.db.get_job(&format!("{id}-ocr")).is_ok(), "-ocr 子任务行还在");
    assert!(state.config.data_root.join(format!("jobs/{id}-ocr")).is_dir(), "-ocr 子任务目录还在");
    assert_eq!(translated_pdf(&state, id).await, (StatusCode::OK, pdf));
}

/// 开跑成功之后才清理上一轮的 `-ocr` 子任务；上一份 PDF 挪到渲染不会写的名字，排队期间照样能读。
#[tokio::test]
async fn rerun_moves_the_old_pdf_aside_and_drops_the_ocr_child_after_it_starts() {
    let state = test_state("rerender-started");
    let id = "job-rerender-started";
    let pdf = seed_rendered_job(&state, id, JobStatusKind::Failed);
    let facade = build_jobs_facade_with_launcher(&state, no_launch());

    facade
        .rerun_submission("http://retain.test", id, &serde_json::Value::Null)
        .expect("rerun");

    let job = state.db.get_job(id).unwrap();
    assert_eq!(job.status, JobStatusKind::Queued);
    let artifacts = job.artifacts.as_ref().unwrap();
    assert_eq!(artifacts.output_pdf, None);
    assert_eq!(
        artifacts.previous_output_pdf.as_deref(),
        Some(format!("jobs/{id}/rendered/out.previous.pdf").as_str())
    );
    let rendered = state.config.data_root.join(format!("jobs/{id}/rendered"));
    assert!(!rendered.join("out.pdf").exists(), "渲染要写的名字空出来，不会被当成新产物，也不会截断旧文件");
    assert_eq!(std::fs::read(rendered.join("out.previous.pdf")).unwrap(), pdf);
    assert!(state.db.get_job(&format!("{id}-ocr")).is_err(), "开跑之后清掉 -ocr 子任务");
}

/// 原地重渲染失败：上一份 PDF 接回来，`translated.pdf` 照常能下载。
#[tokio::test]
async fn failed_in_place_rerender_serves_the_previous_pdf_again() {
    let state = test_state("rerender-failed");
    let id = "job-rerender-failed";
    let pdf = seed_rendered_job(&state, id, JobStatusKind::Succeeded);
    let facade = build_jobs_facade_with_launcher(&state, no_launch());
    facade
        .retry_stage_submission(
            "http://retain.test",
            id,
            serde_json::from_value(json!({"stage": "render", "create_new_job": false})).unwrap(),
        )
        .expect("in-place rerender");
    assert_eq!(translated_pdf(&state, id).await.0, StatusCode::NOT_FOUND, "排队中没有新 PDF");

    // runner 收尾：渲染进程半路把同名文件写坏了，然后失败。
    let rendered = state.config.data_root.join(format!("jobs/{id}/rendered"));
    std::fs::write(rendered.join("out.pdf"), b"%PDF-1.7 truncated").unwrap();
    let mut job = state.db.get_job(id).unwrap();
    job.status = JobStatusKind::Failed;
    assert!(state.db.cas_save_job(&job, &["queued", "running"]).unwrap());

    let job = state.db.get_job(id).unwrap();
    assert_eq!(
        job.artifacts.as_ref().unwrap().output_pdf.as_deref(),
        Some(format!("jobs/{id}/rendered/out.previous.pdf").as_str())
    );
    assert_eq!(translated_pdf(&state, id).await, (StatusCode::OK, pdf.clone()));

    // 再重渲染一次：接回来的那份已经不在渲染要写的名字上，不用再挪。
    facade
        .retry_stage_submission(
            "http://retain.test",
            id,
            serde_json::from_value(json!({"stage": "render", "create_new_job": false})).unwrap(),
        )
        .expect("rerender again");
    assert_eq!(std::fs::read(rendered.join("out.previous.pdf")).unwrap(), pdf);
}

/// 排队中被取消（API 自己 CAS 落 canceled）：同样接回上一份 PDF。
#[tokio::test]
async fn canceled_in_place_rerender_serves_the_previous_pdf_again() {
    let state = test_state("rerender-canceled");
    let id = "job-rerender-canceled";
    let pdf = seed_rendered_job(&state, id, JobStatusKind::Succeeded);
    build_jobs_facade_with_launcher(&state, no_launch())
        .rerun_submission("http://retain.test", id, &serde_json::Value::Null)
        .expect("rerun");

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{id}/actions/cancel"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK, "{:?}", read_json(response).await);
    assert_eq!(state.db.get_job(id).unwrap().status, JobStatusKind::Canceled);
    assert_eq!(translated_pdf(&state, id).await, (StatusCode::OK, pdf));
}

/// 两个原地重跑都读到了同一个终态：只有先落库的那个开跑，后一个 409，不把已经开跑的那一次
/// 盖回 queued，也不碰它的文件。
#[test]
fn two_in_place_rerenders_from_the_same_read_only_one_starts() {
    let state = test_state("rerender-concurrent");
    let id = "job-rerender-concurrent";
    let pdf = seed_rendered_job(&state, id, JobStatusKind::Failed);
    let deps = JobLaunchDeps::new(
        state.db.as_ref(),
        &state.config.data_root,
        &state.config.output_root,
        no_launch(),
    );
    let read_by_both = state.db.get_job(id).unwrap();
    let rerender = |read: &JobSnapshot| {
        let fence = crate::services::jobs::RunFence::of(read);
        let mut job = read.clone();
        job.status = JobStatusKind::Queued;
        if let Some(artifacts) = job.artifacts.as_mut() {
            artifacts.previous_output_pdf = artifacts.output_pdf.take();
        }
        crate::services::jobs::relaunch_in_place(&deps, job, &fence)
    };

    rerender(&read_by_both).expect("first rerender starts");
    let mut running = state.db.get_job(id).unwrap();
    assert_eq!(running.run_generation, 1);
    running.status = JobStatusKind::Running;
    running.pid = Some(4242);
    assert!(state.db.cas_save_job(&running, &["queued"]).unwrap());
    let rendered = state.config.data_root.join(format!("jobs/{id}/rendered"));
    std::fs::write(rendered.join("out.pdf"), b"first run writing").unwrap();

    let err = rerender(&read_by_both).expect_err("second rerender must not start");
    assert!(
        matches!(&err, AppError::Reasoned { reason, .. } if *reason == "job_active"),
        "{err:?}"
    );
    let job = state.db.get_job(id).unwrap();
    assert_eq!(job.status, JobStatusKind::Running, "不能把开跑的那次盖回 queued");
    assert_eq!(job.pid, Some(4242));
    assert_eq!(job.run_generation, 1);
    assert_eq!(std::fs::read(rendered.join("out.pdf")).unwrap(), b"first run writing");
    assert_eq!(std::fs::read(rendered.join("out.previous.pdf")).unwrap(), pdf);

    // 第一次已经跑完了（又是终态，但代次变了）：拿着旧读数的请求同样被拒，原因是 stale_resolution。
    running.status = JobStatusKind::Failed;
    assert!(state.db.cas_save_job(&running, &["running"]).unwrap());
    let err = rerender(&read_by_both).expect_err("stale read must not start");
    assert!(
        matches!(&err, AppError::Reasoned { reason, .. } if *reason == "stale_resolution"),
        "{err:?}"
    );
    assert_eq!(state.db.get_job(id).unwrap().run_generation, 1);
}
