//! 「这本书该打开哪个任务」——阅读器和下载的入口。
//!
//! 阅读器、下载、预览全是按任务读的（`/jobs/:id/...`），而且几乎都经过同一个加载函数
//! `job_loading::load_supported_job`。所以合并结果不另开一套接口，而是给它一个**虚拟任务
//! id**：`merged-<文档 id>-<指纹前 16 位>`。读接口认出它，拼一个产物指向合并目录的任务
//! 快照；写接口（重试、取消、删除）走的是 `load_job_or_404`，查不到它，自然拒绝。
//!
//! # 生成和读取分开
//!
//! - **生成**在 `resolve_reading_target`：要调 Python 子命令，需要流水线命令的配置，只有
//!   专门的入口接口拿得到。
//! - **读取**在 `job_loading::load_virtual_job`：虚拟 id 带着指纹，直接对应一个不可变目录，只读目录里的
//!   `reading.json`，不重算计划、不生成。阅读器打开期间有新任务完成也不会把正在看的这份
//!   换掉；重新打开才会拿到新的。


use std::path::Path;

use serde::Serialize;

use retainpdf_data::db::Db;
use retainpdf_api_base::error::AppError;
use retainpdf_api_base::job_loading::{contributing_jobs, MergedTranslation, ReadingSidecar, VirtualJobId, SIDECAR};
use retainpdf_core::models::domain::JobSnapshot;
use retainpdf_files::DerivedArtifactDeps;
use retainpdf_core::storage_paths::{resolve_data_path, to_relative_data_path};

use super::build::{ensure_merged_translation, JobInputs};
use super::page_count::book_page_count;
use super::plan::{merge_plan, PageSource};
use super::sources::{job_merge_source, MergeSource};

// ── 每个任务的排序和产物 ────────────────────────────────────────────────────

/// 产出这份译文的那个任务的提交时间。
///
/// 单独建的 render 任务（换字体重新排版）没有产出新译文，它的 `translations_dir` 指向
/// 产出者的 `translated/`。按产出者排，「重新排版不算重新翻译」。产出者找不到（被删了）
/// 就退回自己的提交时间。
fn producer_created_at(job: &JobSnapshot, jobs: &[JobSnapshot], data_root: &Path) -> String {
    let resolve = |raw: Option<&String>| raw.and_then(|raw| resolve_data_path(data_root, raw).ok());
    let Some(translations) = resolve(job.artifacts.as_ref().and_then(|a| a.translations_dir.as_ref()))
    else {
        return job.created_at.clone();
    };
    jobs.iter()
        .find(|candidate| {
            resolve(candidate.artifacts.as_ref().and_then(|a| a.job_root.as_ref()))
                .is_some_and(|root| translations.starts_with(&root))
        })
        .map(|producer| producer.created_at.clone())
        .unwrap_or_else(|| job.created_at.clone())
}

pub(crate) fn document_merge_sources(jobs: &[JobSnapshot], data_root: &Path) -> Vec<MergeSource> {
    jobs.iter()
        .filter_map(|job| job_merge_source(job, data_root, &producer_created_at(job, jobs, data_root)))
        .collect()
}

/// 计划里只有一个任务、而且它按顺序覆盖了整本：直接打开它，不用合并。
///
/// 只覆盖一部分的单个任务**也要合并**：它的输出 PDF 只有那几页，阅读器对照、双栏对照
/// 都按页序号配对，从中间开始的范围今天就是错页的。合并出来的整本长度 PDF 正好修好它。
pub(crate) fn single_whole_document_job(plan: &[PageSource]) -> Option<&str> {
    let first = match plan.first()? {
        PageSource::Job { job_id, .. } => job_id.as_str(),
        PageSource::Original => return None,
    };
    plan.iter()
        .enumerate()
        .all(|(index, source)| {
            matches!(source, PageSource::Job { job_id, local_index }
                if job_id == first && *local_index == index)
        })
        .then_some(first)
}

// ── 生成 ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ReadingTarget {
    /// 没有任何可读的译文任务。
    None,
    /// 一个任务就覆盖了整本：打开它本身。
    Job(String),
    /// 打开合并结果。
    Merged { job_id: String, merged: MergedTranslation },
}

