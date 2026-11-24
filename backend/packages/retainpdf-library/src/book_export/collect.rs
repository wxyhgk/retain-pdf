//! 读一本书要导出的区块：阅读任务（含合并阅读）的区块，没翻译的页从 OCR 任务补原文。

use std::collections::BTreeSet;
use std::path::{Component, Path, PathBuf};

use retainpdf_api_base::error::AppError;
use retainpdf_api_base::job_loading::load_supported_job;
use retainpdf_core::models::domain::{JobSnapshot, JobStatusKind};
use retainpdf_data::db::Db;
use retainpdf_jobs::{stored_path, JobQueries, ReaderRegionItemView, ReaderRegionsView, StoredFile};

use super::render::ExportBlock;

/// 区块从哪个任务读、它的页号怎么换成文档页号和锚点。
pub(super) enum PageMapping {
    /// 普通任务：`item_id` 前缀是它的 OCR 本地页号，文档页号查 `ocr_page_numbers`。
    Local,
    /// 合并阅读的虚拟任务：`item_id` 前缀已经是文档页号；第 `k` 个元素是文档第 `k+1` 页取自
    /// 哪个任务的第几个本地页。
    Merged(Vec<Option<(String, u32)>>),
}

/// 一个参与导出的任务和它的区块指纹。
pub(super) struct RegionsSource {
    pub job_id: String,
    pub fingerprint: String,
    view: Option<ReaderRegionsView>,
}

/// 读区块的指纹；指纹和 `known` 一样时不解析区块（书没变，导出直接跳过）。
pub(super) fn regions_source(db: &Db, data_root: &Path, job_id: &str, known: Option<&str>) -> Result<RegionsSource, AppError> {
    let known: Vec<String> = known.map(str::to_string).into_iter().collect();
    let (fingerprint, view) = JobQueries::new(db, data_root).reader_regions_view_if_changed(job_id, &known)?;
    Ok(RegionsSource { job_id: job_id.to_string(), fingerprint, view })
}

impl RegionsSource {
    fn items(&mut self, db: &Db, data_root: &Path) -> Result<Vec<ReaderRegionItemView>, AppError> {
        if self.view.is_none() {
            self.view = Some(JobQueries::new(db, data_root).reader_regions_view(&self.job_id)?);
        }
        Ok(self.view.take().map(|view| view.items).unwrap_or_default())
    }
}

/// 只有原文的书（没有可读的译文）、或合并阅读里没翻译的页，从这个任务补原文：最近一次成功、
/// OCR 文档还在的任务。
pub(super) fn latest_ocr_job(db: &Db, data_root: &Path, document_id: &str) -> Result<Option<String>, AppError> {
    let mut jobs = db.list_jobs_for_document(document_id, 500, 0)?;
    jobs.retain(|job| {
        job.status == JobStatusKind::Succeeded
            && stored_path(job, data_root, StoredFile::NormalizedDocument).is_some_and(|path| path.is_file())
    });
    jobs.sort_by(|a, b| (a.created_at.as_str(), a.job_id.as_str()).cmp(&(b.created_at.as_str(), b.job_id.as_str())));
    Ok(jobs.pop().map(|job| job.job_id.clone()))
}

/// `p012-b0034` → (12, "b0034")。
fn split_item_id(item_id: &str) -> Option<(u32, &str)> {
    let rest = item_id.strip_prefix('p')?;
    let (digits, tail) = rest.split_once('-')?;
    if digits.len() < 3 || !digits.bytes().all(|b| b.is_ascii_digit()) || tail.is_empty() {
        return None;
    }
    Some((digits.parse().ok()?, tail))
}

fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    let hex = |byte: u8| (byte as char).to_digit(16).map(|value| value as u8);
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) = (hex(bytes[index + 1]), hex(bytes[index + 2])) {
                out.push(high * 16 + low);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// 区块里的图片地址（`/api/v1/jobs/<任务>/files/output/ocr/images/<路径>`）→ 书文件夹 `text/` 里能打开的路径：
/// 在数据目录里就写相对路径（`books/<书>/text/` 往上三层是数据目录），不在就写绝对路径。不复制图片。
fn image_path(url: &str, images_dir: Option<&Path>, data_root: &Path) -> Option<String> {
    const MARKER: &str = "/files/output/ocr/images/";
    let relative = percent_decode(url.split_once(MARKER)?.1.split(['?', '#']).next()?);
    let relative = Path::new(&relative);
    if relative.components().any(|part| !matches!(part, Component::Normal(_))) {
        return None;
    }
    let full: PathBuf = images_dir?.join(relative);
    if !full.is_file() {
        return None;
    }
    Some(match full.strip_prefix(data_root) {
        Ok(inside) => format!("../../../{}", inside.to_string_lossy().replace('\\', "/")),
        Err(_) => full.to_string_lossy().into_owned(),
    })
}

fn to_block(
    item: &ReaderRegionItemView,
    page: u32,
    anchor: String,
    job_id: String,
    with_translation: bool,
    images: Vec<String>,
) -> ExportBlock {
    let translated = if with_translation {
        item.translated_block_text.clone().or_else(|| item.translated.text.clone()).filter(|text| !text.trim().is_empty())
    } else {
        None
    };
    ExportBlock {
        page,
        anchor,
        job_id,
        sub_type: item.sub_type.clone(),
        heading_level: item.heading_level,
        source: item.source.text.clone().unwrap_or_default(),
        translated,
        images,
    }
}

/// 一个任务的区块换成导出块。`only_pages` 给了就只要这些文档页（补原文时用）。
pub(super) fn export_blocks(
    db: &Db,
    data_root: &Path,
    source: &mut RegionsSource,
    mapping: &PageMapping,
    with_translation: bool,
    skip_pages: &BTreeSet<u32>,
) -> Result<Vec<ExportBlock>, AppError> {
    let job: JobSnapshot = load_supported_job(db, data_root, &source.job_id)?;
    let images_dir = stored_path(&job, data_root, StoredFile::OcrImagesDir);
    let ocr_pages = job.artifacts.as_ref().map(|artifacts| artifacts.ocr_page_numbers.clone()).unwrap_or_default();
    let mut blocks = Vec::new();
    for item in source.items(db, data_root)? {
        let parsed = split_item_id(&item.item_id);
        let (page, anchor, owner) = match (mapping, parsed) {
            (PageMapping::Local, Some((local, _))) => {
                let page = ocr_pages.get(local as usize - 1).copied().unwrap_or(local);
                (page, item.item_id.clone(), source.job_id.clone())
            }
            (PageMapping::Merged(owners), Some((page, tail))) => {
                match owners.get(page as usize - 1).cloned().flatten() {
                    Some((owner, local)) => (page, format!("p{local:03}-{tail}"), owner),
                    None => (page, item.item_id.clone(), source.job_id.clone()),
                }
            }
            (_, None) => (item.source.page.max(1) as u32, item.item_id.clone(), source.job_id.clone()),
        };
        if skip_pages.contains(&page) {
            continue;
        }
        let images = item
            .asset_urls
            .iter()
            .filter_map(|url| image_path(url, images_dir.as_deref(), data_root))
            .collect();
        blocks.push(to_block(&item, page, anchor, owner, with_translation, images));
    }
    Ok(blocks)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_ids_split_into_page_and_block() {
        assert_eq!(split_item_id("p012-b0034"), Some((12, "b0034")));
        assert_eq!(split_item_id("p1234-b1"), Some((1234, "b1")));
        for bad in ["p12-b1", "x012-b1", "p012", "p012-", "pabc-b1", "detached:job:p001-b1"] {
            assert_eq!(split_item_id(bad), None, "{bad}");
        }
    }

    #[test]
    fn image_urls_map_to_files_inside_the_data_directory() {
        let root = std::env::temp_dir().join(format!("retain-book-images-{:016x}", fastrand::u64(..)));
        let images = root.join("jobs/j/md/images");
        std::fs::create_dir_all(images.join("page-3/imgs")).unwrap();
        std::fs::write(images.join("page-3/imgs/fig 1.png"), b"png").unwrap();
        let url = "/api/v1/jobs/j/files/output/ocr/images/page-3/imgs/fig%201.png";
        assert_eq!(image_path(url, Some(&images), &root).as_deref(), Some("../../../jobs/j/md/images/page-3/imgs/fig 1.png"));
        assert_eq!(image_path("/api/v1/jobs/j/files/output/ocr/images/../secret", Some(&images), &root), None);
        assert_eq!(image_path("/api/v1/jobs/j/files/output/ocr/images/page-3/missing.png", Some(&images), &root), None);
        assert_eq!(image_path("https://example.com/x.png", Some(&images), &root), None);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn percent_decoding_leaves_broken_escapes_alone() {
        assert_eq!(percent_decode("a%20b%E4%B8%AD"), "a b中");
        assert_eq!(percent_decode("100%"), "100%");
        assert_eq!(percent_decode("%zz"), "%zz");
    }
}
