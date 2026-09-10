use crate::error::AppError;
use crate::models::api::TranslationReplayView;

use super::super::super::debug::replay_translation_item;
use super::super::super::query::load_supported_job;
use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub async fn replay_translation_item(
        &self,
        job_id: &str,
        item_id: &str,
    ) -> Result<TranslationReplayView, AppError> {
        let job = load_supported_job(self.command.db, self.command.control.data_root, job_id)?;
        replay_translation_item(&self.query.replay, &job, item_id).await
    }
}
