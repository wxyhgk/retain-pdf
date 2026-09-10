use crate::error::AppError;
use crate::models::domain::JobSnapshot;
use crate::storage_paths::{
    resolve_normalization_report, resolve_normalized_document, resolve_output_pdf,
};

use super::pdf::linearized_pdf_or_original;
use super::{FileDownload, QueryJobsDeps};

#[derive(Clone, Copy)]
pub(crate) enum DocumentDownloadKind {
    OutputPdf,
    NormalizedDocument,
    NormalizationReport,
}

impl DocumentDownloadKind {
    fn content_type(self) -> &'static str {
        match self {
            Self::OutputPdf => "application/pdf",
            Self::NormalizedDocument | Self::NormalizationReport => "application/json",
        }
    }

    fn not_ready_label(self) -> &'static str {
        match self {
            Self::OutputPdf => "pdf not ready",
            Self::NormalizedDocument => "normalized document not ready",
            Self::NormalizationReport => "normalization report not ready",
        }
    }

    fn resolve_path(
        self,
        job: &JobSnapshot,
        data_root: &std::path::Path,
    ) -> Option<std::path::PathBuf> {
        match self {
            Self::OutputPdf => resolve_output_pdf(job, data_root),
            Self::NormalizedDocument => resolve_normalized_document(job, data_root),
            Self::NormalizationReport => resolve_normalization_report(job, data_root),
        }
    }
}

pub(crate) fn document_download(
    deps: &QueryJobsDeps<'_>,
    job: &JobSnapshot,
    kind: DocumentDownloadKind,
) -> Result<FileDownload, AppError> {
    let content_type = kind.content_type();
    let path = kind.resolve_path(job, deps.data_root).ok_or_else(|| {
        AppError::not_found(format!("{}: {}", kind.not_ready_label(), job.job_id))
    })?;
    let path = if matches!(kind, DocumentDownloadKind::OutputPdf) {
        linearized_pdf_or_original(deps, job, &path, "output")?
    } else {
        path
    };
    Ok(FileDownload::new(path, content_type, None))
}
