use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::{library_data, public_document_operations};

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/documents", get(library_data::list_documents_route))
        .route(
            "/api/v1/documents/:document_id",
            get(library_data::get_document_route)
                .patch(library_data::patch_document_route)
                .delete(library_data::delete_document_route),
        )
        .route(
            "/api/v1/documents/:document_id/source.pdf",
            get(library_data::download_document_source_pdf_route),
        )
        .route(
            "/api/v1/documents/:document_id/cover",
            get(library_data::download_document_cover_route),
        )
        .route(
            "/api/v1/documents/:document_id/thumbnail",
            get(library_data::download_document_thumbnail_route),
        )
        .route(
            "/api/v1/documents/:document_id/translate",
            post(library_data::translate_document_route),
        )
        .route(
            "/api/v1/documents/:document_id/ocr",
            post(library_data::ocr_document_route),
        )
        .route(
            "/api/v1/documents/:document_id/metadata-suggestions",
            get(library_data::list_document_metadata_suggestions_route)
                .post(library_data::create_document_metadata_suggestion_route),
        )
        .route(
            "/api/v1/documents/:document_id/metadata-suggestions/:suggestion_id/apply",
            post(library_data::apply_document_metadata_suggestion_route),
        )
        .route(
            "/api/v1/documents/:document_id/jobs",
            get(library_data::list_document_jobs_route),
        )
        .route(
            "/api/v1/documents/:document_id/agent-versions",
            get(public_document_operations::list_document_agent_versions_route),
        )
        .route(
            "/api/v1/favorites",
            post(library_data::create_favorite_route).get(library_data::list_favorites_route),
        )
        .route(
            "/api/v1/favorites/:favorite_id",
            axum::routing::patch(library_data::patch_favorite_route)
                .delete(library_data::delete_favorite_route),
        )
        .route("/api/v1/search", get(library_data::search_blocks_route))
}
