use axum::extract::State;
use axum::http::header;
use axum::response::IntoResponse;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, GlossaryCsvParseInput, GlossaryCsvParseView, GlossaryDetailView, GlossaryListView,
    GlossaryUpsertInput, ListGlossariesQuery,
};
use crate::routes::common::{build_glossary_route_deps, ok_json, ApiJson, ApiPath, ApiQuery};
use crate::services::glossaries::api::{
    create_glossary_view, delete_glossary_view, export_glossary_csv_view, get_glossary_view,
    import_glossary_view, list_glossaries_view, parse_glossary_csv_view, update_glossary_view,
};
use crate::AppState;

pub async fn create_glossary_route(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<GlossaryUpsertInput>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    let deps = build_glossary_route_deps(&state);
    Ok(ok_json(create_glossary_view(&deps, &payload)?))
}

pub async fn list_glossaries_route(
    State(state): State<AppState>,
    ApiQuery(query): ApiQuery<ListGlossariesQuery>,
) -> Result<Json<ApiResponse<GlossaryListView>>, AppError> {
    let deps = build_glossary_route_deps(&state);
    Ok(ok_json(list_glossaries_view(&deps, &query)?))
}

pub async fn get_glossary_route(
    State(state): State<AppState>,
    ApiPath(glossary_id): ApiPath<String>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    let deps = build_glossary_route_deps(&state);
    Ok(ok_json(get_glossary_view(&deps, &glossary_id)?))
}

pub async fn update_glossary_route(
    State(state): State<AppState>,
    ApiPath(glossary_id): ApiPath<String>,
    ApiJson(payload): ApiJson<GlossaryUpsertInput>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    let deps = build_glossary_route_deps(&state);
    Ok(ok_json(update_glossary_view(
        &deps,
        &glossary_id,
        &payload,
    )?))
}

pub async fn delete_glossary_route(
    State(state): State<AppState>,
    ApiPath(glossary_id): ApiPath<String>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    let deps = build_glossary_route_deps(&state);
    Ok(ok_json(delete_glossary_view(&deps, &glossary_id)?))
}

pub async fn import_glossary_route(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<GlossaryUpsertInput>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    let deps = build_glossary_route_deps(&state);
    Ok(ok_json(import_glossary_view(&deps, &payload)?))
}

pub async fn export_glossary_csv_route(
    State(state): State<AppState>,
    ApiPath(glossary_id): ApiPath<String>,
) -> Result<axum::response::Response, AppError> {
    let deps = build_glossary_route_deps(&state);
    let export = export_glossary_csv_view(&deps, &glossary_id)?;
    Ok((
        [(header::CONTENT_TYPE, "text/csv; charset=utf-8")],
        export.csv_text,
    )
        .into_response())
}

pub async fn parse_glossary_csv_route(
    ApiJson(payload): ApiJson<GlossaryCsvParseInput>,
) -> Result<Json<ApiResponse<GlossaryCsvParseView>>, AppError> {
    Ok(ok_json(parse_glossary_csv_view(&payload)?))
}
