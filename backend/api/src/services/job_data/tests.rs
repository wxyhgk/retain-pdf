use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use serde_json::json;

use super::*;

fn fixture(name: &str) -> JobDataRoots {
    let root = std::env::temp_dir().join(format!("retain-job-data-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    let roots = JobDataRoots {
        artifacts: root.join("artifacts"),
        translated: root.join("translated"),
        logs: root.join("logs"),
    };
    for dir in [&roots.artifacts, &roots.translated, &roots.logs] {
        fs::create_dir_all(dir).unwrap();
    }
    roots
}

fn write(path: PathBuf, body: String) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, body).unwrap();
}

fn params(pairs: &[(&str, &str)]) -> HashMap<String, String> {
    pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
}

fn full_fixture(name: &str) -> JobDataRoots {
    let roots = fixture(name);
    write(roots.translated.join("page-001-deepseek.json"), json!([
        {"item_id": "p001-b001", "page_idx": 0, "final_status": "translated", "skip_reason": "", "source_text": "A", "translated_text": "甲"},
        {"item_id": "p001-b002", "page_idx": 0, "final_status": "kept_origin", "skip_reason": "skip_interline_equation", "source_text": "$x$", "translated_text": ""},
    ]).to_string());
    write(roots.translated.join("page-002-deepseek.json"), json!([
        {"item_id": "p002-b001", "page_idx": 1, "final_status": "failed", "skip_reason": "", "source_text": "B", "translated_text": ""},
    ]).to_string());
    write(roots.translated.join("revisions.v1.jsonl"), [
        json!({"revision_id": "r1", "item_id": "p001-b001", "page_idx": 0, "source": "refine", "ts": "2026-10-10T01:00:00Z", "new_text": "甲1"}),
        json!({"revision_id": "r2", "item_id": "p001-b001", "page_idx": 0, "source": "user", "ts": "2026-10-10T03:00:00Z", "new_text": "甲2"}),
        json!({"revision_id": "r3", "item_id": "p002-b001", "page_idx": 1, "source": "refine", "ts": "2026-10-10T02:00:00Z", "new_text": "乙"}),
    ].iter().map(|row| format!("{row}\n")).collect::<String>() + "{broken\n");
    write(roots.artifacts.join("translation_qa.v1.json"), json!({"violations": [
        {"id": "qa-1", "check": "terms", "type": "term_violation", "severity": "major", "message": "m", "location": {"item_id": "p009-b012", "page_number": 9}},
        {"id": "qa-2", "check": "punctuation", "type": "halfwidth", "severity": "minor", "message": "m", "location": {"item_id": "p010-b4"}},
    ]}).to_string());
    write(roots.artifacts.join("fit_report.v1.json"), json!({"blocks": [
        {"item_id": "p009-b012", "page": 9, "scale": 0.96, "overflow": true},
        {"item_id": "p009-b013", "page": 9, "scale": 0.5, "overflow": false},
    ]}).to_string());
    write(roots.translated.join("domain-context.json"), json!({"domain": "编程语言理论", "summary": "s", "translation_guidance": "g", "preview_text": "长文本"}).to_string());
    roots
}

#[test]
fn the_registry_in_the_contract_is_valid() {
    validate_registry().unwrap();
    assert!(registry().len() >= 10);
    for name in ["translation_items", "revisions", "qa_violations", "layout_blocks", "escalated", "terms", "events", "domain_context"] {
        assert!(registry().contains_key(name), "{name}");
    }
}

#[test]
fn rows_carry_shared_identity_fields_from_wherever_each_file_keeps_them() {
    let roots = full_fixture("identity");
    let qa = query("job", "qa_violations", &roots, &params(&[])).unwrap();
    let rows = qa.rows.unwrap();
    assert_eq!(rows[0]["item_id"], "p009-b012");
    assert_eq!(rows[0]["reader_item_id"], "p009-b0012");
    assert_eq!(rows[0]["page"], 9);
    assert_eq!(rows[1]["page"], 10, "没有 page_number 时从 item_id 推");
    assert_eq!(rows[1]["reader_item_id"], "p010-b0004");
    assert!(rows[0].get("location").is_none(), "只返回登记的字段");

    let items = query("job", "translation_items", &roots, &params(&[("fields", "final_status")])).unwrap();
    let rows = items.rows.unwrap();
    assert_eq!(rows.len(), 3, "每页一个文件，合起来");
    assert_eq!(rows[2]["page"], 2, "page_idx 0 起，加 1");
    let mut keys: Vec<_> = rows[0].keys().cloned().collect();
    keys.sort();
    assert_eq!(keys, ["final_status", "item_id", "page", "reader_item_id"], "公共字段 + 要的字段");
}

