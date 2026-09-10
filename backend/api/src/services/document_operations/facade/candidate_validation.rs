use retain_core::models::domain::{now_iso, DocumentOperationStatus};
use retain_core::storage_paths::to_relative_data_path;
use retain_data::db::{Db, DocumentVersionRecord};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::config::AppConfig;

use super::super::program::canonical_program_sha256;
use super::super::workspace::{
    require_regular_file, sha256_file, write_state_mirror, write_validation_report,
    OperationWorkspacePaths,
};
use super::shared::{digest_hex, require_sha256};

#[derive(Serialize)]
struct CandidateValidationReport {
    schema: &'static str,
    valid: bool,
    source_pdf_sha256: String,
    program_sha256: String,
    candidate_pdf_sha256: String,
    candidate_bytes: u64,
    page_count: usize,
    executor_output_file_count: u64,
    executor_output_total_bytes: u64,
    visual_validation_sha256: String,
    visual_renderer: String,
    visual_renderer_version: String,
    visual_render_max_dimension: u32,
    visual_rendered_pixel_count: u64,
    page_plan_sha256: String,
    page_geometry_sha256: String,
    dropped_source_pages: u32,
    duplicated_output_pages: u32,
    rotated_output_pages: u32,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ExecutorCompletedResult {
    schema: String,
    status: String,
    input_page_count: u32,
    output_page_count: u32,
    output_bytes: u64,
    candidate_pdf_sha256: String,
    program_sha256: String,
    visual_validation_sha256: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct VisualValidationReport {
    schema: String,
    valid: bool,
    renderer: String,
    renderer_version: String,
    render_max_dimension: u32,
    source_pdf_sha256: String,
    program_sha256: String,
    candidate_pdf_sha256: String,
    source_page_count: u32,
    candidate_page_count: u32,
    rendered_page_count: u32,
    rendered_pixel_count: u64,
    page_plan_sha256: String,
    page_geometry_sha256: String,
    expected_pixels_sha256: String,
    candidate_pixels_sha256: String,
    mismatch_count: u32,
    mismatched_pages: Vec<u32>,
    dropped_source_pages: u32,
    duplicated_output_pages: u32,
    rotated_output_pages: u32,
}

pub(super) fn validate_and_publish_candidate(
    db: &Db,
    config: &AppConfig,
    operation: &retain_data::db::StoredDocumentOperation,
    attempt: &retain_data::db::StoredDocumentOperationAttempt,
) -> anyhow::Result<()> {
    let manifest = &attempt.manifest;
    let paths = OperationWorkspacePaths::for_manifest(&config.data_root, manifest);
    for (path, label) in [
        (&paths.source_pdf, "operation source PDF"),
        (&paths.program_json, "operation page program"),
        (&paths.candidate_pdf, "candidate PDF"),
        (&paths.result_json, "executor terminal result"),
        (&paths.visual_validation_json, "candidate visual validation"),
    ] {
        require_regular_file(path, label)?;
    }
    let source_sha = sha256_file(&paths.source_pdf)?;
    let program_sha = sha256_file(&paths.program_json)?;
    let candidate_sha = sha256_file(&paths.candidate_pdf)?;
    let visual_validation_sha = sha256_file(&paths.visual_validation_json)?;
    if source_sha != manifest.source_pdf_sha256 || program_sha != manifest.program_sha256 {
        anyhow::bail!("immutable operation input hash changed before validation");
    }
    if attempt.state.candidate_pdf_sha256.as_deref() != Some(candidate_sha.as_str()) {
        anyhow::bail!("candidate hash does not match executor terminal receipt");
    }
    let program_value: Value = serde_json::from_slice(&std::fs::read(&paths.program_json)?)?;
    if canonical_program_sha256(&program_value).map_err(anyhow::Error::msg)? != program_sha {
        anyhow::bail!("page program canonical hash changed");
    }
    let terminal: ExecutorCompletedResult =
        serde_json::from_slice(&std::fs::read(&paths.result_json)?)?;
    if terminal.schema != "retainpdf_page_program_result_v1"
        || terminal.status != "completed"
        || terminal.candidate_pdf_sha256 != candidate_sha
        || terminal.program_sha256 != program_sha
        || terminal.visual_validation_sha256 != visual_validation_sha
    {
        anyhow::bail!("executor terminal result identity is inconsistent");
    }
    let visual: VisualValidationReport =
        serde_json::from_slice(&std::fs::read(&paths.visual_validation_json)?)?;
    for digest in [
        &visual_validation_sha,
        &visual.page_plan_sha256,
        &visual.page_geometry_sha256,
        &visual.expected_pixels_sha256,
        &visual.candidate_pixels_sha256,
    ] {
        require_sha256(digest)?;
    }
    if visual.schema != "retainpdf_visual_validation_v1"
        || visual.renderer != "pymupdf"
        || !visual.valid
        || visual.source_pdf_sha256 != source_sha
        || visual.program_sha256 != program_sha
        || visual.candidate_pdf_sha256 != candidate_sha
        || visual.expected_pixels_sha256 != visual.candidate_pixels_sha256
        || visual.mismatch_count != 0
        || !visual.mismatched_pages.is_empty()
    {
        anyhow::bail!("candidate raster validation does not match the approved page program");
    }
    let candidate_bytes = std::fs::metadata(&paths.candidate_pdf)?.len();
    if candidate_bytes == 0 || candidate_bytes > manifest.limits.output_bytes {
        anyhow::bail!("candidate PDF exceeds the operation output limit");
    }
    let candidate = lopdf::Document::load(&paths.candidate_pdf)?;
    let page_count = candidate.get_pages().len();
    if page_count == 0 {
        anyhow::bail!("candidate PDF has no readable pages");
    }
    if terminal.input_page_count != visual.source_page_count
        || terminal.output_page_count != page_count as u32
        || terminal.output_page_count != visual.candidate_page_count
        || visual.rendered_page_count != terminal.output_page_count
        || terminal.output_bytes != candidate_bytes
    {
        anyhow::bail!("candidate structural and raster validation counts are inconsistent");
    }
    let mut output_file_count = 0u64;
    let mut output_total_bytes = 0u64;
    for entry in WalkDir::new(paths.root.join("outputs")).follow_links(false) {
        let entry = entry?;
        if entry.file_type().is_symlink() {
            anyhow::bail!("operation output contains a symlink");
        }
        if entry.file_type().is_file() {
            output_file_count += 1;
            output_total_bytes = output_total_bytes.saturating_add(entry.metadata()?.len());
        }
    }
    if output_file_count > u64::from(manifest.limits.file_count)
        || output_total_bytes > manifest.limits.output_bytes
    {
        anyhow::bail!("operation outputs exceed file-count or byte limits");
    }
    let report = CandidateValidationReport {
        schema: "document_operation_validation_v2",
        valid: true,
        source_pdf_sha256: source_sha,
        program_sha256: program_sha,
        candidate_pdf_sha256: candidate_sha.clone(),
        candidate_bytes,
        page_count,
        executor_output_file_count: output_file_count,
        executor_output_total_bytes: output_total_bytes,
        visual_validation_sha256: visual_validation_sha,
        visual_renderer: visual.renderer,
        visual_renderer_version: visual.renderer_version,
        visual_render_max_dimension: visual.render_max_dimension,
        visual_rendered_pixel_count: visual.rendered_pixel_count,
        page_plan_sha256: visual.page_plan_sha256,
        page_geometry_sha256: visual.page_geometry_sha256,
        dropped_source_pages: visual.dropped_source_pages,
        duplicated_output_pages: visual.duplicated_output_pages,
        rotated_output_pages: visual.rotated_output_pages,
    };
    write_validation_report(&paths, &report)?;
    let mut ready = attempt.state.clone();
    ready.status = DocumentOperationStatus::ResultReady;
    ready.updated_at = now_iso();
    let artifact_key = to_relative_data_path(&config.data_root, &paths.candidate_pdf)?;
    let version_digest =
        Sha256::digest(format!("{}\0{}", operation.operation_id, candidate_sha).as_bytes());
    let version_digest = digest_hex(&version_digest);
    let version_id = format!("version-{}", &version_digest[..40]);
    db.publish_document_candidate(
        &DocumentVersionRecord {
            version_id,
            document_id: operation.document_id.clone(),
            base_version_id: operation.base_version_id.clone(),
            operation_id: operation.operation_id.clone(),
            source_job_id: operation.base_job_id.clone(),
            artifact_key,
            content_sha256: candidate_sha,
            status: "candidate".to_string(),
            created_at: ready.updated_at.clone(),
            committed_at: None,
        },
        &ready,
    )?;
    let _ = write_state_mirror(&paths, &ready);
    Ok(())
}
