use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::{jobs, uploads};

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/ocr/jobs",
            post(jobs::create_ocr_job)
                .get(jobs::list_ocr_jobs)
                .layer(DefaultBodyLimit::disable()),
        )
        .route("/api/v1/ocr/jobs/:job_id", get(jobs::get_ocr_job))
        .route(
            "/api/v1/ocr/jobs/:job_id/events",
            get(jobs::get_ocr_job_events),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/artifacts",
            get(jobs::get_ocr_job_artifacts),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/artifacts-manifest",
            get(jobs::get_ocr_job_artifacts_manifest),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/artifacts/:artifact_key",
            get(jobs::download_ocr_artifact_by_key),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/normalized-document",
            get(jobs::download_ocr_normalized_document),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/normalization-report",
            get(jobs::download_ocr_normalization_report),
        )
        .route(
            "/api/v1/ocr/jobs/:job_id/cancel",
            post(jobs::cancel_ocr_job),
        )
        .route(
            "/api/v1/uploads",
            post(uploads::upload_pdf).layer(DefaultBodyLimit::disable()),
        )
}
