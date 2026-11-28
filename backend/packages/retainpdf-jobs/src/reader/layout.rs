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
use retainpdf_files::FileDownload;

use crate::views::{
    ReaderLayoutBackgroundView, ReaderLayoutFontView, ReaderLayoutGenerateView, ReaderLayoutPageEntryView, ReaderLayoutView,
};

const MANIFEST_FILE: &str = "manifest.json";
const MANIFEST_SCHEMA: &str = "reader_layout_v1";
/// 底图文件名，和 Python `reader_layout.py` 的 `BACKGROUND_FILE` 一致。
const BACKGROUND_FILE: &str = "background.pdf";
/// 一页的 JSON 解压后最多这么大（防坏文件撑爆内存；一页正常几十 KB）。
const MAX_PAGE_BYTES: u64 = 32 * 1024 * 1024;

/// 没有版面的原因。
pub const REASON_NO_TRANSLATED_PDF: &str = "no_translated_pdf";
pub const REASON_NOT_ENGINE_ROUTE: &str = "not_engine_route";
pub const REASON_UNSUPPORTED_RENDER: &str = "unsupported_render";
pub const REASON_MERGED_READING: &str = "merged_reading";
pub const REASON_NOT_KEPT: &str = "not_kept";
/// 任务在排队或在跑（比如正在补排）：跑完再看。
pub const REASON_JOB_ACTIVE: &str = "job_active";
/// 旧书排进了自动补排的队列，还没开跑（后端 `app/reader_layout_backfill.rs`，一次补一本）。
pub const REASON_BACKFILL_QUEUED: &str = "backfill_queued";

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
    /// 底图（去掉原字的渲染源，只含有版面的页）；渲染源就是原件时 null。
    #[serde(default)]
    background: Option<ManifestBackground>,
    /// 按书切的字体子集（woff2），主字体在前；没装 fontTools 时空的。
    #[serde(default)]
    fonts: Vec<ManifestFont>,
}

#[derive(Debug, Deserialize)]
struct ManifestFont {
    key: String,
    #[serde(default)]
    family: String,
    #[serde(default)]
    weight: u32,
    file: String,
    #[serde(default)]
    etag: String,
}

/// 版面目录里可以按名字取的文件：字体子集、公式 SVG。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReaderLayoutAsset {
    Font,
    Math,
}

/// 字体子集的文件名：`<key>.woff2`，key 只有字母、数字、`-`、`_`。
fn font_file_name(key: &str) -> Option<String> {
    (!key.is_empty() && key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_'))
        .then(|| format!("{key}.woff2"))
}

/// 公式 SVG 的文件名：16 位十六进制 + `.svg`（引擎 MathStore 起的名）。
fn math_file_is_safe(name: &str) -> bool {
    name.strip_suffix(".svg")
        .is_some_and(|stem| stem.len() == 16 && stem.bytes().all(|b| b.is_ascii_hexdigit()))
}

#[derive(Debug, Deserialize)]
struct ManifestBackground {
    file: String,
    #[serde(default)]
    pages: Vec<u32>,
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
    // 原地重新渲染：retry-stage 不写 create_new_job 时 render 默认新建任务，阅读页就等不到这个任务的版面
    let mut body = json!({ "stage": "render", "create_new_job": false });
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
        background: None,
        fonts: Vec::new(),
        generate,
    }
}