/// 读哪份译文（译文版本 v30）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ReadingSelection {
    /// 自动：逐页取最新（和以前一样）。`excluded` 里的任务（隐藏版本的）不用。
    Auto { excluded: Vec<String> },
    /// 一个译文版本：`layers[0]` 是最底下的来源版本，最后一层是要读的版本，上层的页盖住下层；
    /// 层内照旧逐页取最新（同一份译文的重新排版、原地精修）。
    Version { layers: Vec<Vec<String>> },
}

/// 按选择留下参与合并的任务。版本模式把层号放在排序键最前面，上层的页一定盖住下层，和提交先后无关。
pub(crate) fn select_sources(sources: Vec<MergeSource>, selection: &ReadingSelection) -> Vec<MergeSource> {
    match selection {
        ReadingSelection::Auto { excluded } => {
            sources.into_iter().filter(|source| !excluded.contains(&source.ranked.rank.job_id)).collect()
        }
        ReadingSelection::Version { layers } => sources
            .into_iter()
            .filter_map(|mut source| {
                let layer = layers.iter().position(|jobs| jobs.contains(&source.ranked.rank.job_id))?;
                source.ranked.rank.producer_created_at = format!("{layer:04}|{}", source.ranked.rank.producer_created_at);
                Some(source)
            })
            .collect(),
    }
}

/// `recorded_page_count` 是数据库里记的页数（`documents.page_count`，0 表示没记），原文 PDF
/// 读不出页数时才用；和翻译覆盖走同一个 [`book_page_count`]，两边说的页数一致。
pub(crate) fn resolve_reading_target(
    db: &Db,
    data_root: &Path,
    deps: DerivedArtifactDeps<'_>,
    document_id: &str,
    source_pdf: &Path,
    recorded_page_count: u32,
    selection: &ReadingSelection,
) -> Result<ReadingTarget, AppError> {
    let jobs = db.list_jobs_for_document(document_id, 500, 0)?;
    let sources = select_sources(document_merge_sources(&jobs, data_root), selection);
    if sources.is_empty() {
        return Ok(ReadingTarget::None);
    }
    let page_count = book_page_count(Some(source_pdf), recorded_page_count);
    if page_count == 0 {
        return Err(AppError::internal(format!("read source pdf {}: no page count", source_pdf.display())));
    }
    let ranked: Vec<_> = sources.iter().map(|source| source.ranked.clone()).collect();
    let plan = merge_plan(page_count, &ranked);
    if let Some(job_id) = single_whole_document_job(&plan) {
        return Ok(ReadingTarget::Job(job_id.to_string()));
    }
    let inputs: JobInputs = sources
        .iter()
        .map(|source| (source.ranked.rank.job_id.clone(), source.inputs.clone()))
        .collect();
    let merged = ensure_merged_translation(deps, data_root, document_id, source_pdf, &plan, &inputs)?;
    write_sidecar_once(&merged, data_root, document_id, &sources, &plan, page_count, source_pdf)?;
    let fingerprint = merged
        .root
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::internal("merged root has no name"))?
        .to_string();
    let job_id = VirtualJobId { document_id: document_id.to_string(), fingerprint }.format();
    Ok(ReadingTarget::Merged { job_id, merged })
}

