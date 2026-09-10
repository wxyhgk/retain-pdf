use crate::error::AppError;
use crate::models::api::{
    LiveTranslationCommitEventView, LiveTranslationLayoutView, LiveTranslationPageView,
};

use super::super::super::live_translation::{
    load_live_translation_events_after, load_live_translation_layout, load_live_translation_page,
};
use super::super::super::query::load_supported_job;
use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub fn live_translation_layout(
        &self,
        job_id: &str,
    ) -> Result<LiveTranslationLayoutView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        load_live_translation_layout(self.query.data_root, &job)
    }

    pub fn live_translation_page(
        &self,
        job_id: &str,
        page_idx: u32,
    ) -> Result<LiveTranslationPageView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        load_live_translation_page(self.query.db, self.query.data_root, &job, page_idx)
    }

    pub fn live_translation_events_after(
        &self,
        job_id: &str,
        after_seq: i64,
        limit: u32,
    ) -> Result<Vec<LiveTranslationCommitEventView>, AppError> {
        load_supported_job(self.query.db, self.query.data_root, job_id)?;
        load_live_translation_events_after(self.query.db, job_id, after_seq.max(0), limit)
    }
}
