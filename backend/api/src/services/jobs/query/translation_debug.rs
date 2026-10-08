use crate::error::AppError;
use crate::models::api::{
    JobReportView, ListTranslationItemsQuery, TranslationDebugItemView, TranslationDebugListView,
    TranslationDiagnosticsView, TranslationRevisionHistoryView,
};

use super::super::debug::{
    load_fit_report_view, load_refine_report_view, load_translation_debug_item_view, load_translation_debug_list_view,
    load_translation_diagnostics_view, load_translation_qa_view,
    load_translation_revision_history,
};
use super::{load_supported_job, JobQueries};

impl JobQueries<'_> {
    pub fn translation_diagnostics_view(
        &self,
        job_id: &str,
    ) -> Result<TranslationDiagnosticsView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_translation_diagnostics_view(self.data_root, &job)
    }

    pub fn translation_qa_view(&self, job_id: &str) -> Result<JobReportView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_translation_qa_view(self.data_root, &job)
    }

    pub fn fit_report_view(&self, job_id: &str) -> Result<JobReportView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_fit_report_view(self.data_root, &job)
    }

    pub fn refine_report_view(&self, job_id: &str) -> Result<JobReportView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_refine_report_view(self.data_root, &job)
    }

    pub fn translation_items_view(
        &self,
        job_id: &str,
        query: &ListTranslationItemsQuery,
    ) -> Result<TranslationDebugListView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_translation_debug_list_view(self.data_root, &job, query)
    }

    pub fn translation_item_view(
        &self,
        job_id: &str,
        item_id: &str,
    ) -> Result<TranslationDebugItemView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_translation_debug_item_view(self.data_root, &job, item_id)
    }

    pub fn translation_item_revisions_view(
        &self,
        job_id: &str,
        item_id: &str,
    ) -> Result<TranslationRevisionHistoryView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_translation_revision_history(self.data_root, &job, item_id)
    }
}
