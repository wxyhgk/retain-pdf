use axum::extract::State;
use axum::http::header;
use axum::response::IntoResponse;
use axum::Json;

use crate::auth::Principal;
use crate::error::AppError;
use crate::models::api::{
    ApiResponse, GlossaryCsvParseInput, GlossaryCsvParseView, GlossaryDetailView, GlossaryListView,
    GlossaryUpsertInput, ListGlossariesQuery,
};
use crate::routes::common::{ok_json, run_glossary_blocking, ApiJson, ApiPath, ApiQuery};
use crate::routes::job_helpers::{set_content_disposition, set_file_sandbox};
use crate::services::glossaries::{
    create_glossary_view, delete_glossary_view, export_glossary_csv_view, get_glossary_view,
    list_glossaries_view, parse_glossary_csv_view, update_glossary_view,
};
use crate::AppState;

pub async fn create_glossary_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiJson(payload): ApiJson<GlossaryUpsertInput>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    let owner = principal.owner_id().to_string();
    Ok(ok_json(
        run_glossary_blocking(&state, move |deps| create_glossary_view(deps, &payload, &owner)).await?,
    ))
}

pub async fn list_glossaries_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiQuery(query): ApiQuery<ListGlossariesQuery>,
) -> Result<Json<ApiResponse<GlossaryListView>>, AppError> {
    let owner = principal.owner_filter().map(str::to_string);
    Ok(ok_json(
        run_glossary_blocking(&state, move |deps| list_glossaries_view(deps, &query, owner.as_deref()))
            .await?,
    ))
}

pub async fn get_glossary_route(
    State(state): State<AppState>,
    ApiPath(glossary_id): ApiPath<String>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    Ok(ok_json(
        run_glossary_blocking(&state, move |deps| get_glossary_view(deps, &glossary_id)).await?,
    ))
}

pub async fn update_glossary_route(
    State(state): State<AppState>,
    ApiPath(glossary_id): ApiPath<String>,
    ApiJson(payload): ApiJson<GlossaryUpsertInput>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    Ok(ok_json(
        run_glossary_blocking(&state, move |deps| update_glossary_view(deps, &glossary_id, &payload))
            .await?,
    ))
}

pub async fn delete_glossary_route(
    State(state): State<AppState>,
    ApiPath(glossary_id): ApiPath<String>,
) -> Result<Json<ApiResponse<GlossaryDetailView>>, AppError> {
    Ok(ok_json(
        run_glossary_blocking(&state, move |deps| delete_glossary_view(deps, &glossary_id)).await?,
    ))
}

/// 导出成 CSV：`text/csv`，开头带 UTF-8 BOM，`Content-Disposition: attachment` 带上 `<名字>.csv`。
pub async fn export_glossary_csv_route(
    State(state): State<AppState>,
    ApiPath(glossary_id): ApiPath<String>,
) -> Result<axum::response::Response, AppError> {
    let export =
        run_glossary_blocking(&state, move |deps| export_glossary_csv_view(deps, &glossary_id)).await?;
    let mut response = (
        [(header::CONTENT_TYPE, "text/csv; charset=utf-8")],
        export.csv_text,
    )
        .into_response();
    set_content_disposition(&mut response, "attachment", &export.file_name)?;
    set_file_sandbox(&mut response, "text/csv");
    Ok(response)
}

pub async fn parse_glossary_csv_route(
    ApiJson(payload): ApiJson<GlossaryCsvParseInput>,
) -> Result<Json<ApiResponse<GlossaryCsvParseView>>, AppError> {
    Ok(ok_json(parse_glossary_csv_view(&payload)?))
}
