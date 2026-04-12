use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use lopdf::Document;

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

fn parse_page_ranges(spec: &str, total_pages: u32) -> Result<Vec<u32>> {
    if total_pages == 0 {
        return Err(anyhow!("source pdf has no pages"));
    }
    if spec.trim().is_empty() {
        return Ok((1..=total_pages).collect());
    }

    let mut pages = BTreeSet::new();
    for raw_part in spec.split(',') {
        let part = raw_part.trim();
        if part.is_empty() {
            continue;
        }
        if let Some((start_raw, end_raw)) = part.split_once('-') {
            let start = parse_page_number(start_raw, total_pages, spec)?;
            let end = parse_page_number(end_raw, total_pages, spec)?;
            if start > end {
                return Err(anyhow!(
                    "invalid page range '{part}' in '{spec}': start > end"
                ));
            }
            for page in start..=end {
                pages.insert(page);
            }
            continue;
        }
        pages.insert(parse_page_number(part, total_pages, spec)?);
    }

    if pages.is_empty() {
        return Err(anyhow!("page_ranges '{spec}' did not resolve to any page"));
    }
    Ok(pages.into_iter().collect())
}

fn parse_page_number(raw: &str, total_pages: u32, spec: &str) -> Result<u32> {
    let value = raw
        .trim()
        .parse::<u32>()
        .with_context(|| format!("invalid page number '{raw}' in '{spec}'"))?;
    if value == 0 || value > total_pages {
        return Err(anyhow!(
            "page number '{value}' is out of bounds for total_pages={total_pages}"
        ));
    }
    Ok(value)
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
    fn parse_page_ranges_supports_singletons_and_ranges() {
        assert_eq!(
            parse_page_ranges("1, 3-5, 7", 8).expect("parse"),
            vec![1, 3, 4, 5, 7]
        );
    }

    #[test]
    fn parse_page_ranges_rejects_out_of_bounds_pages() {
        let err = parse_page_ranges("1-9", 5).expect_err("should fail");
        assert!(err.to_string().contains("out of bounds"));
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
}
