#[path = "input/ocr.rs"]
mod ocr;
#[path = "input/render.rs"]
mod render;
#[path = "input/request.rs"]
mod request;
#[path = "input/resolved.rs"]
mod resolved;
#[path = "input/runtime.rs"]
mod runtime;
#[path = "input/source.rs"]
mod source;
#[cfg(test)]
mod tests {
    use crate::models::{CreateJobInput, ResolvedJobSpec, WorkflowKind};
    use serde_json::json;

    #[test]
    fn create_job_input_from_api_value_supports_grouped_payload() {
        let input = CreateJobInput::from_api_value(json!({
            "workflow": "book",
            "source": { "upload_id": "upload-1" },
            "ocr": { "mineru_token": "mineru-token" },
            "translation": {
                "model": "deepseek-v4-flash",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            },
            "render": { "render_mode": "auto" },
            "runtime": { "job_id": "job-1", "timeout_seconds": 1200 }
        }))
        .expect("parse grouped payload");

        assert_eq!(input.workflow, WorkflowKind::Book);
        assert_eq!(input.source.upload_id, "upload-1");
        assert_eq!(input.ocr.mineru_token, "mineru-token");
        assert_eq!(input.translation.model, "deepseek-v4-flash");
        assert_eq!(input.translation.base_url, "https://api.deepseek.com/v1");
        assert_eq!(input.translation.api_key, "sk-test");
        assert_eq!(input.render.render_mode, "auto");
        assert_eq!(input.runtime.job_id, "job-1");
        assert_eq!(input.runtime.timeout_seconds, 1200);
    }

    #[test]
    fn create_job_input_from_api_value_rejects_legacy_flat_payload() {
        let err = CreateJobInput::from_api_value(json!({
            "workflow": "book",
            "upload_id": "upload-legacy",
            "model": "deepseek-v4-flash",
            "base_url": "https://api.deepseek.com/v1",
            "api_key": "sk-legacy",
            "mineru_token": "mineru-legacy",
            "render_mode": "auto",
            "job_id": "job-legacy"
        }))
        .expect_err("legacy payload should be rejected");

        let message = err.to_string();
        assert!(message.contains("unknown field") || message.contains("upload_id"));
    }

    #[test]
    fn create_job_input_accepts_artifact_job_id() {
        let input = CreateJobInput::from_api_value(json!({
            "workflow": "render",
            "source": { "artifact_job_id": "job-prev" },
            "render": { "render_mode": "auto" }
        }))
        .expect("parse render payload");

        assert_eq!(input.workflow, WorkflowKind::Render);
        assert_eq!(input.source.artifact_job_id, "job-prev");
    }

    #[test]
    fn create_job_input_accepts_translate_workflow() {
        let input = CreateJobInput::from_api_value(json!({
            "workflow": "translate",
            "source": { "upload_id": "upload-translate" },
            "translation": {
                "model": "deepseek-v4-flash",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            }
        }))
        .expect("parse translate payload");

        assert_eq!(input.workflow, WorkflowKind::Translate);
        assert_eq!(input.source.upload_id, "upload-translate");
        assert_eq!(input.translation.model, "deepseek-v4-flash");
    }

    #[test]
    fn create_job_input_accepts_all_canonical_workflows() {
        let mineru = CreateJobInput::from_api_value(json!({
            "workflow": "book",
            "source": { "upload_id": "upload-book" },
            "ocr": { "mineru_token": "mineru-token" },
            "translation": {
                "model": "deepseek-v4-flash",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            }
        }))
        .expect("parse book payload");
        assert_eq!(mineru.workflow, WorkflowKind::Book);

        let ocr = CreateJobInput::from_api_value(json!({
            "workflow": "ocr",
            "source": { "source_url": "https://example.com/paper.pdf" },
            "ocr": { "provider": "mineru", "mineru_token": "mineru-token" }
        }))
        .expect("parse ocr payload");
        assert_eq!(ocr.workflow, WorkflowKind::Ocr);

        let translate = CreateJobInput::from_api_value(json!({
            "workflow": "translate",
            "source": { "upload_id": "upload-translate" },
            "translation": {
                "model": "deepseek-v4-flash",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            }
        }))
        .expect("parse translate payload");
        assert_eq!(translate.workflow, WorkflowKind::Translate);

        let render = CreateJobInput::from_api_value(json!({
            "workflow": "render",
            "source": { "artifact_job_id": "job-prev" },
            "render": { "render_mode": "auto" }
        }))
        .expect("parse render payload");
        assert_eq!(render.workflow, WorkflowKind::Render);
    }

    #[test]
    fn resolved_job_spec_from_input_derives_job_id_and_workers() {
        let mut input = CreateJobInput::default();
        input.source.upload_id = "upload-1".to_string();
        input.translation.model = "deepseek-v4-flash".to_string();
        input.translation.base_url = "https://api.deepseek.com/v1".to_string();
        input.translation.api_key = "sk-test".to_string();
        input.ocr.mineru_token = "mineru-token".to_string();

        let spec = ResolvedJobSpec::from_input(input);

        assert!(!spec.job_id.trim().is_empty());
        assert_eq!(spec.source.upload_id, "upload-1");
        assert_eq!(spec.resolved_workers(), 100);
    }
}
#[path = "input/translation.rs"]
mod translation;

pub use ocr::OcrInput;
pub use render::{RenderInput, DEFAULT_SOURCE_CLEANUP_STRATEGY, SOURCE_CLEANUP_STRATEGIES};
pub use request::CreateJobInput;
pub use resolved::ResolvedJobSpec;
pub use runtime::RuntimeInput;
pub use source::{JobSourceInput, ResolvedSourceSpec};
pub use translation::{GlossaryEntryInput, TranslationInput};
