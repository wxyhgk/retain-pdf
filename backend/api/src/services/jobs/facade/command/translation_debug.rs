use axum::http::StatusCode;
use serde_json::{json, Value};

use crate::error::AppError;
use crate::models::api::{
    AmbiguousRequestPolicy, ReviseTranslationItemRequest, RetryStageKind, RetryStageRequest,
    TranslationReplayView, TranslationRevisionView,
};
use crate::models::domain::JobStatusKind;

use super::super::super::debug::{replay_translation_item, revise_translation_item};
use super::super::super::live_translation::{
    live_publication_view, prune_superseded_revision_snapshots, publish_translation_revisions,
};
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

    /// 单块译文修订写回。`rerender=true` 时写回成功后复用 retry-stage 的原地重渲染
    /// (stage=render、create_new_job=false),不清背景清理缓存。
    pub async fn revise_translation_item(
        &self,
        base_url: &str,
        job_id: &str,
        item_id: &str,
        request: ReviseTranslationItemRequest,
    ) -> Result<TranslationRevisionView, AppError> {
        if crate::services::merge::reading::is_virtual_job_id(job_id) {
            return Err(AppError::translation_revision(
                StatusCode::CONFLICT,
                "read_only_job",
                "merged reading results are read-only; revise the source job instead",
                Value::Null,
            ));
        }
        let job = load_supported_job(self.command.db, self.command.control.data_root, job_id)?;
        // 同一任务在跑(翻译或渲染)时不许写回:worker 正持有并改写这些页文件。
        // Python 侧还会再拿一次 checkpoint 文件锁,挡住检查之后才启动的 worker。
        if matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
            return Err(AppError::translation_revision(
                StatusCode::CONFLICT,
                "job_running",
                "job is queued or running; wait for it to finish before revising translations",
                json!({ "status": job.status }),
            ));
        }
        let outcome = revise_translation_item(&self.query.replay, &job, item_id, &request).await?;
        // 写回已经落盘;登记进数据库,实时译文、页快照和提交事件才看得到新文本。
        // `changed=false` 也对账一次:上次写回成功、登记失败时,重发同一请求就能补上。
        // 登记失败不回滚写回(文件才是权威),由 live_publication 报告,之后的修订或
        // 打开实时译文时再补登记。
        let publication =
            publish_translation_revisions(self.command.db, &job.job_id, &outcome.translations_dir);
        match &publication {
            Ok(Some(_)) => {
                if let Err(error) = prune_superseded_revision_snapshots(
                    self.command.db,
                    &job.job_id,
                    &outcome.translations_dir,
                ) {
                    tracing::warn!(
                        job_id = %job.job_id,
                        error = %error,
                        "failed to prune superseded translation snapshots after revision"
                    );
                }
            }
            Ok(None) => {}
            Err(error) => tracing::warn!(
                job_id = %job.job_id,
                item_id,
                error = %error,
                "translation revision was written but could not be registered for live translation"
            ),
        }
        let live_publication = live_publication_view(publication);
        let (rerender, rerender_error) = if request.rerender {
            match self.retry_stage_submission(
                base_url,
                job_id,
                RetryStageRequest {
                    stage: RetryStageKind::Render,
                    mode: "from_stage".to_string(),
                    create_new_job: Some(false),
                    overrides: Value::Null,
                    ambiguous_request_policy: AmbiguousRequestPolicy::default(),
                    refine: None,
                },
            ) {
                Ok(view) => (Some(view), None),
                Err(error) => (None, Some(error.to_string())),
            }
        } else {
            (None, None)
        };
        Ok(TranslationRevisionView {
            job_id: job.job_id.clone(),
            item_id: item_id.to_string(),
            changed: outcome.changed,
            generation: outcome.generation,
            item: outcome.item,
            validation: outcome.validation,
            revision: outcome.revision,
            page_hashes: outcome.page_hashes,
            live_publication,
            rerender,
            rerender_error,
        })
    }
}
