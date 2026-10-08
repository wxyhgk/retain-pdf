//! 修订登记的 api 层壳:对账逻辑本身在 `retain_data::translation_revisions`
//! (渲染阶段的精修在 Python 子进程里写回,任务运行时在 workflow 结束时也要调用它),
//! 这里只做错误映射,以及把逐页结果折成接口里的 `live_publication`。

use std::path::Path;

use crate::db::{Db, RevisedPagePublication, RevisedPageStatus};
use crate::error::AppError;
use crate::models::api::{TranslationRevisionLivePageView, TranslationRevisionLivePublicationView};

/// 对账一次。没有修订日志(从没修订过)时返回 `None`,什么都不读。
pub(crate) fn publish_translation_revisions(
    db: &Db,
    job_id: &str,
    translations_dir: &Path,
) -> Result<Option<Vec<RevisedPagePublication>>, AppError> {
    Ok(retain_data::translation_revisions::publish_translation_revisions(
        db,
        job_id,
        translations_dir,
    )?)
}

/// 登记完成后清掉不再被引用的旧 generation 快照(规则见 retain-data 同名函数)。
pub(crate) fn prune_superseded_revision_snapshots(
    db: &Db,
    job_id: &str,
    translations_dir: &Path,
) -> Result<usize, AppError> {
    Ok(
        retain_data::translation_revisions::prune_superseded_revision_snapshots(
            db,
            job_id,
            translations_dir,
        )?,
    )
}

/// 把逐页结果折成接口里的 `live_publication`。
pub(crate) fn live_publication_view(
    result: Result<Option<Vec<RevisedPagePublication>>, AppError>,
) -> TranslationRevisionLivePublicationView {
    let pages = match result {
        Ok(pages) => pages.unwrap_or_default(),
        Err(error) => {
            return TranslationRevisionLivePublicationView {
                status: "failed".to_string(),
                pages: Vec::new(),
                error: Some(error.to_string()),
            }
        }
    };
    let has = |status| pages.iter().any(|page| page.status == status);
    let status = if has(RevisedPageStatus::Published) {
        "published"
    } else if has(RevisedPageStatus::RunningAttempt) {
        "pending"
    } else if has(RevisedPageStatus::NoDurableAttempt) {
        "unavailable"
    } else {
        "current"
    };
    TranslationRevisionLivePublicationView {
        status: status.to_string(),
        pages: pages
            .into_iter()
            .map(|page| TranslationRevisionLivePageView {
                page_idx: page.page_index,
                page_hash: page.page_hash,
                status: page_status(page.status).to_string(),
                attempt: page.attempt,
                generation: page.generation,
            })
            .collect(),
        error: None,
    }
}

fn page_status(status: RevisedPageStatus) -> &'static str {
    match status {
        RevisedPageStatus::Published => "published",
        RevisedPageStatus::Current => "current",
        RevisedPageStatus::Superseded => "superseded",
        RevisedPageStatus::RunningAttempt => "running_attempt",
        RevisedPageStatus::NoDurableAttempt => "no_durable_attempt",
    }
}
