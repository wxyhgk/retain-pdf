use retainpdf_api_base::error::AppError;
use crate::views::TranslationDiagnosticsView;

use retainpdf_api_base::job_loading::load_supported_job;
use crate::query::JobQueries;
use crate::reports::translation_reports::load_translation_diagnostics_view;

impl JobQueries<'_> {
    pub fn translation_diagnostics_view(
        &self,
        job_id: &str,
    ) -> Result<TranslationDiagnosticsView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        load_translation_diagnostics_view(self.data_root, &job)
    }
}
