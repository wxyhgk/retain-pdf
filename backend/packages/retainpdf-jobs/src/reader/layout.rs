//! 阅读页「HTML 页」照排版结果画用的版面（2026-11-28）：`/jobs/:id/reader/layout` 清单、`…/layout/pages/:index` 一页。
//!
//! 版面是 rpr_fit 引擎排的 `layout.json`（`rpr_layout_v1`），译文 PDF 的叠加层就是只从它画出来的。渲染时 Python
//! （`render/output/rpr_fit/reader_layout.py`）按页存到译文 PDF 旁边的 `reader-layout/`：`manifest.json` 和
//! `pages/<页号>.json.gz`。这里只读，不拼别的路径：目录经 [`StoredFile::ReaderLayoutDir`] 拿，页文件名只认清单里写的、
//! 形如 `pages/00012.json.gz` 的。
//!
//! 没有版面时不报错，回 `available: false` 和原因；能补的给出补排的请求（原地重新渲染，不调模型）。

use std::io::Read;
use std::path::Path;

use serde::Deserialize;
use serde_json::{json, Value};

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::{JobSnapshot, JobStatusKind, DEFAULT_RENDER_ENGINE};
use retainpdf_core::storage_paths::MergedJobId;

use crate::files::downloads::{stored_path, StoredFile};
use crate::views::{ReaderLayoutGenerateView, ReaderLayoutPageEntryView, ReaderLayoutView};

const MANIFEST_FILE: &str = "manifest.json";
const MANIFEST_SCHEMA: &str = "reader_layout_v1";
/// 一页的 JSON 解压后最多这么大（防坏文件撑爆内存；一页正常几十 KB）。
const MAX_PAGE_BYTES: u64 = 32 * 1024 * 1024;

/// 没有版面的原因。
pub const REASON_NO_TRANSLATED_PDF: &str = "no_translated_pdf";
pub const REASON_NOT_ENGINE_ROUTE: &str = "not_engine_route";
pub const REASON_UNSUPPORTED_RENDER: &str = "unsupported_render";
pub const REASON_MERGED_READING: &str = "merged_reading";
pub const REASON_NOT_KEPT: &str = "not_kept";

#[derive(Debug, Deserialize)]
struct Manifest {
    schema: String,
    #[serde(default)]
    layout_schema: String,
    #[serde(default)]
    engine_version: String,
    #[serde(default)]
    engine_commit: String,
    #[serde(default)]
    pages: Vec<ManifestPage>,
}

#[derive(Debug, Deserialize)]
struct ManifestPage {
    index: u32,
    width: f64,
    height: f64,
    etag: String,
    #[serde(default)]
    blocks: u32,
    file: String,
}

fn layout_dir(data_root: &Path, job: &JobSnapshot) -> Option<std::path::PathBuf> {
    stored_path(job, data_root, StoredFile::ReaderLayoutDir).filter(|dir| dir.is_dir())
}

fn read_manifest(dir: &Path) -> Option<Manifest> {
    let text = std::fs::read_to_string(dir.join(MANIFEST_FILE)).ok()?;
    let manifest: Manifest = serde_json::from_str(&text).ok()?;
    (manifest.schema == MANIFEST_SCHEMA).then_some(manifest)
}

/// 清单里写的页文件名：只许 `pages/<数字>.json.gz`，不许跳出目录。
fn page_file_is_safe(file: &str) -> bool {
    file.strip_prefix("pages/")
        .and_then(|name| name.strip_suffix(".json.gz"))
        .is_some_and(|stem| !stem.is_empty() && stem.bytes().all(|b| b.is_ascii_digit()))
}

fn normalized_engine(job: &JobSnapshot) -> String {
    let engine = job.render_options().engine.trim().to_ascii_lowercase();
    if engine.is_empty() {
        DEFAULT_RENDER_ENGINE.to_string()
    } else {
        engine
    }
}

/// 引擎排不了的渲染设置（和 Python `render/workflow/engine_dispatch.py` 的 `_precheck` 一致）：双栏对照、字体不是思源宋体。
fn engine_cannot_render(job: &JobSnapshot) -> bool {
    let render = job.render_options();
    let family = render.typst_font_family.trim().to_ascii_lowercase();
    render.render_mode.trim() == "dual"
        || !(family.is_empty() || family == "source han serif sc" || family == "noto serif cjk sc")
}

fn generate_request(base_url: &str, job: &JobSnapshot, switch_engine: bool) -> ReaderLayoutGenerateView {
    let mut body = json!({ "stage": "render" });
    if switch_engine {
        body["overrides"] = json!({ "render": { "engine": DEFAULT_RENDER_ENGINE } });
    }
    ReaderLayoutGenerateView {
        method: "POST".to_string(),
        url: format!("{base_url}/api/v1/jobs/{}/actions/retry-stage", job.job_id),
        body,
    }
}

