use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::jobs;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/jobs", post(jobs::create_job).get(jobs::list_jobs))
        .route("/api/v1/jobs/:job_id", get(jobs::get_job))
        .route("/api/v1/jobs/:job_id/events", get(jobs::get_job_events))
        .route(
            "/api/v1/jobs/:job_id/live-translation/layout",
            get(jobs::get_live_translation_layout),
        )
        .route(
            "/api/v1/jobs/:job_id/live-translation/pages/:page_idx",
            get(jobs::get_live_translation_page),
        )
        .route(
            "/api/v1/jobs/:job_id/live-events",
            get(jobs::get_live_translation_events),
        )
        .route(
            "/api/v1/jobs/:job_id/reader/regions",
            get(jobs::get_reader_regions),
        )
        .route(
            "/api/v1/jobs/:job_id/reader/metadata",
            get(jobs::get_reader_metadata),
        )
        .route(
            "/api/v1/jobs/:job_id/reader/ai/chat",
            post(jobs::reader_ai_chat), // deprecated: use POST /api/v1/ai/ask, see ai-ask.v1 contract
        )
        .route(
            "/api/v1/jobs/:job_id/diagnostics",
            get(jobs::get_job_diagnostics),
        )
        .route(
            "/api/v1/jobs/:job_id/resume-plan",
            get(jobs::get_resume_plan),
        )
        .route(
            "/api/v1/jobs/:job_id/stage-actions",
            get(jobs::get_stage_actions),
        )
        .route("/api/v1/jobs/:job_id/resume", post(jobs::resume_job))
        .route("/api/v1/jobs/:job_id/retry-stage", post(jobs::retry_stage))
        .route(
            "/api/v1/jobs/:job_id/ocr/resolve-ambiguity",
            post(jobs::resolve_ocr_ambiguity),
        )
        .route(
            "/api/v1/jobs/:job_id/translation/diagnostics",
            get(jobs::get_translation_diagnostics),
        )
        .route(
            "/api/v1/jobs/:job_id/translation/items",
            get(jobs::list_translation_items),
        )
        .route(
            "/api/v1/jobs/:job_id/translation/items/:item_id",
            get(jobs::get_translation_item),
        )
        .route(
            "/api/v1/jobs/:job_id/translation/items/:item_id/replay",
            post(jobs::replay_translation_item_route),
        )
        .route(
            "/api/v1/jobs/:job_id/artifacts",
            get(jobs::get_job_artifacts),
        )
        .route(
            "/api/v1/jobs/:job_id/artifacts-manifest",
            get(jobs::get_job_artifacts_manifest),
        )
        .route(
            "/api/v1/jobs/:job_id/artifacts/:artifact_key",
            get(jobs::download_artifact_by_key),
        )
        .route("/api/v1/jobs/:job_id/pdf", get(jobs::download_pdf))
        .route(
            "/api/v1/jobs/:job_id/pdf/side-by-side",
            get(jobs::download_side_by_side_pdf),
        )
        .route("/api/v1/jobs/:job_id/cover", get(jobs::download_cover))
        .route(
            "/api/v1/jobs/:job_id/thumbnail",
            get(jobs::download_thumbnail),
        )
        .route(
            "/api/v1/jobs/:job_id/preview/pages/:page",
            get(jobs::download_page_preview),
        )
        .route(
            "/api/v1/jobs/:job_id/normalized-document",
            get(jobs::download_normalized_document),
        )
        .route(
            "/api/v1/jobs/:job_id/normalization-report",
            get(jobs::download_normalization_report),
        )
        .route(
            "/api/v1/jobs/:job_id/markdown",
            get(jobs::download_markdown),
        )
        .route(
            "/api/v1/jobs/:job_id/markdown/document",
            get(jobs::get_markdown_document),
        )
        .route(
            "/api/v1/jobs/:job_id/markdown/images/*path",
            get(jobs::download_markdown_image),
        )
        .route("/api/v1/jobs/:job_id/download", get(jobs::download_bundle))
        .route("/api/v1/jobs/:job_id/cancel", post(jobs::cancel_job))
        .route("/api/v1/jobs/:job_id/rerun", post(jobs::rerun_job))
}
