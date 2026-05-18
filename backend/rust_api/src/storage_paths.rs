#[path = "storage_paths/constants.rs"]
mod constants;
#[path = "storage_paths/job_paths.rs"]
mod job_paths;
#[path = "storage_paths/path_ops.rs"]
mod path_ops;
#[path = "storage_paths/registry.rs"]
mod registry;
#[path = "storage_paths/resolvers.rs"]
mod resolvers;

pub use constants::{
    ARTIFACT_GROUP_DEBUG, ARTIFACT_GROUP_JSON, ARTIFACT_GROUP_MARKDOWN, ARTIFACT_GROUP_PROVIDER,
    ARTIFACT_GROUP_RENDERED, ARTIFACT_GROUP_SOURCE, ARTIFACT_GROUP_TYPST,
    ARTIFACT_KEY_EVENTS_JSONL, ARTIFACT_KEY_JOB_ROOT, ARTIFACT_KEY_LAYOUT_JSON,
    ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP, ARTIFACT_KEY_MARKDOWN_IMAGES_DIR, ARTIFACT_KEY_MARKDOWN_RAW,
    ARTIFACT_KEY_NORMALIZATION_REPORT_JSON, ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON,
    ARTIFACT_KEY_PIPELINE_SUMMARY, ARTIFACT_KEY_PROVIDER_BUNDLE_ZIP, ARTIFACT_KEY_PROVIDER_RAW_DIR,
    ARTIFACT_KEY_PROVIDER_RESULT_JSON, ARTIFACT_KEY_RENDER_CONFIG_JSON, ARTIFACT_KEY_SOURCE_PDF,
    ARTIFACT_KEY_TRANSLATED_PDF, ARTIFACT_KEY_TRANSLATIONS_DIR,
    ARTIFACT_KEY_TRANSLATION_DEBUG_INDEX_JSON, ARTIFACT_KEY_TRANSLATION_DIAGNOSTICS_JSON,
    ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON, ARTIFACT_KEY_TYPST_PDF, ARTIFACT_KEY_TYPST_SOURCE,
    ARTIFACT_KIND_DIR, ARTIFACT_KIND_FILE, LEGACY_JOB_UNSUPPORTED_MESSAGE,
    TRANSLATION_MANIFEST_FILE_NAME,
};
pub use job_paths::{attach_job_paths, build_job_paths, JobPaths};
pub use path_ops::{
    data_path_is_absolute, job_uses_legacy_output_layout, job_uses_legacy_path_storage,
    normalize_job_artifacts_for_storage, normalize_job_paths_for_storage,
    normalize_relative_data_path, resolve_data_path, to_relative_data_path,
};
pub use registry::collect_job_artifact_entries;
pub use resolvers::{
    resolve_events_jsonl, resolve_job_root, resolve_markdown_bundle_zip,
    resolve_markdown_images_dir, resolve_markdown_path, resolve_normalization_report,
    resolve_normalized_document, resolve_output_pdf, resolve_registered_artifact_path,
    resolve_source_pdf, resolve_translation_debug_index, resolve_translation_diagnostics,
    resolve_translation_manifest, resolve_typst_pdf, resolve_typst_source,
};

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use super::*;
    use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

    #[test]
    fn normalize_rejects_parent_relative_paths() {
        assert!(normalize_relative_data_path(Path::new("../escape.pdf")).is_err());
    }

    #[test]
    fn to_relative_strips_data_root_prefix() {
        let data_root = Path::new("/tmp/data-root");
        let path = data_root.join("jobs/job-1/rendered/out.pdf");
        assert_eq!(
            to_relative_data_path(data_root, &path).expect("relative path"),
            "jobs/job-1/rendered/out.pdf"
        );
    }

    #[test]
    fn resolve_data_path_expands_relative_paths_under_data_root() {
        let data_root = Path::new("/tmp/data-root");
        let resolved =
            resolve_data_path(data_root, "jobs/job-1/rendered/out.pdf").expect("resolved");
        assert_eq!(resolved, data_root.join("jobs/job-1/rendered/out.pdf"));
    }

    #[test]
    fn collect_job_artifact_entries_includes_registered_downloadables() {
        let root = std::env::temp_dir().join(format!("rust-api-artifacts-{}", fastrand::u64(..)));
        let data_root = root.join("data");
        let job_root = data_root.join("jobs").join("job-1");
        fs::create_dir_all(job_root.join("source")).expect("source dir");
        fs::create_dir_all(job_root.join("rendered/typst/book-overlays")).expect("typst dir");
        fs::create_dir_all(job_root.join("md/images")).expect("markdown images dir");
        fs::create_dir_all(job_root.join("ocr/normalized")).expect("normalized dir");
        fs::create_dir_all(job_root.join("artifacts")).expect("artifacts dir");
        fs::create_dir_all(job_root.join("logs")).expect("logs dir");
        fs::write(job_root.join("source/in.pdf"), b"pdf").expect("source pdf");
        fs::write(job_root.join("rendered/out.pdf"), b"pdf").expect("output pdf");
        fs::write(
            job_root.join("rendered/typst/book-overlays/book-overlay.typ"),
            b"#set page()",
        )
        .expect("typst source");
        fs::write(job_root.join("md/full.md"), b"# doc").expect("markdown");
        fs::write(job_root.join("ocr/normalized/document.v1.json"), b"{}").expect("json");
        fs::write(job_root.join("artifacts/render_config.json"), b"{}").expect("render config");
        fs::write(
            job_root.join("logs/events.jsonl"),
            b"{\"event\":\"job_created\"}\n",
        )
        .expect("events jsonl");

        let mut job = JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.artifacts = Some(JobArtifacts {
            job_root: Some(job_root.to_string_lossy().to_string()),
            source_pdf: Some(job_root.join("source/in.pdf").to_string_lossy().to_string()),
            output_pdf: Some(
                job_root
                    .join("rendered/out.pdf")
                    .to_string_lossy()
                    .to_string(),
            ),
            normalized_document_json: Some(
                job_root
                    .join("ocr/normalized/document.v1.json")
                    .to_string_lossy()
                    .to_string(),
            ),
            render_config_json: Some(
                job_root
                    .join("artifacts/render_config.json")
                    .to_string_lossy()
                    .to_string(),
            ),
            ..JobArtifacts::default()
        });

        let items = collect_job_artifact_entries(&job, &data_root).expect("collect entries");
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_SOURCE_PDF));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_TRANSLATED_PDF));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_TYPST_SOURCE));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_MARKDOWN_RAW));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_RENDER_CONFIG_JSON));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_EVENTS_JSONL));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn provider_raw_markdown_is_not_exposed_as_published_markdown_artifact() {
        let root = std::env::temp_dir().join(format!("rust-api-artifacts-{}", fastrand::u64(..)));
        let data_root = root.join("data");
        let job_root = data_root.join("jobs").join("job-raw-only");
        let provider_raw_dir = job_root.join("ocr").join("paddle_raw");
        fs::create_dir_all(provider_raw_dir.join("images")).expect("provider raw images dir");
        fs::write(provider_raw_dir.join("full.md"), b"# raw only").expect("provider raw markdown");
        fs::write(provider_raw_dir.join("images/page-1.png"), b"png").expect("provider raw image");

        let mut job = JobSnapshot::new(
            "job-raw-only".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.artifacts = Some(JobArtifacts {
            job_root: Some(job_root.to_string_lossy().to_string()),
            provider_raw_dir: Some(provider_raw_dir.to_string_lossy().to_string()),
            ..JobArtifacts::default()
        });

        assert!(resolve_markdown_path(&job, &data_root).is_none());
        assert!(resolve_markdown_images_dir(&job, &data_root).is_none());

        let items = collect_job_artifact_entries(&job, &data_root).expect("collect entries");
        assert!(!items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_MARKDOWN_RAW));
        assert!(!items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_MARKDOWN_IMAGES_DIR));
        assert!(!items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP && item.ready));

        let _ = fs::remove_dir_all(root);
    }
}