pub(crate) fn load_reader_layout_view(data_root: &Path, job: &JobSnapshot, base_url: &str) -> ReaderLayoutView {
    if MergedJobId::parse(&job.job_id).is_some() {
        return unavailable(REASON_MERGED_READING, None);
    }
    let idle = !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running);
    if !idle {
        // 重新渲染期间上一份 PDF 挪开了，版面也正在换：跑完再看
        return unavailable(REASON_JOB_ACTIVE, None);
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
            let background = manifest
                .background
                .filter(|background| background.file == BACKGROUND_FILE)
                .map(|background| ReaderLayoutBackgroundView {
                    url: format!("{base_url}/api/v1/jobs/{}/reader/layout/background", job.job_id),
                    pages: background.pages,
                });
            let fonts = manifest
                .fonts
                .into_iter()
                .filter_map(|font| {
                    let name = font_file_name(&font.key)?;
                    (font.file == format!("fonts/{name}")).then(|| ReaderLayoutFontView {
                        url: format!(
                            "{base_url}/api/v1/jobs/{}/reader/layout/fonts/{name}?v={}",
                            job.job_id, font.etag
                        ),
                        key: font.key,
                        family: font.family,
                        weight: font.weight,
                    })
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
                background,
                fonts,
                generate: None,
            };
        }
    }
    // 重新渲染要有译文 PDF 可重排
    let can_generate = |switch_engine: bool| {
        (has_pdf && !engine_cannot_render(job)).then(|| generate_request(base_url, job, switch_engine))
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

/// 底图 PDF（`reader/layout/background`）：清单里写了才有，否则 404。按 PDF 发，支持分段读。
pub(crate) fn reader_layout_background(data_root: &Path, job: &JobSnapshot) -> Result<FileDownload, AppError> {
    let not_found = || AppError::not_found("no reader layout background");
    let dir = layout_dir(data_root, job).ok_or_else(not_found)?;
    let manifest = read_manifest(&dir).ok_or_else(not_found)?;
    manifest
        .background
        .filter(|background| background.file == BACKGROUND_FILE)
        .ok_or_else(not_found)?;
    let path = dir.join(BACKGROUND_FILE);
    if !path.is_file() {
        return Err(not_found());
    }
    Ok(FileDownload::new(path, "application/pdf", None)
        .with_inline_name(format!("{}-background.pdf", job.job_id))
        .with_job_id_header(job.job_id.clone()))
}

/// 版面目录里的字体子集（`fonts/<key>.woff2`，只认清单里列了的）、公式 SVG（`math/<16 位十六进制>.svg`）。
/// 文件名带内容指纹或地址带 `?v=`，重新渲染就换，所以让浏览器长缓存。
pub(crate) fn reader_layout_asset(
    data_root: &Path,
    job: &JobSnapshot,
    asset: ReaderLayoutAsset,
    name: &str,
) -> Result<FileDownload, AppError> {
    let not_found = || AppError::not_found(format!("no reader layout file {name}"));
    let dir = layout_dir(data_root, job).ok_or_else(not_found)?;
    let (relative, content_type) = match asset {
        ReaderLayoutAsset::Font => {
            let manifest = read_manifest(&dir).ok_or_else(not_found)?;
            let listed = manifest
                .fonts
                .iter()
                .any(|font| font_file_name(&font.key).as_deref() == Some(name) && font.file == format!("fonts/{name}"));
            if !listed {
                return Err(not_found());
            }
            (format!("fonts/{name}"), "font/woff2")
        }
        ReaderLayoutAsset::Math => {
            if !math_file_is_safe(name) {
                return Err(not_found());
            }
            (format!("math/{name}"), "image/svg+xml")
        }
    };
    let path = dir.join(relative);
    if !path.is_file() {
        return Err(not_found());
    }
    let mut download = FileDownload::new(path, content_type, None);
    download.cache_control = Some("private, max-age=31536000, immutable");
    Ok(download)
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
    fn only_plain_font_keys_and_hashed_math_names_are_served() {
        use super::{font_file_name, math_file_is_safe};
        assert_eq!(font_file_name("SourceHanSerifSC-Regular").as_deref(), Some("SourceHanSerifSC-Regular.woff2"));
        for bad in ["", "../x", "a/b", "a.b", "a b"] {
            assert_eq!(font_file_name(bad), None, "{bad}");
        }
        assert!(math_file_is_safe("00112233aabbccdd.svg"));
        for bad in ["00112233aabbccd.svg", "00112233aabbccdg.svg", "../00112233aabbccdd.svg", "00112233aabbccdd.svgz"] {
            assert!(!math_file_is_safe(bad), "{bad}");
        }
    }

    #[test]
    fn only_numbered_page_files_inside_the_layout_dir_are_read() {
        assert!(page_file_is_safe("pages/00012.json.gz"));
        for bad in ["pages/../manifest.json.gz", "../pages/1.json.gz", "pages/.json.gz", "pages/1.json", "/etc/1.json.gz", "pages/1a.json.gz"] {
            assert!(!page_file_is_safe(bad), "{bad}");
        }
    }
}
