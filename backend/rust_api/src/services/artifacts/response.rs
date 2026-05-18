use crate::models::{JobArtifactRecord, JobSnapshot};
use crate::storage_paths::ARTIFACT_KIND_DIR;

pub fn artifact_resource_path(job: &JobSnapshot, artifact_key: &str) -> Option<String> {
    let prefix = job.workflow.job_api_prefix();
    let job_prefix = format!("{prefix}/{}", job.job_id);
    match artifact_key {
        "source_pdf" => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        "translated_pdf" => Some(format!("{job_prefix}/pdf")),
        "typst_source" => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        "typst_render_pdf" => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        "markdown_raw" => Some(format!("{job_prefix}/markdown?raw=true")),
        "markdown_images_dir" => Some(format!("{job_prefix}/markdown/images/")),
        "markdown_bundle_zip" => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        "normalized_document_json" => Some(format!("{job_prefix}/normalized-document")),
        "normalization_report_json" => Some(format!("{job_prefix}/normalization-report")),
        _ => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
    }
}

pub fn artifact_is_direct_downloadable(item: &JobArtifactRecord) -> bool {
    item.artifact_kind != ARTIFACT_KIND_DIR
}
