use std::path::{Path, PathBuf};

use crate::models::domain::{JobArtifactRecord, JobSnapshot};

use super::constants::{
    AI_BOARD_DIR_NAME, AI_CANVAS_FILE_NAME, AI_READING_PATH_FILE_NAME,
    OUTPUT_AI_DIR_NAME,
    OUTPUT_ARTIFACTS_DIR_NAME, OUTPUT_LOGS_DIR_NAME, OUTPUT_MARKDOWN_DIR_NAME,
    OUTPUT_RENDERED_DIR_NAME, OUTPUT_TRANSLATED_DIR_NAME, OUTPUT_TYPST_BOOK_OVERLAYS_DIR_NAME,
    OUTPUT_TYPST_DIR_NAME, TRANSLATION_MANIFEST_FILE_NAME, TRANSLATION_REQUEST_JOURNAL_FILE_NAME,
};
use super::path_ops::resolve_data_path;

const PIPELINE_EVENTS_JSONL_FILE_NAME: &str = "pipeline_events.jsonl";
const LEGACY_EVENTS_JSONL_FILE_NAME: &str = "events.jsonl";

pub fn resolve_markdown_path(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let root = resolve_job_root(job, data_root)?;
    let published = root.join(OUTPUT_MARKDOWN_DIR_NAME).join("full.md");
    published.exists().then_some(published)
}

pub fn resolve_markdown_images_dir(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let root = resolve_job_root(job, data_root)?;
    let published = root.join(OUTPUT_MARKDOWN_DIR_NAME).join("images");
    published.exists().then_some(published)
}

/// 这个任务的译文所依据的那份 OCR 的图片目录：`<OCR 任务根>/md/images`。
///
/// OCR 文档里的图片路径（`md/images/page-3/…`）是相对**产出 OCR 的那个任务**的根目录的。
/// 复用 OCR 的任务自己的 `md/` 是空的（`resolve_markdown_images_dir` 会返回 `None`），
/// 所以先从 `normalized_document_json` 的位置往上推三级；推不出来才退回本任务的目录。
pub fn resolve_ocr_markdown_images_dir(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    resolve_normalized_document(job, data_root)
        .as_deref()
        .and_then(|document| document.parent()?.parent()?.parent())
        .map(|ocr_root| ocr_root.join(OUTPUT_MARKDOWN_DIR_NAME).join("images"))
        .filter(|images| images.is_dir())
        .or_else(|| resolve_markdown_images_dir(job, data_root))
}

pub fn resolve_job_root(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    resolve_data_path(data_root, job_root).ok()
}

pub fn resolve_markdown_bundle_zip(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = resolve_job_root(job, data_root)?;
    Some(
        job_root
            .join(OUTPUT_ARTIFACTS_DIR_NAME)
            .join(format!("{}-markdown.zip", job.job_id)),
    )
}

