//! 恢复备份期间（`Db::begin_restore` 拿着写锁）建任务、上传回 409 `restore_in_progress`，什么都不留下；恢复完照常。

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use tower::util::ServiceExt;

use super::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;
use crate::models::domain::JobStatusKind;

/// 上传目录里的上传（不算正在收的 `.incoming/`）。
fn stored_uploads(state: &crate::AppState) -> usize {
    std::fs::read_dir(&state.config.uploads_dir)
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
                .count()
        })
        .unwrap_or(0)
}

const BOUNDARY: &str = "retainpdf-restore-gate-boundary";

fn upload_request() -> Request<Body> {
    let mut body = format!(
        "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"restore.pdf\"\r\nContent-Type: application/pdf\r\n\r\n"
    )
    .into_bytes();
    body.extend_from_slice(&minimal_pdf_bytes(595, 842));
    body.extend_from_slice(format!("\r\n--{BOUNDARY}--\r\n").as_bytes());
    Request::builder()
        .method("POST")
        .uri("/api/v1/uploads")
        .header("X-API-Key", "test-key")
        .header(header::CONTENT_TYPE, format!("multipart/form-data; boundary={BOUNDARY}"))
        .body(Body::from(body))
        .expect("upload request")
}

fn create_request(upload_id: &str) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri("/api/v1/jobs")
        .header("X-API-Key", "test-key")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "workflow": "ocr",
                "source": { "upload_id": upload_id },
                "ocr": { "provider": "local" }
            })
            .to_string(),
        ))
        .expect("create request")
}

fn assert_restore_in_progress(status: StatusCode, payload: &serde_json::Value) {
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "restore_in_progress", "{payload}");
}

#[tokio::test]
async fn jobs_and_uploads_wait_out_a_restore_and_work_again_afterwards() {
    let state = test_state("restore-in-progress");
    let response = build_app(state.clone()).oneshot(upload_request()).await.expect("upload response");
    assert_eq!(response.status(), StatusCode::OK);
    let upload_id = read_json(response).await["data"]["upload_id"].as_str().expect("upload id").to_string();
    let uploads_before = stored_uploads(&state);

    let restoring = state.db.begin_restore();

    let response = build_app(state.clone()).oneshot(create_request(&upload_id)).await.expect("create response");
    let status = response.status();
    assert_restore_in_progress(status, &read_json(response).await);
    assert_eq!(state.db.count_jobs_with_status(&JobStatusKind::Queued).unwrap(), 0, "no job row while restoring");
    assert!(
        !state.config.data_root.join("jobs").exists()
            || std::fs::read_dir(state.config.data_root.join("jobs")).unwrap().next().is_none(),
        "no job directory while restoring"
    );

    let response = build_app(state.clone()).oneshot(upload_request()).await.expect("upload response");
    let status = response.status();
    assert_restore_in_progress(status, &read_json(response).await);
    assert_eq!(stored_uploads(&state), uploads_before, "nothing left in the uploads directory while restoring");

    drop(restoring);

    let response = build_app(state.clone()).oneshot(create_request(&upload_id)).await.expect("create response");
    let status = response.status();
    let payload = read_json(response).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
}
