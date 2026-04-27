use axum::extract::DefaultBodyLimit;
use axum::middleware;
use axum::routing::{get, post};
use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::app::AppState;
use crate::auth;
use crate::routes::glossaries;
use crate::routes::health;
use crate::routes::jobs;
use crate::routes::providers;
use crate::routes::uploads;

pub fn build_app(state: AppState) -> Router {
    let api_routes = Router::new()
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
        .route(
            "/api/v1/glossaries/parse-csv",
            post(glossaries::parse_glossary_csv_route),
        )
        .route(
            "/api/v1/glossaries",
            post(glossaries::create_glossary_route).get(glossaries::list_glossaries_route),
        )
        .route(
            "/api/v1/glossaries/:glossary_id",
            get(glossaries::get_glossary_route)
                .put(glossaries::update_glossary_route)
                .delete(glossaries::delete_glossary_route),
        )
        .route("/api/v1/jobs", post(jobs::create_job).get(jobs::list_jobs))
        .route("/api/v1/jobs/:job_id", get(jobs::get_job))
        .route("/api/v1/jobs/:job_id/events", get(jobs::get_job_events))
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
            "/api/v1/jobs/:job_id/markdown/images/*path",
            get(jobs::download_markdown_image),
        )
        .route("/api/v1/jobs/:job_id/download", get(jobs::download_bundle))
        .route("/api/v1/jobs/:job_id/cancel", post(jobs::cancel_job))
        .route(
            "/api/v1/providers/mineru/validate-token",
            post(providers::validate_mineru_token),
        )
        .route(
            "/api/v1/providers/paddle/validate-token",
            post(providers::validate_paddle_token),
        )
        .route(
            "/api/v1/providers/deepseek/validate-token",
            post(providers::validate_deepseek_token),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key,
        ));

    Router::new()
        .route("/health", get(health::health))
        .merge(api_routes)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub fn build_simple_app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        .route(
            "/api/v1/translate/bundle",
            post(jobs::translate_bundle).layer(DefaultBodyLimit::disable()),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key,
        ))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
