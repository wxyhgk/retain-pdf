mod control;
mod create;
mod download;
mod json_response;
mod query;
mod translation_debug;

pub use control::{cancel_job, cancel_ocr_job};
pub use create::{create_job, create_ocr_job, translate_bundle};
pub use download::{
    download_artifact_by_key, download_bundle, download_cover, download_markdown,
    download_markdown_image, download_normalization_report, download_normalized_document,
    download_ocr_artifact_by_key, download_ocr_normalization_report,
    download_ocr_normalized_document, download_page_preview, download_pdf,
    download_side_by_side_pdf, download_thumbnail, get_markdown_document,
};
pub use query::{
    get_job, get_job_artifacts, get_job_artifacts_manifest, get_job_diagnostics, get_job_events,
    get_live_translation_events, get_live_translation_layout, get_live_translation_page,
    get_ocr_job, get_ocr_job_artifacts, get_ocr_job_artifacts_manifest, get_ocr_job_events,
    get_reader_metadata, get_reader_regions, get_resume_plan, get_stage_actions, list_jobs,
    list_ocr_jobs, reader_ai_chat, rerun_job, resolve_ocr_ambiguity, resume_job, retry_stage,
};
pub use translation_debug::{
    get_translation_diagnostics, get_translation_item, list_translation_items,
    replay_translation_item_route,
};

#[cfg(test)]
mod tests {
    use crate::models::request::CreateJobInput;
    use serde_json::json;

    #[test]
    fn create_job_json_requires_grouped_payload_shape() {
        let input = CreateJobInput::from_api_value(json!({
            "source": { "upload_id": "grouped-upload" },
            "translation": {
                "model": "deepseek-v4-flash",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            },
            "ocr": { "mineru_token": "mineru-token" }
        }))
        .expect("parse payload");

        assert_eq!(input.source.upload_id, "grouped-upload");
    }
}
