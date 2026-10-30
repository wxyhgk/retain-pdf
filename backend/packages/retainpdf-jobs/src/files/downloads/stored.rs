//! 任务已经落盘的产物在哪：给任务包、书库包内部读产物用的窄出口。
//!
//! 对外下载走 `JobDownloads::open`（会按需生成派生产物、线性化 PDF、带下载文件名），内部读产物
//! 不需要这些，只要知道文件在哪。以前十几处各自调 `storage_paths::resolve_*`，每个读的人都要
//! 知道产物的存放规则；现在产物名 → 存放位置只在这里对一次，别处只说要哪个产物。
//!
//! 只是换了入口，不改语义：返回的就是 `resolve_*` 的结果，文件在不在、是不是文件，照旧由调用方判断。

use std::path::{Path, PathBuf};

use retainpdf_core::models::domain::JobSnapshot;
use retainpdf_core::storage_paths::{
    resolve_agent_editorial_events, resolve_markdown_images_dir, resolve_markdown_path, resolve_normalization_report,
    resolve_normalized_document, resolve_output_pdf, resolve_source_pdf,
    resolve_translation_debug_index, resolve_translation_manifest,
    resolve_translation_request_journal,
};

/// 内部要读的产物。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoredFile {
    /// 原文 PDF。
    SourcePdf,
    /// 译文 PDF。
    TranslatedPdf,
    /// 原文 Markdown（OCR 结果）。
    OcrMarkdown,
    /// Markdown 引用的图片所在的目录。
    OcrImagesDir,
    /// 规范化后的文档结构（document.v1.json）。
    NormalizedDocument,
    /// 规范化报告。
    NormalizationReport,
    /// 翻译清单。
    TranslationManifest,
    /// 翻译调试索引。
    TranslationDebugIndex,
    /// 翻译请求日志（jsonl）。
    TranslationRequestJournal,
    /// 翻译 agent 的编辑部事件（editorial.v1，jsonl）；legacy 引擎的任务没有。
    AgentEditorialEvents,
}

/// 这个任务的这份产物存放的位置；任务里没有登记就是 `None`。
pub fn stored_path(job: &JobSnapshot, data_root: &Path, file: StoredFile) -> Option<PathBuf> {
    match file {
        StoredFile::SourcePdf => resolve_source_pdf(job, data_root),
        StoredFile::TranslatedPdf => resolve_output_pdf(job, data_root),
        StoredFile::OcrMarkdown => resolve_markdown_path(job, data_root),
        StoredFile::OcrImagesDir => resolve_markdown_images_dir(job, data_root),
        StoredFile::NormalizedDocument => resolve_normalized_document(job, data_root),
        StoredFile::NormalizationReport => resolve_normalization_report(job, data_root),
        StoredFile::TranslationManifest => resolve_translation_manifest(job, data_root),
        StoredFile::TranslationDebugIndex => resolve_translation_debug_index(job, data_root),
        StoredFile::TranslationRequestJournal => resolve_translation_request_journal(job, data_root),
        StoredFile::AgentEditorialEvents => resolve_agent_editorial_events(job, data_root),
    }
}
