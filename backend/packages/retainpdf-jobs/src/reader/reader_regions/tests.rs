use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use super::load_reader_regions_view;
use retainpdf_core::models::{CreateJobInput, JobArtifacts, JobSnapshot};

fn temp_data_root(name: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_nanos())
        .unwrap_or_default();
    let root = std::env::temp_dir().join(format!(
        "reader-regions-{name}-{}-{nanos}",
        std::process::id()
    ));
    fs::create_dir_all(&root).expect("temp data root");
    root
}

fn job_at(job_id: &str, job_rel: &str) -> JobSnapshot {
    let mut input = CreateJobInput::default();
    input.runtime.job_id = job_id.to_string();
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()]);
    job.artifacts = Some(JobArtifacts {
        job_root: Some(job_rel.to_string()),
        normalized_document_json: Some(format!("{job_rel}/ocr/normalized/document.v1.json")),
        translations_dir: Some(format!("{job_rel}/translated")),
        ..JobArtifacts::default()
    });
    job
}

fn write_json(path: &Path, value: &Value) {
    fs::create_dir_all(path.parent().unwrap()).expect("parent dir");
    fs::write(path, serde_json::to_vec(value).expect("json")).expect("write json");
}

fn block(block_id: &str, order: i64, sub_type: &str, text: &str) -> Value {
    json!({
        "block_id": block_id,
        "order": order,
        "type": "text",
        "sub_type": sub_type,
        "bbox": [10.0, 10.0 + order as f64 * 20.0, 200.0, 25.0 + order as f64 * 20.0],
        "text": text
    })
}

fn sample_job(data_root: &Path) -> JobSnapshot {
    let job_root = data_root.join("jobs/sample");
    let mut title = block("p001-b0000", 0, "title", "Paper");
    title["metadata"] = json!({"raw_title_level": 1});
    write_json(
        &job_root.join("ocr/normalized/document.v1.json"),
        &json!({
            "pages": [
                {"page_index": 0, "blocks": [
                    title,
                    block("p001-b0001", 1, "heading", "Intro"),
                    {"block_id": "p001-b0002", "order": 2, "type": "image", "sub_type": "image_body",
                     "bbox": [10.0, 60.0, 200.0, 160.0], "text": ""},
                    block("p001-b0003", 3, "body", "First half"),
                    block("p001-b0004", 4, "page_number", "1")
                ]},
                {"page_index": 1, "blocks": [
                    block("p002-b0000", 0, "body", "second half"),
                    block("p002-b0001", 1, "reference_entry", "[1] Ref")
                ]}
            ]
        }),
    );
    let unit = |item_id: &str, page_idx: i64, order: i64, own: &str| {
        json!({
            "item_id": item_id,
            "page_idx": page_idx,
            "reading_order": order,
            "bbox": [10.0, 70.0, 200.0, 90.0],
            "translated_text": own,
            "translation_unit_translated_text": "前半后半",
            "translation_unit_member_ids": ["p001-b003", "p002-b000"],
            "continuation_group": "cg-001-001",
            "continuation_decision": "joined"
        })
    };
    write_json(
        &job_root.join("translated/page-001.json"),
        &json!([
            {"item_id": "p001-b000", "page_idx": 0, "reading_order": 0,
             "bbox": [10.0, 10.0, 200.0, 25.0], "translated_text": "论文"},
            {"item_id": "p001-b001", "page_idx": 0, "reading_order": 1,
             "bbox": [10.0, 30.0, 200.0, 45.0], "translated_text": "引言",
             "translation_unit_member_ids": ["p001-b001"], "continuation_group": ""},
            unit("p001-b003", 0, 3, "前半")
        ]),
    );
    write_json(
        &job_root.join("translated/page-002.json"),
        &json!([unit("p002-b000", 1, 0, "后半")]),
    );
    write_json(
        &job_root.join("translated/translation-manifest.json"),
        &json!({"pages": [
            {"page_index": 0, "path": "page-001.json"},
            {"page_index": 1, "path": "page-002.json"}
        ]}),
    );
    job_at("sample", "jobs/sample")
}

#[test]
fn reader_regions_interleave_source_only_blocks_in_reading_order() {
    let data_root = temp_data_root("order");
    let view = load_reader_regions_view(&data_root, &sample_job(&data_root)).expect("regions");
    let ids: Vec<&str> = view.items.iter().map(|item| item.item_id.as_str()).collect();
    assert_eq!(
        ids,
        [
            "p001-b0000",
            "p001-b0001",
            "p001-b0002",
            "p001-b0003",
            "p001-b0004",
            "p002-b0000",
            "p002-b0001"
        ]
    );
    let orders: Vec<Option<i64>> = view.items.iter().map(|item| item.reading_order).collect();
    assert_eq!(
        orders,
        [Some(0), Some(1), Some(2), Some(3), Some(4), Some(0), Some(1)]
    );
    fs::remove_dir_all(data_root).ok();
}

#[test]
fn reader_regions_expose_sub_type_and_heading_level() {
    let data_root = temp_data_root("types");
    let view = load_reader_regions_view(&data_root, &sample_job(&data_root)).expect("regions");
    let by_id = |id: &str| {
        view.items
            .iter()
            .find(|item| item.item_id == id)
            .expect("item")
    };
    assert_eq!(by_id("p001-b0000").sub_type.as_deref(), Some("title"));
    assert_eq!(by_id("p001-b0000").heading_level, Some(1));
    assert_eq!(by_id("p001-b0001").sub_type.as_deref(), Some("heading"));
    assert_eq!(by_id("p001-b0001").heading_level, Some(2));
    assert_eq!(by_id("p001-b0002").sub_type.as_deref(), Some("image_body"));
    assert_eq!(by_id("p001-b0004").sub_type.as_deref(), Some("page_number"));
    assert_eq!(by_id("p001-b0004").status, "source_only");
    assert_eq!(by_id("p001-b0003").heading_level, None);
    fs::remove_dir_all(data_root).ok();
}

#[test]
fn reader_regions_link_cross_page_continuations() {
    let data_root = temp_data_root("continuation");
    let view = load_reader_regions_view(&data_root, &sample_job(&data_root)).expect("regions");
    let by_id = |id: &str| {
        view.items
            .iter()
            .find(|item| item.item_id == id)
            .expect("item")
    };
    let first = by_id("p001-b0003");
    let second = by_id("p002-b0000");
    assert_eq!(first.continuation_group_id.as_deref(), Some("cg-001-001"));
    assert_eq!(second.continuation_group_id.as_deref(), Some("cg-001-001"));
    assert_eq!(first.translated.text.as_deref(), Some("前半后半"));
    assert_eq!(first.translated_block_text.as_deref(), Some("前半"));
    assert_eq!(second.translated_block_text.as_deref(), Some("后半"));
    // A single-member unit is not a continuation even with a group field present.
    assert_eq!(by_id("p001-b0001").continuation_group_id, None);
    assert_eq!(by_id("p001-b0001").translated_block_text, None);

    let wire = serde_json::to_value(by_id("p001-b0002")).expect("wire");
    assert!(wire.get("continuation_group_id").is_none());
    assert!(wire.get("translated_block_text").is_none());
    fs::remove_dir_all(data_root).ok();
}