fn unavailable(reason: &str, generate: Option<ReaderLayoutGenerateView>) -> ReaderLayoutView {
    ReaderLayoutView {
        available: false,
        reason: Some(reason.to_string()),
        schema: None,
        engine_version: None,
        engine_commit: None,
        page_count: 0,
        pages: Vec::new(),
        fonts: Vec::new(),
        generate,
    }
}

pub(crate) fn load_reader_layout_view(data_root: &Path, job: &JobSnapshot, base_url: &str) -> ReaderLayoutView {
    if MergedJobId::parse(&job.job_id).is_some() {
        return unavailable(REASON_MERGED_READING, None);
    }
    let has_pdf = stored_path(job, data_root, StoredFile::TranslatedPdf).is_some_and(|path| path.is_file());
    if has_pdf {
        if let Some(manifest) = layout_dir(data_root, job).and_then(|dir| read_manifest(&dir)) {
            let pages: Vec<ReaderLayoutPageEntryView> = manifest
                .pages
                .into_iter()
                .filter(|page| page_file_is_safe(&page.file))
                .map(|page| ReaderLayoutPageEntryView {
                    url: format!("{base_url}/api/v1/jobs/{}/reader/layout/pages/{}", job.job_id, page.index),
                    index: page.index,
                    width: page.width,
                    height: page.height,
                    etag: page.etag,
                    blocks: page.blocks,
                })
                .collect();
            return ReaderLayoutView {
                available: true,
                reason: None,
                schema: Some(manifest.layout_schema),
                engine_version: Some(manifest.engine_version),
                engine_commit: Some(manifest.engine_commit),
                page_count: pages.len(),
                pages,
                fonts: Vec::new(),
                generate: None,
            };
        }
    }
    let idle = !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running);
    // 重新渲染要有译文 PDF 可重排；在跑的任务等它跑完再说（跑完自己就会有）
    let can_generate = |switch_engine: bool| {
        (idle && has_pdf && !engine_cannot_render(job)).then(|| generate_request(base_url, job, switch_engine))
    };
    if !has_pdf {
        return unavailable(REASON_NO_TRANSLATED_PDF, None);
    }
    if engine_cannot_render(job) {
        return unavailable(REASON_UNSUPPORTED_RENDER, None);
    }
    let engine = normalized_engine(job);
    if engine != DEFAULT_RENDER_ENGINE && engine != "rpr" {
        return unavailable(REASON_NOT_ENGINE_ROUTE, can_generate(true));
    }
    unavailable(REASON_NOT_KEPT, can_generate(false))
}

/// 清单里这页的 etag（304 用，不读页文件）。
pub(crate) fn reader_layout_page_etag(data_root: &Path, job: &JobSnapshot, index: u32) -> Option<String> {
    let manifest = read_manifest(&layout_dir(data_root, job)?)?;
    manifest.pages.into_iter().find(|page| page.index == index).map(|page| page.etag)
}

/// 一页版面：`(etag, 这页的 JSON)`；没有这页是 404。
pub(crate) fn load_reader_layout_page(
    data_root: &Path,
    job: &JobSnapshot,
    index: u32,
) -> Result<(String, Value), AppError> {
    let not_found = || AppError::not_found(format!("no reader layout for page {index}"));
    let dir = layout_dir(data_root, job).ok_or_else(not_found)?;
    let manifest = read_manifest(&dir).ok_or_else(not_found)?;
    let page = manifest
        .pages
        .into_iter()
        .find(|page| page.index == index && page_file_is_safe(&page.file))
        .ok_or_else(not_found)?;
    let file = std::fs::File::open(dir.join(&page.file)).map_err(|_| not_found())?;
    let mut text = Vec::new();
    flate2::read::GzDecoder::new(file)
        .take(MAX_PAGE_BYTES)
        .read_to_end(&mut text)
        .map_err(|err| AppError::internal(format!("reader layout page {index} unreadable: {err}")))?;
    let value: Value = serde_json::from_slice(&text)
        .map_err(|err| AppError::internal(format!("reader layout page {index} is not JSON: {err}")))?;
    Ok((page.etag, value))
}

#[cfg(test)]
mod tests {
    use super::page_file_is_safe;

    #[test]
    fn only_numbered_page_files_inside_the_layout_dir_are_read() {
        assert!(page_file_is_safe("pages/00012.json.gz"));
        for bad in ["pages/../manifest.json.gz", "../pages/1.json.gz", "pages/.json.gz", "pages/1.json", "/etc/1.json.gz", "pages/1a.json.gz"] {
            assert!(!page_file_is_safe(bad), "{bad}");
        }
    }
}
