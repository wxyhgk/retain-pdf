//! 一本书「该读哪里」相关的两个读接口：阅读入口、翻译覆盖（合集的 agent 工作区 2026-11-03 跟 AI 服务一起删了）。
//!
//! 以前这几段直接写在路由里（自己拿 state.db / state.config、全路径调 services::library::merge），
//! 违反了路由只经 application facade 的边界（check_architecture.py）。挪到这里，路由只传
//! LibraryDeps。都要跑子进程或读 PDF 页数，放进阻塞线程。

use retainpdf_api_base::error::AppError;
use retainpdf_files::DerivedArtifactDeps;
use crate::merge::coverage::{translation_coverage, TranslationCoverageView};
use crate::merge::page_count::book_page_count;
use crate::merge::reading::{resolve_reading_target, DocumentReadingView, ReadingTarget};
use crate::versions::{
    auto_selection, patch_translation_version, set_current_translation_version, translation_versions_view,
    version_selection, PatchTranslationVersionInput, SetCurrentTranslationVersionInput, TranslationVersionsQuery,
    TranslationVersionsView,
};

use super::media::document_source;
use super::LibraryDeps;

/// 阻塞线程里要用的那几样，全部持有所有权。
struct OwnedReadingDeps {
    db: retainpdf_data::db::Db,
    data_root: std::path::PathBuf,
    python_bin: String,
    pipeline_command: String,
}

impl OwnedReadingDeps {
    fn from(deps: &LibraryDeps<'_>) -> Self {
        Self {
            db: deps.db.clone(),
            data_root: deps.data_root.to_path_buf(),
            python_bin: deps.python_bin.to_string(),
            pipeline_command: deps.pipeline_command.to_string(),
        }
    }
}

/// GET /documents/:id/reading：一个任务就覆盖了整本，返回它；多次范围翻译（或只覆盖一部分
/// 的任务）按需生成合并目录，返回虚拟任务 id。
///
/// `version`（译文版本，2026-11-18 加）：给了就读那个版本（`auto` = 自动，逐页取最新）；不给就读书的当前版本，
/// 用户没选过、或选的版本还没有可读的译文（还在翻）时读自动。
pub async fn document_reading(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    version: Option<String>,
) -> Result<DocumentReadingView, AppError> {
    let owned = OwnedReadingDeps::from(deps);
    let document_id = document_id.to_string();
    tokio::task::spawn_blocking(move || {
        let (document, source_pdf) = document_source(&owned.db, &owned.data_root, &document_id)?;
        let artifact_deps = DerivedArtifactDeps::with_pipeline_command(&owned.python_bin, &owned.pipeline_command);
        let read = |selection| {
            resolve_reading_target(
                &owned.db,
                &owned.data_root,
                artifact_deps,
                &document_id,
                &source_pdf,
                document.page_count,
                &selection,
            )
        };
        let requested = version.as_deref().map(str::trim).filter(|value| !value.is_empty());
        let (target, version_id) = match requested {
            Some("auto") => (read(auto_selection(&owned.db, &document_id)?)?, None),
            Some(version_id) => (read(version_selection(&owned.db, &document_id, version_id)?)?, Some(version_id.to_string())),
            None => match owned.db.document_current_translation_version(&document_id)? {
                Some(current) => match version_selection(&owned.db, &document_id, &current) {
                    Ok(selection) => match read(selection)? {
                        ReadingTarget::None => (read(auto_selection(&owned.db, &document_id)?)?, None),
                        target => (target, Some(current)),
                    },
                    // 当前版本被删光了任务之类：退回自动
                    Err(_) => (read(auto_selection(&owned.db, &document_id)?)?, None),
                },
                None => (read(auto_selection(&owned.db, &document_id)?)?, None),
            },
        };
        let mut view = target.view(&owned.data_root);
        view.version_id = version_id;
        Ok(view)
    })
    .await
    .map_err(|_| AppError::internal("document reading task failed"))?
}

/// GET /documents/:id/translation-coverage：只算合并计划，不生成合并目录。
///
/// 页数和阅读入口同一个来源（`merge::page_count::book_page_count`）：原文 PDF 的实际页数，
/// 读不出来退回 `documents.page_count`。原文不在磁盘上也照常回覆盖（阅读入口那时是 404）。
pub async fn document_translation_coverage(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<TranslationCoverageView, AppError> {
    let owned = OwnedReadingDeps::from(deps);
    let document_id = document_id.to_string();
    tokio::task::spawn_blocking(move || {
        let recorded = owned
            .db
            .get_document(&document_id)
            .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?
            .page_count;
        let source_pdf = document_source(&owned.db, &owned.data_root, &document_id).ok().map(|(_, path)| path);
        let page_count = book_page_count(source_pdf.as_deref(), recorded);
        translation_coverage(&owned.db, &owned.data_root, &document_id, page_count)
    })
        .await
        .map_err(|_| AppError::internal("translation coverage task failed"))?
}

/// GET /documents/:id/translation-versions：这本书的译文版本（从旧到新）和当前版本。
pub async fn document_translation_versions(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    query: TranslationVersionsQuery,
) -> Result<TranslationVersionsView, AppError> {
    let owned = OwnedReadingDeps::from(deps);
    let document_id = document_id.to_string();
    tokio::task::spawn_blocking(move || versions_view(&owned, &document_id, query.include_hidden))
        .await
        .map_err(|_| AppError::internal("translation versions task failed"))?
}

/// PUT /documents/:id/translation-version：切换当前版本（`version_id: null` 回到自动）。返回最新的版本列表。
pub async fn set_document_translation_version(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    input: SetCurrentTranslationVersionInput,
) -> Result<TranslationVersionsView, AppError> {
    let owned = OwnedReadingDeps::from(deps);
    let document_id = document_id.to_string();
    tokio::task::spawn_blocking(move || {
        set_current_translation_version(&owned.db, &document_id, input.version_id.as_deref())?;
        versions_view(&owned, &document_id, false)
    })
    .await
    .map_err(|_| AppError::internal("translation versions task failed"))?
}

/// PATCH /documents/:id/translation-versions/:version_id：改名、隐藏或恢复。返回最新的版本列表（含隐藏的）。
pub async fn patch_document_translation_version(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    version_id: &str,
    input: PatchTranslationVersionInput,
) -> Result<TranslationVersionsView, AppError> {
    let owned = OwnedReadingDeps::from(deps);
    let document_id = document_id.to_string();
    let version_id = version_id.to_string();
    tokio::task::spawn_blocking(move || {
        patch_translation_version(&owned.db, &document_id, &version_id, &input)?;
        versions_view(&owned, &document_id, true)
    })
    .await
    .map_err(|_| AppError::internal("translation versions task failed"))?
}

fn versions_view(owned: &OwnedReadingDeps, document_id: &str, include_hidden: bool) -> Result<TranslationVersionsView, AppError> {
    let source_pdf = document_source(&owned.db, &owned.data_root, document_id).ok().map(|(_, path)| path);
    translation_versions_view(&owned.db, &owned.data_root, document_id, source_pdf.as_deref(), include_hidden)
}