/// 每个文档页取自哪个任务的第几个 OCR 本地页（都从 1 起）；没有任务覆盖的页是 `None`。
///
/// 和 [`resolve_reading_target`] 用同一份合并计划。合并目录里的页号、`item_id` 前缀已经改成了文档页号
/// （`merge_translated_artifacts.py`），书文件夹导出要把它们换回「真正有这一页的任务」的本地页号：改译文、
/// 全文检索的跳转都按那个任务找。
pub(crate) fn page_owners(
    db: &Db,
    data_root: &Path,
    document_id: &str,
    source_pdf: &Path,
    recorded_page_count: u32,
    selection: &ReadingSelection,
) -> Result<Vec<Option<(String, u32)>>, AppError> {
    let jobs = db.list_jobs_for_document(document_id, 500, 0)?;
    let sources = select_sources(document_merge_sources(&jobs, data_root), selection);
    let page_count = book_page_count(Some(source_pdf), recorded_page_count);
    let ranked: Vec<_> = sources.iter().map(|source| source.ranked.clone()).collect();
    let plan = merge_plan(page_count, &ranked);
    Ok(plan
        .iter()
        .enumerate()
        .map(|(index, page)| match page {
            PageSource::Original => None,
            PageSource::Job { job_id, .. } => {
                let source = sources.iter().find(|source| &source.ranked.rank.job_id == job_id)?;
                let document_page = index as u32 + 1;
                let local = source.inputs.ocr_page_numbers.iter().position(|page| *page == document_page)?;
                Some((job_id.clone(), local as u32 + 1))
            }
        })
        .collect())
}

fn write_sidecar_once(
    merged: &MergedTranslation,
    data_root: &Path,
    document_id: &str,
    sources: &[MergeSource],
    plan: &[PageSource],
    page_count: u32,
    source_pdf: &Path,
) -> Result<(), AppError> {
    let path = merged.root.join(SIDECAR);
    if path.is_file() {
        return Ok(());
    }
    let mut contributing: Vec<&MergeSource> = Vec::new();
    for source in plan {
        if let PageSource::Job { job_id, .. } = source {
            if !contributing.iter().any(|s| &s.ranked.rank.job_id == job_id) {
                let found = sources.iter().find(|s| &s.ranked.rank.job_id == job_id);
                contributing.extend(found);
            }
        }
    }
    let base = contributing
        .iter()
        .max_by(|a, b| a.ranked.rank.cmp(&b.ranked.rank))
        .ok_or_else(|| AppError::internal("merged translation has no contributing job"))?;
    let sidecar = ReadingSidecar {
        document_id: document_id.to_string(),
        base_job_id: base.ranked.rank.job_id.clone(),
        contributing_job_ids: contributing.iter().map(|s| s.ranked.rank.job_id.clone()).collect(),
        page_count,
        source_pdf: to_relative_data_path(data_root, source_pdf)
            .unwrap_or_else(|_| source_pdf.to_string_lossy().into_owned()),
    };
    // 同一个指纹的并发请求可能同时写：先写临时文件再 rename，内容一样，谁赢都对。
    let temporary = merged.root.join(format!(".{SIDECAR}.{:016x}", fastrand::u64(..)));
    std::fs::write(&temporary, serde_json::to_vec_pretty(&sidecar).map_err(|e| AppError::internal(e.to_string()))?)?;
    std::fs::rename(&temporary, &path)?;
    Ok(())
}


/// `GET /api/v1/documents/:id/reading` 的回包。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DocumentReadingView {
    /// 阅读器该打开的任务 id；`None` 表示这本书还没有可读的译文。
    pub job_id: Option<String>,
    /// 是不是多次翻译拼成的。
    pub merged: bool,
    /// 拼成这份译文的任务，按页序首次出现的顺序；不是合并时就是那一个任务。
    pub contributing_job_ids: Vec<String>,
    /// 读的是哪个译文版本；`None` = 自动（逐页取最新）。2026-11-18 加。
    pub version_id: Option<String>,
}

impl ReadingTarget {
    pub(crate) fn view(&self, data_root: &Path) -> DocumentReadingView {
        match self {
            Self::None => DocumentReadingView { job_id: None, merged: false, contributing_job_ids: vec![], version_id: None },
            Self::Job(job_id) => DocumentReadingView {
                job_id: Some(job_id.clone()),
                merged: false,
                contributing_job_ids: vec![job_id.clone()],
                version_id: None,
            },
            Self::Merged { job_id, .. } => DocumentReadingView {
                job_id: Some(job_id.clone()),
                merged: true,
                contributing_job_ids: contributing_jobs(data_root, job_id).unwrap_or_default(),
                version_id: None,
            },
        }
    }
}

#[cfg(test)]
#[path = "reading_tests.rs"]
mod tests;
