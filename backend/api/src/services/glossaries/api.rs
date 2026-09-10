use crate::db::Db;
use crate::error::AppError;
use crate::models::api::{
    glossary_to_csv_export, glossary_to_detail, glossary_to_summary, GlossaryCsvExportView,
    GlossaryCsvParseInput, GlossaryCsvParseView, GlossaryDetailView, GlossaryListView,
    GlossaryUpsertInput, ListGlossariesQuery,
};
use super::csv::parse_glossary_csv;
use super::records::{
    create_glossary, delete_glossary, filter_glossaries, list_glossaries, load_glossary_or_404,
    update_glossary,
};

pub struct GlossaryApiDeps<'a> {
    db: &'a Db,
}

impl<'a> GlossaryApiDeps<'a> {
    pub fn new(db: &'a Db) -> Self {
        Self { db }
    }
}

pub fn create_glossary_view(
    deps: &GlossaryApiDeps<'_>,
    payload: &GlossaryUpsertInput,
) -> Result<GlossaryDetailView, AppError> {
    let record = create_glossary(deps.db, payload)?;
    Ok(glossary_to_detail(&record))
}

pub fn list_glossaries_view(
    deps: &GlossaryApiDeps<'_>,
    query: &ListGlossariesQuery,
) -> Result<GlossaryListView, AppError> {
    let items = filter_glossaries(list_glossaries(deps.db)?, query)
        .iter()
        .map(glossary_to_summary)
        .collect();
    Ok(GlossaryListView { items })
}

pub fn get_glossary_view(
    deps: &GlossaryApiDeps<'_>,
    glossary_id: &str,
) -> Result<GlossaryDetailView, AppError> {
    let record = load_glossary_or_404(deps.db, glossary_id)?;
    Ok(glossary_to_detail(&record))
}

pub fn update_glossary_view(
    deps: &GlossaryApiDeps<'_>,
    glossary_id: &str,
    payload: &GlossaryUpsertInput,
) -> Result<GlossaryDetailView, AppError> {
    let record = update_glossary(deps.db, glossary_id, payload)?;
    Ok(glossary_to_detail(&record))
}

pub fn delete_glossary_view(
    deps: &GlossaryApiDeps<'_>,
    glossary_id: &str,
) -> Result<GlossaryDetailView, AppError> {
    let record = load_glossary_or_404(deps.db, glossary_id)?;
    delete_glossary(deps.db, glossary_id)?;
    Ok(glossary_to_detail(&record))
}

pub fn export_glossary_csv_view(
    deps: &GlossaryApiDeps<'_>,
    glossary_id: &str,
) -> Result<GlossaryCsvExportView, AppError> {
    let record = load_glossary_or_404(deps.db, glossary_id)?;
    Ok(glossary_to_csv_export(&record))
}

pub fn import_glossary_view(
    deps: &GlossaryApiDeps<'_>,
    payload: &GlossaryUpsertInput,
) -> Result<GlossaryDetailView, AppError> {
    if payload.glossary_id.trim().is_empty() {
        return create_glossary_view(deps, payload);
    }
    update_glossary_view(deps, &payload.glossary_id, payload)
}

pub fn parse_glossary_csv_view(
    payload: &GlossaryCsvParseInput,
) -> Result<GlossaryCsvParseView, AppError> {
    let entries = parse_glossary_csv(payload)?;
    Ok(GlossaryCsvParseView {
        entry_count: entries.len(),
        entries,
    })
}