#[test]
fn filters_are_equality_with_comma_or_and_typed() {
    let roots = full_fixture("filters");
    let failed = query("job", "translation_items", &roots, &params(&[("final_status", "failed,kept_origin")])).unwrap();
    assert_eq!(failed.total, 2);
    let page_nine = query("job", "layout_blocks", &roots, &params(&[("page", "9"), ("overflow", "true")])).unwrap();
    assert_eq!(page_nine.total, 1);
    // 块编号三位、四位两种写法都认。
    let by_reader_id = query("job", "revisions", &roots, &params(&[("item_id", "p001-b0001")])).unwrap();
    assert_eq!(by_reader_id.total, 2);
}

#[test]
fn group_by_counts_and_sort_and_paging() {
    let roots = full_fixture("group");
    let groups = query("job", "revisions", &roots, &params(&[("group_by", "item_id")])).unwrap();
    assert_eq!(groups.total, 3, "坏行跳过");
    let groups = groups.groups.unwrap();
    assert_eq!((groups[0].value.clone(), groups[0].count), (json!("p001-b001"), 2));

    let latest = query("job", "revisions", &roots, &params(&[("sort", "-ts"), ("limit", "1")])).unwrap();
    assert_eq!(latest.rows.unwrap()[0]["revision_id"], "r2");
    let second = query("job", "revisions", &roots, &params(&[("sort", "ts"), ("offset", "1"), ("limit", "1")])).unwrap();
    assert_eq!(second.rows.unwrap()[0]["revision_id"], "r3");
}

#[test]
fn object_datasets_return_only_registered_fields() {
    let roots = full_fixture("object");
    let view = query("job", "domain_context", &roots, &params(&[])).unwrap();
    let object = view.object.unwrap();
    assert_eq!(object["domain"], "编程语言理论");
    assert!(object.get("preview_text").is_none());
    assert!(view.rows.is_none());
}

#[test]
fn missing_files_are_unavailable_not_errors() {
    let roots = fixture("missing");
    let view = query("job", "escalated", &roots, &params(&[])).unwrap();
    assert!(!view.available);
    assert_eq!(view.rows.unwrap().len(), 0);
    let listing = catalog("job", &roots);
    assert!(listing.datasets.iter().all(|dataset| !dataset.available));
    let full = catalog("job", &full_fixture("catalog"));
    let available: Vec<_> = full.datasets.iter().filter(|d| d.available).map(|d| d.name.as_str()).collect();
    assert!(available.contains(&"translation_items") && available.contains(&"revisions"), "{available:?}");
}

#[test]
fn bad_requests_name_the_problem() {
    let roots = full_fixture("bad");
    for (pairs, needle) in [
        (vec![("nope", "1")], "has no field `nope`"),
        (vec![("scale", "0.5")], "cannot be used as a filter"),
        (vec![("page", "nine")], "expects integer"),
        (vec![("overflow", "yes")], "expects boolean"),
        (vec![("fields", "scale,nope")], "has no field `nope`"),
        (vec![("limit", "0")], "limit must be"),
        (vec![("limit", "5000")], "limit must be"),
        (vec![("group_by", "scale")], "cannot be used for group_by"),
    ] {
        let error = query("job", "layout_blocks", &roots, &params(&pairs)).unwrap_err();
        assert!(error.to_string().contains(needle), "{pairs:?}: {error}");
    }
    assert!(matches!(query("job", "secrets", &roots, &params(&[])), Err(AppError::NotFound(_))));
}

#[test]
fn a_changed_file_is_reparsed() {
    let roots = full_fixture("cache");
    assert_eq!(query("job", "revisions", &roots, &params(&[])).unwrap().total, 3);
    std::thread::sleep(std::time::Duration::from_millis(20));
    let path = roots.translated.join("revisions.v1.jsonl");
    let mut body = fs::read_to_string(&path).unwrap();
    body.push_str(&format!("{}\n", json!({"revision_id": "r4", "item_id": "p002-b001", "page_idx": 1, "source": "agent"})));
    fs::write(&path, body).unwrap();
    assert_eq!(query("job", "revisions", &roots, &params(&[])).unwrap().total, 4);
}

