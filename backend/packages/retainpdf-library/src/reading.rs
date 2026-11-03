//! 一本书「该读哪里」相关的两个读接口：阅读入口、翻译覆盖（合集的 agent 工作区 2026-11-03 跟 AI 服务一起删了）。
//!
//! 以前这几段直接写在路由里（自己拿 state.db / state.config、全路径调 services::library::merge），
//! 违反了路由只经 application facade 的边界（check_architecture.py）。挪到这里，路由只传
//! LibraryDeps。都要跑子进程或读 PDF 页数，放进阻塞线程。

use retainpdf_api_base::error::AppError;
use retainpdf_files::DerivedArtifactDeps;
use crate::merge::coverage::{translation_coverage, TranslationCoverageView};
use crate::merge::page_count::book_page_count;
use crate::merge::reading::{resolve_reading_target, DocumentReadingView};

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
pub async fn document_reading(
    deps: &LibraryDeps<'_>,
    document_id: &str,
) -> Result<DocumentReadingView, AppError> {
    let owned = OwnedReadingDeps::from(deps);
    let document_id = document_id.to_string();
    tokio::task::spawn_blocking(move || {
        let (document, source_pdf) = document_source(&owned.db, &owned.data_root, &document_id)?;
        let artifact_deps = DerivedArtifactDeps::with_pipeline_command(&owned.python_bin, &owned.pipeline_command);
        resolve_reading_target(
            &owned.db,
            &owned.data_root,
            artifact_deps,
            &document_id,
            &source_pdf,
            document.page_count,
        )
        .map(|target| target.view(&owned.data_root))
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
