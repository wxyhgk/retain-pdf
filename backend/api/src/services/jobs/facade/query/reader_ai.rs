use crate::error::AppError;
use crate::models::api::{ReaderAiChatRequest, ReaderAiChatView};

use super::super::super::query::load_supported_job;
use super::super::super::reader_ai::answer_reader_chat;
use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub async fn reader_ai_chat(
        &self,
        job_id: &str,
        request: ReaderAiChatRequest,
    ) -> Result<ReaderAiChatView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        answer_reader_chat(self.query.data_root, &job, request).await
    }
}
