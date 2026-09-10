use std::path::Path;

use crate::error::AppError;
use crate::models::api::{ReaderDocumentMetadataView, ReaderMetadataView, ReaderPageMetadataView};
use crate::models::domain::JobSnapshot;
use crate::storage_paths::{resolve_output_pdf, resolve_source_pdf};

pub(crate) fn load_reader_metadata_view(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<ReaderMetadataView, AppError> {
    Ok(ReaderMetadataView {
        source: resolve_source_pdf(job, data_root)
            .filter(|path| path.exists() && path.is_file())
            .map(|path| load_pdf_metadata(&path))
            .transpose()?,
        translated: resolve_output_pdf(job, data_root)
            .filter(|path| path.exists() && path.is_file())
            .map(|path| load_pdf_metadata(&path))
            .transpose()?,
    })
}

fn load_pdf_metadata(path: &Path) -> Result<ReaderDocumentMetadataView, AppError> {
    let document = lopdf::Document::load(path).map_err(|error| {
        AppError::internal(format!("read pdf metadata {}: {error}", path.display()))
    })?;
    let pages = document.get_pages();
    let mut page_views = Vec::with_capacity(pages.len());
    for (page_number, object_id) in pages {
        let page_object = document
            .get_object(object_id)
            .map_err(|error| AppError::internal(format!("read pdf page object: {error}")))?;
        let page_dict = page_object
            .as_dict()
            .map_err(|error| AppError::internal(format!("read pdf page dict: {error}")))?;
        let media_box = page_dict
            .get(b"MediaBox")
            .ok()
            .and_then(|value| pdf_number_array(value).ok())
            .or_else(|| {
                page_dict
                    .get(b"CropBox")
                    .ok()
                    .and_then(|value| pdf_number_array(value).ok())
            })
            .unwrap_or_else(|| vec![0.0, 0.0, 0.0, 0.0]);
        let width = (media_box.get(2).copied().unwrap_or(0.0)
            - media_box.first().copied().unwrap_or(0.0))
        .abs();
        let height = (media_box.get(3).copied().unwrap_or(0.0)
            - media_box.get(1).copied().unwrap_or(0.0))
        .abs();
        page_views.push(ReaderPageMetadataView {
            page: i64::from(page_number),
            width,
            height,
        });
    }
    page_views.sort_by_key(|page| page.page);
    Ok(ReaderDocumentMetadataView {
        page_count: page_views.len() as i64,
        pages: page_views,
    })
}

fn pdf_number_array(value: &lopdf::Object) -> Result<Vec<f64>, lopdf::Error> {
    let array = value.as_array()?;
    Ok(array.iter().filter_map(pdf_number).collect())
}

fn pdf_number(value: &lopdf::Object) -> Option<f64> {
    match value {
        lopdf::Object::Integer(value) => Some(*value as f64),
        lopdf::Object::Real(value) => Some(f64::from(*value)),
        _ => None,
    }
}