pub fn resolve_output_pdf(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.output_pdf.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

pub fn resolve_source_pdf(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.source_pdf.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

pub fn resolve_normalized_document(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.normalized_document_json.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

pub fn resolve_normalization_report(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.normalization_report_json.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

/// `<job>/ai/<file_name>` —— agent 自己写出来的产物。
///
/// **私有，且 `file_name` 只接受常量。** `ai/` 是 agent 可写的目录，一旦让调用方
/// 决定读哪个文件，就等于把任意文件读取暴露给前端。对外的每个产物各有一个不带
/// 文件名参数的 `pub fn`，加产物就加一个。
fn resolve_ai_artifact(
    job: &JobSnapshot,
    data_root: &Path,
    file_name: &'static str,
) -> Option<PathBuf> {
    Some(resolve_ai_dir(job, data_root)?.join(file_name))
}

/// `<job>/ai/` —— agent 工作区本身。
///
/// 返回目录是为了让调用方能**整体**处理这个工作区（重译时把上一次的产物接力
/// 过来）。逐个产物的 `pub fn` 不够用：接力要连 `board/` 里的任意文件一起搬，
/// 而那些文件名是 agent 定的，这里列不出来。
///
/// 不接受文件名参数 —— 拼文件名的职责仍然留在上面那个私有函数和 api 侧的
/// `ai_board.rs` 里。
pub fn resolve_ai_dir(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    // 合并结果的 AI 工作区按文档放，不跟着指纹变（见 `MergedJobId::ai_dir`）。
    if let Some(merged) = super::merged_job::MergedJobId::parse(&job.job_id) {
        return Some(merged.ai_dir(data_root));
    }
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    Some(
        resolve_data_path(data_root, job_root)
            .ok()?
            .join(OUTPUT_AI_DIR_NAME),
    )
}

/// `<job>/ai/reading-path.v1.json` —— agent 写的阅读路径。
pub fn resolve_ai_reading_path(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    resolve_ai_artifact(job, data_root, AI_READING_PATH_FILE_NAME)
}

/// `<job>/ai/canvas.v1.json` —— agent 画的概念图。
pub fn resolve_ai_canvas(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    resolve_ai_artifact(job, data_root, AI_CANVAS_FILE_NAME)
}

/// `<job>/ai/board/` —— agent 的画板目录。
///
/// 返回的是**目录**，不是文件。里面具体读哪个文件由调用方决定，所以文件名的
/// 校验必须在调用方做 —— 见 api 侧 `services/jobs/downloads/ai_board.rs`，
/// 那里挡了路径穿越、符号链接和类型。
pub fn resolve_ai_board_dir(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    Some(resolve_ai_dir(job, data_root)?.join(AI_BOARD_DIR_NAME))
}

pub fn resolve_typst_source(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    Some(
        resolve_data_path(data_root, job_root)
            .ok()?
            .join(OUTPUT_RENDERED_DIR_NAME)
            .join(OUTPUT_TYPST_DIR_NAME)
            .join(OUTPUT_TYPST_BOOK_OVERLAYS_DIR_NAME)
            .join("book-overlay.typ"),
    )
}

pub fn resolve_typst_pdf(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    Some(
        resolve_data_path(data_root, job_root)
            .ok()?
            .join(OUTPUT_RENDERED_DIR_NAME)
            .join(OUTPUT_TYPST_DIR_NAME)
            .join(OUTPUT_TYPST_BOOK_OVERLAYS_DIR_NAME)
            .join("book-overlay.pdf"),
    )
}

pub fn resolve_translation_manifest(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let translations_dir = job.artifacts.as_ref()?.translations_dir.as_ref()?;
    let path = resolve_data_path(data_root, translations_dir)
        .ok()?
        .join(TRANSLATION_MANIFEST_FILE_NAME);
    path.exists().then_some(path)
}

pub fn resolve_translation_diagnostics(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = resolve_job_root(job, data_root)?;
    let path = job_root
        .join(OUTPUT_ARTIFACTS_DIR_NAME)
        .join("translation_diagnostics.json");
    path.exists().then_some(path)
}

/// `<job>/artifacts/translation_qa.v1.json` —— 确定性翻译 QA 报告（渲染后会带上排版结果重算）。
pub fn resolve_translation_qa(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = resolve_job_root(job, data_root)?
        .join(OUTPUT_ARTIFACTS_DIR_NAME)
        .join("translation_qa.v1.json");
    path.exists().then_some(path)
}

/// `<job>/artifacts/fit_report.v1.json` —— 排版 fit 报告（每块最终字号、应急档、溢出）。
pub fn resolve_fit_report(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = resolve_job_root(job, data_root)?
        .join(OUTPUT_ARTIFACTS_DIR_NAME)
        .join("fit_report.v1.json");
    path.exists().then_some(path)
}

pub fn resolve_translation_request_journal(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let root = resolve_job_root(job, data_root)?;
    let path = root
        .join(OUTPUT_TRANSLATED_DIR_NAME)
        .join(TRANSLATION_REQUEST_JOURNAL_FILE_NAME);
    path.is_file().then_some(path)
}

pub fn resolve_pipeline_summary(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.summary.as_ref()?;
    let path = resolve_data_path(data_root, path).ok()?;
    path.exists().then_some(path)
}

pub fn resolve_translation_debug_index(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = resolve_job_root(job, data_root)?;
    let path = job_root
        .join(OUTPUT_ARTIFACTS_DIR_NAME)
        .join("translation_debug_index.json");
    path.exists().then_some(path)
}

pub fn resolve_registered_artifact_path(
    data_root: &Path,
    artifact: &JobArtifactRecord,
) -> anyhow::Result<PathBuf> {
    resolve_data_path(data_root, &artifact.relative_path)
}

pub fn resolve_events_jsonl(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    let root = resolve_data_path(data_root, job_root).ok()?;
    let logs_dir = root.join(OUTPUT_LOGS_DIR_NAME);
    let pipeline_events = logs_dir.join(PIPELINE_EVENTS_JSONL_FILE_NAME);
    if pipeline_events.exists() {
        return Some(pipeline_events);
    }
    let legacy_events = logs_dir.join(LEGACY_EVENTS_JSONL_FILE_NAME);
    legacy_events.exists().then_some(legacy_events)
}
