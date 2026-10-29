use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use lopdf::Document;

// 页范围的唯一实现在 retainpdf-core（按页计费也用它）。
use crate::models::request::parse_page_ranges;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct PreparedSourcePdf {
    pub(super) path: PathBuf,
    pub(super) selected_pages: Vec<u32>,
    pub(super) total_pages: u32,
}

impl PreparedSourcePdf {
    pub(super) fn is_subset(&self) -> bool {
        self.selected_pages.len() < self.total_pages as usize
    }

    pub(super) fn provider_page_ranges(&self) -> &str {
        if self.is_subset() {
            ""
        } else {
            "all"
        }
    }
}

pub(super) fn prepare_uploaded_source_pdf(
    upload_path: &Path,
    source_dir: &Path,
    page_ranges: &str,
) -> Result<PreparedSourcePdf> {
    let upload_file_name = upload_path
        .file_name()
        .ok_or_else(|| anyhow!("invalid upload filename"))?;
    let target_path = source_dir.join(upload_file_name);

    let mut source_doc = Document::load(upload_path)
        .with_context(|| format!("failed to load source pdf {}", upload_path.display()))?;
    let total_pages = source_doc.get_pages().len() as u32;
    let selected_pages = parse_page_ranges(page_ranges, total_pages)?;

    std::fs::create_dir_all(source_dir)?;
    if selected_pages.len() == total_pages as usize {
        if upload_path != target_path {
            std::fs::copy(upload_path, &target_path).with_context(|| {
                format!(
                    "failed to copy source pdf from {} to {}",
                    upload_path.display(),
                    target_path.display()
                )
            })?;
        }
        return Ok(PreparedSourcePdf {
            path: target_path,
            selected_pages,
            total_pages,
        });
    }

    let selected_page_set: BTreeSet<u32> = selected_pages.iter().copied().collect();
    let pages = source_doc.get_pages();
    let pages_to_delete = pages
        .keys()
        .copied()
        .filter(|page_number| !selected_page_set.contains(page_number))
        .collect::<Vec<_>>();
    source_doc.delete_pages(&pages_to_delete);
    source_doc.prune_objects();
    source_doc.renumber_objects();
    source_doc.save(&target_path).with_context(|| {
        format!(
            "failed to save subset source pdf to {}",
            target_path.display()
        )
    })?;

    Ok(PreparedSourcePdf {
        path: target_path,
        selected_pages,
        total_pages,
    })
}

