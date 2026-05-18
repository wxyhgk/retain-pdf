use crate::error::AppError;
use crate::models::{
    ListTranslationItemsQuery, TranslationDebugItemView, TranslationDebugListView,
    TranslationDiagnosticsView, TranslationReplayView,
};

use super::super::super::debug::{
    load_translation_debug_item_view, load_translation_debug_list_view,
    load_translation_diagnostics_view, replay_translation_item,
};
use super::super::super::presentation::load_supported_job;
use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub fn translation_diagnostics_view(
        &self,
        job_id: &str,
    ) -> Result<TranslationDiagnosticsView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        load_translation_diagnostics_view(self.query.data_root, &job)
    }

    pub fn translation_items_view(
        &self,
        job_id: &str,
        query: &ListTranslationItemsQuery,
    ) -> Result<TranslationDebugListView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        load_translation_debug_list_view(self.query.data_root, &job, query)
    }

    pub fn translation_item_view(
        &self,
        job_id: &str,
        item_id: &str,
    ) -> Result<TranslationDebugItemView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        load_translation_debug_item_view(self.query.data_root, &job, item_id)
    }

    pub async fn replay_translation_item(
        &self,
        job_id: &str,
        item_id: &str,
    ) -> Result<TranslationReplayView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        replay_translation_item(&self.query.replay, &job, item_id).await
    }
}
