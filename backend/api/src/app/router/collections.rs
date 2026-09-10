use axum::routing::post;
use axum::Router;

use crate::app::AppState;
use crate::routes::collections;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/collections",
            post(collections::create_collection_route).get(collections::list_collections_route),
        )
        .route(
            "/api/v1/collections/:collection_id",
            axum::routing::patch(collections::patch_collection_route)
                .delete(collections::delete_collection_route),
        )
        .route(
            "/api/v1/collections/:collection_id/documents",
            post(collections::add_collection_documents_route),
        )
        .route(
            "/api/v1/collections/:collection_id/documents/:document_id",
            axum::routing::delete(collections::remove_collection_document_route),
        )
}
