use super::*;
use retainpdf_core::models::domain::{JobArtifacts, JobSnapshot};
use retainpdf_core::models::{OcrArtifactSet, OcrProviderDiagnostics};
use retainpdf_core::models::request::CreateJobInput;

const JOB: &str = "20261028090000-aaaaaa";

struct Root(PathBuf);

impl Root {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "retainpdf-intermediates-{name}-{}",
            fastrand::u64(..)
        ));
        std::fs::create_dir_all(&root).unwrap();
        Self(root)
    }

    fn write(&self, relative: &str, bytes: &[u8]) -> PathBuf {
        let path = self.0.join(relative);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, bytes).unwrap();
        path
    }

    fn exists(&self, relative: &str) -> bool {
        self.0.join(relative).exists()
    }
}

impl Drop for Root {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn job_path(rest: &str) -> String {
    format!("jobs/{JOB}/{rest}")
}

/// 一个 MinerU 翻译任务成功以后的目录：该留的和纯重复的都有。
fn succeeded_mineru_job(root: &Root) -> JobSnapshot {
    for (path, bytes) in [
        ("source/paper.pdf", &b"source pdf"[..]),
        ("ocr/mineru_bundle.zip", b"zip"),
        ("ocr/unpacked/layout.json", b"{}"),
        ("ocr/unpacked/abc_origin.pdf", b"source pdf"),
        ("ocr/unpacked/full.md", b"# raw"),
        ("ocr/unpacked/abc_middle.json", b"{}"),
        ("ocr/unpacked/images/fig1.jpg", b"jpg"),
        ("ocr/normalized/document.v1.json", b"{}"),
        ("md/full.md", b"# published"),
        ("md/images/fig1.jpg", b"jpg"),
        ("translated/translation-manifest.json", b"{}"),
        ("rendered/paper-translated.pdf", b"translated"),
        ("rendered/paper-translated.previous.pdf", b"older translated"),
        ("artifacts/pipeline_summary.json", b"{}"),
    ] {
        root.write(&job_path(path), bytes);
    }
    root.write(&job_path(&format!("rendered/{JOB}.zip")), b"bundle copy");

    let mut job = JobSnapshot::new(JOB.into(), CreateJobInput::default(), vec![]);
    job.artifacts = Some(JobArtifacts {
        job_root: Some(format!("jobs/{JOB}")),
        source_pdf: Some(job_path("source/paper.pdf")),
        layout_json: Some(job_path("ocr/unpacked/layout.json")),
        normalized_document_json: Some(job_path("ocr/normalized/document.v1.json")),
        provider_raw_dir: Some(job_path("ocr/unpacked")),
        provider_zip: Some(job_path("ocr/mineru_bundle.zip")),
        translations_dir: Some(job_path("translated")),
        output_pdf: Some(job_path("rendered/paper-translated.pdf")),
        previous_output_pdf: Some(job_path("rendered/paper-translated.previous.pdf")),
        previous_finished_at: Some("2026-10-27T10:00:00Z".into()),
        summary: Some(job_path("artifacts/pipeline_summary.json")),
        ocr_provider_diagnostics: Some(OcrProviderDiagnostics {
            artifacts: OcrArtifactSet {
                provider_bundle_zip: Some(job_path("ocr/mineru_bundle.zip")),
                layout_json: Some(job_path("ocr/unpacked/layout.json")),
                ..Default::default()
            },
            ..Default::default()
        }),
        ..Default::default()
    });
    job
}

#[test]
fn duplicates_are_removed_and_everything_still_read_is_kept() {
    let root = Root::new("prune");
    let mut job = succeeded_mineru_job(&root);

    let pruned = prune_succeeded_job_intermediates(&root.0, &job);

    for gone in [
        "ocr/mineru_bundle.zip",
        "ocr/unpacked/abc_origin.pdf",
        "ocr/unpacked/full.md",
        "ocr/unpacked/abc_middle.json",
        "ocr/unpacked/images",
        "rendered/paper-translated.previous.pdf",
    ] {
        assert!(!root.exists(&job_path(gone)), "{gone} should be removed");
    }
    assert!(!root.exists(&job_path(&format!("rendered/{JOB}.zip"))));
    for kept in [
        "source/paper.pdf",
        "ocr/unpacked/layout.json",
        "ocr/normalized/document.v1.json",
        "md/full.md",
        "md/images/fig1.jpg",
        "translated/translation-manifest.json",
        "rendered/paper-translated.pdf",
        "artifacts/pipeline_summary.json",
    ] {
        assert!(root.exists(&job_path(kept)), "{kept} must be kept");
    }
    assert_eq!(pruned.files, 7);
    assert_eq!(pruned.failed, 0);

    assert!(clear_pruned_record_fields(&root.0, &mut job));
    let artifacts = job.artifacts.as_ref().unwrap();
    assert_eq!(artifacts.provider_zip, None);
    assert_eq!(artifacts.previous_output_pdf, None);
    assert_eq!(artifacts.previous_finished_at, None);
    let diagnostics = &artifacts.ocr_provider_diagnostics.as_ref().unwrap().artifacts;
    assert_eq!(diagnostics.provider_bundle_zip, None);
    assert!(diagnostics.layout_json.is_some(), "layout stays recorded");
    assert!(artifacts.layout_json.is_some());
    assert!(artifacts.output_pdf.is_some());

    assert!(!clear_pruned_record_fields(&root.0, &mut job), "nothing left to clear");
    assert_eq!(prune_succeeded_job_intermediates(&root.0, &job), IntermediatesPruned::default());
}

#[test]
fn the_raw_ocr_output_stays_until_the_published_markdown_exists() {
    let root = Root::new("no-md");
    let job = succeeded_mineru_job(&root);
    std::fs::remove_dir_all(root.0.join(job_path("md"))).unwrap();

    prune_succeeded_job_intermediates(&root.0, &job);

    assert!(root.exists(&job_path("ocr/unpacked/full.md")));
    assert!(root.exists(&job_path("ocr/unpacked/images/fig1.jpg")));
    assert!(!root.exists(&job_path("ocr/mineru_bundle.zip")), "the zip goes either way");
}

#[test]
fn other_providers_raw_directories_are_left_alone() {
    let root = Root::new("paddle");
    let mut job = succeeded_mineru_job(&root);
    root.write(&job_path("ocr/paddle_raw/full.md"), b"# raw");
    job.artifacts.as_mut().unwrap().provider_raw_dir = Some(job_path("ocr/paddle_raw"));

    prune_succeeded_job_intermediates(&root.0, &job);

    assert!(root.exists(&job_path("ocr/paddle_raw/full.md")));
}

#[test]
fn the_previous_translation_is_kept_while_it_is_the_only_one() {
    let root = Root::new("previous");
    let mut job = succeeded_mineru_job(&root);
    // 重渲染失败接回来的：output_pdf 指的就是上一份。
    job.artifacts.as_mut().unwrap().output_pdf = Some(job_path("rendered/paper-translated.previous.pdf"));
    prune_succeeded_job_intermediates(&root.0, &job);
    assert!(root.exists(&job_path("rendered/paper-translated.previous.pdf")));

    // output_pdf 不在了（正好又开了一次重渲染，刚把它挪开）：上一份也不动。
    job.artifacts.as_mut().unwrap().output_pdf = Some(job_path("rendered/paper-translated.pdf"));
    std::fs::remove_file(root.0.join(job_path("rendered/paper-translated.pdf"))).unwrap();
    prune_succeeded_job_intermediates(&root.0, &job);
    assert!(root.exists(&job_path("rendered/paper-translated.previous.pdf")));
}

#[test]
fn paths_into_other_job_directories_are_not_touched() {
    let root = Root::new("outside");
    let mut job = succeeded_mineru_job(&root);
    let other_zip = "jobs/20261028080000-bbbbbb/ocr/mineru_bundle.zip";
    root.write(other_zip, b"zip of another job");
    let artifacts = job.artifacts.as_mut().unwrap();
    artifacts.provider_zip = Some(other_zip.into());
    artifacts.ocr_provider_diagnostics = None;

    prune_succeeded_job_intermediates(&root.0, &job);
    assert!(root.exists(other_zip));

    std::fs::remove_file(root.0.join(other_zip)).unwrap();
    clear_pruned_record_fields(&root.0, &mut job);
    assert_eq!(
        job.artifacts.as_ref().unwrap().provider_zip.as_deref(),
        Some(other_zip),
        "another job's path is not this record's to clear"
    );
}

#[test]
fn job_ids_that_are_not_plain_names_prune_nothing() {
    let root = Root::new("escape");
    let mut job = succeeded_mineru_job(&root);
    for job_id in ["", "..", "../x", "a/b", ".hidden"] {
        job.job_id = job_id.into();
        assert_eq!(prune_succeeded_job_intermediates(&root.0, &job), IntermediatesPruned::default());
    }
    assert!(root.exists(&job_path("ocr/mineru_bundle.zip")));
}

#[cfg(unix)]
#[test]
fn a_symlink_inside_the_raw_directory_is_removed_without_following_it() {
    let root = Root::new("symlink");
    let job = succeeded_mineru_job(&root);
    let outside = root.write("outside/keep.pdf", b"not ours");
    std::os::unix::fs::symlink(&outside, root.0.join(job_path("ocr/unpacked/link.pdf"))).unwrap();
    std::os::unix::fs::symlink(outside.parent().unwrap(), root.0.join(job_path("ocr/unpacked/linkdir")))
        .unwrap();

    prune_succeeded_job_intermediates(&root.0, &job);

    assert!(outside.exists());
    assert!(root.0.join(job_path("ocr/unpacked/link.pdf")).symlink_metadata().is_err());
    assert!(root.0.join(job_path("ocr/unpacked/linkdir")).symlink_metadata().is_err());
}

#[test]
fn referenced_job_directories_include_sources_children_and_paths_into_other_jobs() {
    let root = Root::new("refs");
    let mut job = JobSnapshot::new("20261028100000-cccccc".into(), CreateJobInput::default(), vec![]);
    job.request_payload.source.artifact_job_id = "20261028080000-source".into();
    job.artifacts = Some(JobArtifacts {
        ocr_job_id: Some("20261028100000-cccccc-ocr".into()),
        translations_dir: Some("jobs/20261028070000-transl/translated".into()),
        normalized_document_json: Some(
            root.0
                .join("jobs/20261028060000-normal/ocr/normalized/document.v1.json")
                .to_string_lossy()
                .into_owned(),
        ),
        ..Default::default()
    });

    let dirs = job_dirs_referenced_by(&root.0, &job);

    assert_eq!(
        dirs.into_iter().collect::<Vec<_>>(),
        [
            "20261028060000-normal",
            "20261028070000-transl",
            "20261028080000-source",
            "20261028100000-cccccc",
            "20261028100000-cccccc-ocr",
        ]
    );
}

#[test]
fn the_engine_work_dir_goes_and_the_ocr_stream_copy_becomes_a_link() {
    // 2026-11-02：rpr_fit 引擎的工作目录只有渲染器自己读；OCR 一片片公布时写的整份文档和规范化文档逐字节相同。
    let root = Root::new("engine-stream");
    let job = succeeded_mineru_job(&root);
    let document = br#"{"pages": [1, 2, 3]}"#;
    root.write(&job_path("ocr/normalized/document.v1.json"), document);
    root.write(&job_path("ocr/stream/document.v1.json"), document);
    root.write(&job_path("ocr/stream/manifest.json"), b"{\"done\": true}");
    root.write(&job_path("rendered/typst/rpr-fit-engine/translations.json"), b"[]");
    root.write(&job_path("rendered/typst/rpr-fit-engine/out/overlay.pdf"), b"overlay");
    root.write(&job_path("rendered/typst/book-overlays/book-overlay.pdf"), b"served");

    prune_succeeded_job_intermediates(&root.0, &job);

    assert!(!root.exists(&job_path("rendered/typst/rpr-fit-engine")));
    assert!(root.exists(&job_path("rendered/typst/book-overlays/book-overlay.pdf")), "what the API serves stays");
    assert!(root.exists(&job_path("ocr/stream/manifest.json")));
    let stream = root.0.join(job_path("ocr/stream/document.v1.json"));
    assert_eq!(std::fs::read(&stream).unwrap(), document, "readers of the stream still get the whole document");
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let normalized = root.0.join(job_path("ocr/normalized/document.v1.json"));
        assert_eq!(stream.metadata().unwrap().ino(), normalized.metadata().unwrap().ino());
        // 链过的不再算
        let again = prune_succeeded_job_intermediates(&root.0, &job);
        assert_eq!(again, IntermediatesPruned::default());
    }
}

#[test]
fn a_stream_copy_that_differs_is_left_alone() {
    let root = Root::new("stream-differs");
    let job = succeeded_mineru_job(&root);
    root.write(&job_path("ocr/normalized/document.v1.json"), br#"{"pages": [1]}"#);
    root.write(&job_path("ocr/stream/document.v1.json"), br#"{"pages": [2]}"#);

    prune_succeeded_job_intermediates(&root.0, &job);

    assert_eq!(std::fs::read(root.0.join(job_path("ocr/stream/document.v1.json"))).unwrap(), br#"{"pages": [2]}"#);
}
