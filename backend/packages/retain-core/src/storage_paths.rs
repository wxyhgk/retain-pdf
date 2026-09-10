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
    ARTIFACT_KEY_TRANSLATION_CHECKPOINT_JSON, ARTIFACT_KEY_TRANSLATION_DEBUG_INDEX_JSON,
    ARTIFACT_KEY_TRANSLATION_DIAGNOSTICS_JSON, ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON,
    ARTIFACT_KEY_TRANSLATION_REQUEST_JOURNAL_JSONL, ARTIFACT_KEY_TYPST_PDF,
    ARTIFACT_KEY_TYPST_SOURCE, ARTIFACT_KIND_DIR, ARTIFACT_KIND_FILE,
    LEGACY_JOB_UNSUPPORTED_MESSAGE, TRANSLATION_CHECKPOINT_FILE_NAME,
    TRANSLATION_MANIFEST_FILE_NAME, TRANSLATION_REQUEST_JOURNAL_FILE_NAME,
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
    resolve_normalized_document, resolve_output_pdf, resolve_pipeline_summary,
    resolve_registered_artifact_path, resolve_source_pdf, resolve_translation_debug_index,
    resolve_translation_diagnostics, resolve_translation_manifest,
    resolve_translation_request_journal, resolve_typst_pdf, resolve_typst_source,
};

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use super::*;
    use crate::models::domain::{JobArtifacts, JobSnapshot};
    use crate::models::request::CreateJobInput;

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
    fn to_relative_handles_relative_data_root() {
        // 回归:DATA_ROOT 配成相对值(dev 环境 RUST_API_DATA_ROOT=../../data)时,
        // resolve_typst_source 之类会拼出 `../../data/jobs/x/...book-overlay.typ`
        // 这种带 `..` 的相对路径,再喂回 to_relative_data_path 做相对化。旧实现
        // 只对绝对路径 strip_prefix,这里会落到 `..` 校验被拒,导致产物清单
        // 接口 500、阅读器报"对照阅读加载失败"。现在无条件先剥 data_root 前缀。
        let data_root = Path::new("../../data");
        let joined = data_root.join("jobs/job-1/rendered/typst/book-overlays/book-overlay.typ");
        assert_eq!(
            to_relative_data_path(data_root, &joined).expect("relative path"),
            "jobs/job-1/rendered/typst/book-overlays/book-overlay.typ"
        );
    }

    #[test]
    fn to_relative_passes_through_already_job_relative_path() {
        // 已经是作业相对路径的情形(如 job 记录里存的 source_pdf)剥不掉 data_root
        // 前缀,应原样规范化返回,不受上面改动影响。
        let data_root = Path::new("../../data");
        assert_eq!(
            to_relative_data_path(data_root, Path::new("jobs/job-1/source/in.pdf"))
                .expect("relative path"),
            "jobs/job-1/source/in.pdf"
        );
    }

    #[test]
    fn to_relative_rejects_absolute_path_outside_data_root() {
        // 绝对路径但不在 DATA_ROOT 下,仍应报错(保持旧行为)。
        let data_root = Path::new("/tmp/data-root");
        assert!(to_relative_data_path(data_root, Path::new("/etc/passwd")).is_err());
    }

    #[test]
    fn to_relative_accepts_cwd_relative_paths_under_relative_data_root() {
        // Reproduces local boot with RUST_API_DATA_ROOT=../../data from rust_api/.
        let temp = std::env::temp_dir().join(format!("retainpdf-rel-data-{}", fastrand::u64(..)));
        let data_root = temp.join("data");
        let upload = data_root.join("uploads").join("job-1").join("paper.pdf");
        fs::create_dir_all(upload.parent().expect("parent")).expect("mkdir");
        fs::write(&upload, b"%PDF-1.4").expect("write pdf");

        let cwd = std::env::current_dir().expect("cwd");
        let rel_root = pathdiff_simple(&cwd, &data_root);
        let rel_upload = pathdiff_simple(&cwd, &upload);
        assert!(
            !rel_root.is_absolute(),
            "expected a relative data root for this test setup, got {}",
            rel_root.display()
        );

        let relative = to_relative_data_path(&rel_root, &rel_upload)
            .expect("relative path under relative DATA_ROOT");
        assert_eq!(relative, "uploads/job-1/paper.pdf");
        let _ = fs::remove_dir_all(&temp);
    }

    /// Best-effort relative path from `from` to `to` without extra crates.
    fn pathdiff_simple(from: &Path, to: &Path) -> std::path::PathBuf {
        use std::path::{Component, PathBuf};
        let from = from.canonicalize().unwrap_or_else(|_| from.to_path_buf());
        let to = to.canonicalize().unwrap_or_else(|_| to.to_path_buf());
        let from_components: Vec<_> = from.components().collect();
        let to_components: Vec<_> = to.components().collect();
        let mut common = 0;
        for (a, b) in from_components.iter().zip(to_components.iter()) {
            if a == b {
                common += 1;
            } else {
                break;
            }
        }
        let mut result = PathBuf::new();
        for _ in common..from_components.len() {
            result.push(Component::ParentDir.as_os_str());
        }
        for component in to_components.iter().skip(common) {
            result.push(component.as_os_str());
        }
        if result.as_os_str().is_empty() {
            PathBuf::from(".")
        } else {
            result
        }
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
        fs::create_dir_all(job_root.join("translated")).expect("translated dir");
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
            job_root.join("translated/translation-checkpoint.v1.json"),
            b"{}",
        )
        .expect("translation checkpoint");
        fs::write(
            job_root.join("translated/translation-request-journal.v1.jsonl"),
            b"{\"schema\":\"translation_request_journal_v1\",\"schema_version\":1}\n",
        )
        .expect("translation request journal");
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
            translation_checkpoint_json: Some(
                job_root
                    .join("translated/translation-checkpoint.v1.json")
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
            .any(|item| { item.artifact_key == ARTIFACT_KEY_TRANSLATION_REQUEST_JOURNAL_JSONL }));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_TRANSLATION_CHECKPOINT_JSON));
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
