use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::glossaries;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/glossaries/parse-csv",
            post(glossaries::parse_glossary_csv_route),
        )
        .route(
            "/api/v1/glossaries/import",
            post(glossaries::import_glossary_route),
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
        .route(
            "/api/v1/glossaries/:glossary_id/export.csv",
            get(glossaries::export_glossary_csv_route),
        )
}
