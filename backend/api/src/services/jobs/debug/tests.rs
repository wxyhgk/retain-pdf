use std::fs;
use std::path::Path;

use serde_json::json;

use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot, ListTranslationItemsQuery};

use super::{load_translation_debug_item_view, load_translation_debug_list_view};

fn build_job(root: &Path) -> JobSnapshot {
    let mut job = JobSnapshot::new(
        "job-debug-1".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.artifacts = Some(JobArtifacts {
        job_root: Some(root.to_string_lossy().to_string()),
        translations_dir: Some(root.join("translated").to_string_lossy().to_string()),
        ..JobArtifacts::default()
    });
    job
}

#[test]
fn debug_list_falls_back_to_manifest_when_index_missing() {
    let root = std::env::temp_dir().join(format!("rust-api-debug-{}", fastrand::u64(..)));
    let data_root = root.join("data");
    let job_root = data_root.join("jobs/job-debug-1");
    let translated_dir = job_root.join("translated");
    fs::create_dir_all(&translated_dir).expect("translated dir");
    fs::write(
        translated_dir.join("page-1.json"),
        serde_json::to_vec_pretty(&json!([
            {
                "item_id": "p001-b001",
                "page_idx": 0,
                "block_idx": 1,
                "block_type": "text",
                "classification_label": "body",
                "source_text": "Source paragraph with math $E=mc^2$",
                "translated_text": "中文段落，含公式 $E=mc^2$",
                "translation_diagnostics": {
                    "route_path": ["direct_typst", "single_item"],
                    "fallback_to": "sentence_level",
                    "degradation_reason": "transport_error",
                    "error_trace": [{"type": "TranslationTransportError"}],
                    "final_status": "translated"
                }
            },
            {
                "item_id": "p001-b002",
                "page_idx": 0,
                "block_idx": 2,
                "block_type": "reference",
                "classification_label": "ref_text",
                "source_text": "1. Smith J. Example reference",
                "translated_text": "",
                "skip_reason": "ref_text_skip",
                "should_translate": false,
                "final_status": "skipped"
            }
        ]))
        .expect("page payload"),
    )
    .expect("write page payload");
    fs::write(
        translated_dir.join("translation-manifest.json"),
        serde_json::to_vec_pretty(&json!({
            "pages": [
                {
                    "page_index": 0,
                    "path": "page-1.json"
                }
            ]
        }))
        .expect("manifest json"),
    )
    .expect("write manifest");

    let job = build_job(&job_root);
    let view = load_translation_debug_list_view(
        &data_root,
        &job,
        &ListTranslationItemsQuery {
            limit: 20,
            offset: 0,
            page: Some(1),
            final_status: Some("translated".to_string()),
            error_type: Some("translationtransporterror".to_string()),
            route: Some("direct_typst".to_string()),
            q: Some("source paragraph".to_string()),
        },
    )
    .expect("debug list");

    assert_eq!(view.total, 1);
    assert_eq!(view.items.len(), 1);
    assert_eq!(view.items[0].item_id, "p001-b001");
    assert_eq!(
        view.items[0].route_path,
        vec!["direct_typst", "single_item"]
    );
    assert_eq!(view.items[0].error_types, vec!["TranslationTransportError"]);

    let _ = fs::remove_dir_all(root);
}

#[test]
fn debug_item_view_reads_item_from_manifest_payload() {
    let root = std::env::temp_dir().join(format!("rust-api-debug-item-{}", fastrand::u64(..)));
    let data_root = root.join("data");
    let job_root = data_root.join("jobs/job-debug-1");
    let translated_dir = job_root.join("translated");
    fs::create_dir_all(&translated_dir).expect("translated dir");
    fs::write(
        translated_dir.join("page-3.json"),
        serde_json::to_vec_pretty(&json!([
            {
                "item_id": "p003-b014",
                "page_idx": 2,
                "block_idx": 14,
                "block_type": "text",
                "source_text": "English body paragraph sk-secret",
                "translated_text": "中文正文段落",
                "api_key": "sk-secret",
                "translation_diagnostics": {
                    "message": "contains sk-secret"
                }
            }
        ]))
        .expect("page payload"),
    )
    .expect("write page payload");
    fs::write(
        translated_dir.join("translation-manifest.json"),
        serde_json::to_vec_pretty(&json!({
            "pages": [
                {
                    "page_index": 2,
                    "path": "page-3.json"
                }
            ]
        }))
        .expect("manifest json"),
    )
    .expect("write manifest");
    let mut job = build_job(&job_root);
    job.request_payload.translation.api_key = "sk-secret".to_string();
    let view = load_translation_debug_item_view(&data_root, &job, "p003-b014").expect("debug item");

    assert_eq!(view.item_id, "p003-b014");
    assert_eq!(view.page_idx, 2);
    assert_eq!(view.page_number, 3);
    assert_eq!(view.page_path, "page-3.json");
    assert_eq!(view.item["translated_text"], "中文正文段落");
    assert_eq!(view.item["api_key"], "");
    assert_eq!(
        view.item["source_text"],
        "English body paragraph [REDACTED]"
    );
    assert_eq!(
        view.item["translation_diagnostics"]["message"],
        "contains [REDACTED]"
    );

    let _ = fs::remove_dir_all(root);
}