/// 远程（URL）任务的原文拿到以后截成所选的页（上传的任务在 OCR 之前就截了，见 [`prepare_uploaded_source_pdf`]）。
///
/// URL 任务把页范围交给 OCR 服务，OCR 只认所选的页；原文却可能是整本（Paddle 是从 URL 下载的整本，MinerU 是它回传的
/// `*_origin.pdf`）。后面的归一化、渲染都按位置把 OCR 的第 n 页对到原文的第 n 页，整本的原文就会从第 1 页错起。
///
/// 已经只有所选页的原文不再截：它的页数正好是所选的页数，按范围解析要么越界（所选页号比它的页数大），要么选出来就是
/// 全部，两种都原样返回 `None`。没选页（空或 `all`）也是 `None`。截了返回截后的结果，文件原地改写。
pub(super) fn subset_downloaded_source_pdf(
    source_pdf: &Path,
    page_ranges: &str,
) -> Result<Option<PreparedSourcePdf>> {
    let page_ranges = page_ranges.trim();
    if page_ranges.is_empty() || page_ranges.eq_ignore_ascii_case("all") {
        return Ok(None);
    }
    let total_pages = Document::load(source_pdf)
        .with_context(|| format!("failed to load source pdf {}", source_pdf.display()))?
        .get_pages()
        .len() as u32;
    let Ok(selected) = parse_page_ranges(page_ranges, total_pages) else {
        return Ok(None);
    };
    if selected.len() == total_pages as usize {
        return Ok(None);
    }
    let source_dir = source_pdf
        .parent()
        .ok_or_else(|| anyhow!("source pdf has no parent directory"))?;
    prepare_uploaded_source_pdf(source_pdf, source_dir, page_ranges).map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Object, Stream};

    fn temp_dir(prefix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "retain-pdf-{prefix}-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn build_test_pdf(path: &Path, page_count: u32) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Courier",
        });
        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });

        let mut page_ids = Vec::new();
        for index in 0..page_count {
            let content = Content {
                operations: vec![
                    Operation::new("BT", vec![]),
                    Operation::new("Tf", vec!["F1".into(), 18.into()]),
                    Operation::new("Td", vec![72.into(), 720.into()]),
                    Operation::new(
                        "Tj",
                        vec![Object::string_literal(format!("Page {}", index + 1))],
                    ),
                    Operation::new("ET", vec![]),
                ],
            };
            let content_id = doc.add_object(Stream::new(
                dictionary! {},
                content.encode().expect("encode"),
            ));
            let page_id = doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "Contents" => content_id,
            });
            page_ids.push(page_id);
        }

        let pages = dictionary! {
            "Type" => "Pages",
            "Kids" => page_ids.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
            "Count" => page_count as i64,
            "Resources" => resources_id,
            "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages));

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        doc.compress();
        doc.save(path).expect("save test pdf");
    }

    #[test]
    fn prepare_uploaded_source_pdf_keeps_only_selected_pages() {
        let dir = temp_dir("page-subset");
        let upload_path = dir.join("input.pdf");
        let source_dir = dir.join("source");
        build_test_pdf(&upload_path, 5);

        let prepared =
            prepare_uploaded_source_pdf(&upload_path, &source_dir, "2,4-5").expect("prepare");

        assert!(prepared.is_subset());
        assert_eq!(prepared.selected_pages, vec![2, 4, 5]);
        assert_eq!(prepared.provider_page_ranges(), "");
        let saved = Document::load(&prepared.path).expect("load subset");
        assert_eq!(saved.get_pages().len(), 3);
    }

    #[test]
    fn prepare_uploaded_source_pdf_keeps_provider_range_for_full_book() {
        let dir = temp_dir("page-subset-full");
        let upload_path = dir.join("input.pdf");
        let source_dir = dir.join("source");
        build_test_pdf(&upload_path, 5);

        let prepared =
            prepare_uploaded_source_pdf(&upload_path, &source_dir, "").expect("prepare full book");

        assert!(!prepared.is_subset());
        assert_eq!(prepared.provider_page_ranges(), "all");
    }

    #[test]
    fn a_downloaded_whole_book_is_cut_to_the_selected_pages_in_place() {
        let dir = temp_dir("remote-subset");
        let source = dir.join("source").join("book.pdf");
        std::fs::create_dir_all(source.parent().unwrap()).unwrap();
        build_test_pdf(&source, 6);

        let prepared = subset_downloaded_source_pdf(&source, "2-3,6").expect("subset").expect("cut");

        assert_eq!(prepared.path, source);
        assert_eq!(prepared.selected_pages, vec![2, 3, 6]);
        assert_eq!(Document::load(&source).unwrap().get_pages().len(), 3);
    }

    #[test]
    fn a_source_that_already_holds_only_the_selected_pages_is_left_alone() {
        let dir = temp_dir("remote-subset-done");
        let source = dir.join("book.pdf");
        // MinerU 回传的原文如果已经只有所选的 2 页：再按「5-6」截就越界，按「1-2」截就是全部，都不动。
        build_test_pdf(&source, 2);
        assert_eq!(subset_downloaded_source_pdf(&source, "5-6").unwrap(), None);
        assert_eq!(subset_downloaded_source_pdf(&source, "1-2").unwrap(), None);
        assert_eq!(subset_downloaded_source_pdf(&source, "").unwrap(), None);
        assert_eq!(subset_downloaded_source_pdf(&source, "all").unwrap(), None);
        assert_eq!(Document::load(&source).unwrap().get_pages().len(), 2);
    }
}
