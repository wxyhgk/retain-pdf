use axum::extract::{Path as AxumPath, State};
use axum::Json;

use crate::error::AppError;
use crate::models::{
    glossary_to_detail, glossary_to_summary, ApiResponse, GlossaryCsvParseInput,
    GlossaryCsvParseView, GlossaryDetailView, GlossaryListView, GlossaryUpsertInput,
};
use crate::services::glossaries::{
    create_glossary, delete_glossary, list_glossaries, load_glossary_or_404, parse_glossary_csv,
    update_glossary,
};
use crate::AppState;

pub async fn create_glossary_route(
    State(state): State<AppState>,
    Json(payload): Json<GlossaryUpsertInput>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    let record = create_glossary(state.db.as_ref(), &payload)?;
    Ok(Json(ApiResponse::ok(glossary_to_detail(&record))))
}

pub async fn list_glossaries_route(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<GlossaryListView>>, AppError> {
    let items = list_glossaries(state.db.as_ref())?
        .iter()
        .map(glossary_to_summary)
        .collect();
    Ok(Json(ApiResponse::ok(GlossaryListView { items })))
}

pub async fn get_glossary_route(
    State(state): State<AppState>,
    AxumPath(glossary_id): AxumPath<String>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    let record = load_glossary_or_404(state.db.as_ref(), &glossary_id)?;
    Ok(Json(ApiResponse::ok(glossary_to_detail(&record))))
}

pub async fn update_glossary_route(
    State(state): State<AppState>,
    AxumPath(glossary_id): AxumPath<String>,
    Json(payload): Json<GlossaryUpsertInput>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    let record = update_glossary(state.db.as_ref(), &glossary_id, &payload)?;
    Ok(Json(ApiResponse::ok(glossary_to_detail(&record))))
}

pub async fn delete_glossary_route(
    State(state): State<AppState>,
    AxumPath(glossary_id): AxumPath<String>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    let record = load_glossary_or_404(state.db.as_ref(), &glossary_id)?;
    delete_glossary(state.db.as_ref(), &glossary_id)?;
    Ok(Json(ApiResponse::ok(glossary_to_detail(&record))))
}

pub async fn parse_glossary_csv_route(
    Json(payload): Json<GlossaryCsvParseInput>,
) -> Result<Json<ApiResponse<GlossaryCsvParseView>>, AppError> {
    let entries = parse_glossary_csv(&payload)?;
    Ok(Json(ApiResponse::ok(GlossaryCsvParseView {
        entry_count: entries.len(),
        entries,
    })))
}
