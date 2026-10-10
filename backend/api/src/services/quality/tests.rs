use std::fs;

use serde_json::json;

use super::*;

fn fixture(name: &str) -> QualitySources {
    let root = std::env::temp_dir().join(format!("retain-quality-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    let sources = QualitySources { artifacts_dir: root.join("artifacts"), translated_dir: root.join("translated") };
    fs::create_dir_all(&sources.artifacts_dir).unwrap();
    fs::create_dir_all(&sources.translated_dir).unwrap();
    sources
}

fn write(path: PathBuf, value: serde_json::Value) {
    fs::write(path, value.to_string()).unwrap();
}

fn full_fixture(name: &str) -> QualitySources {
    let sources = fixture(name);
    write(sources.translated_dir.join("term-base.v1.json"), json!({
        "preparation_mode": "editorial", "complete": false,
        "summary": {"term_count": 874, "locked_count": 664, "conflict_count": 45},
        "extraction": {"batch_count": 120, "failed_batch_ids": ["b00110", "b00118"]}
    }));
    write(sources.translated_dir.join("style-guide.v1.json"), json!({
        "complete": false, "llm_status": "failed", "rules": [{"rule": "a"}, {"rule": "b"}]
    }));
    write(sources.translated_dir.join("page-001-deepseek.json"), json!([
        {"item_id": "p001-b000", "page_idx": 0, "final_status": "translated"},
        {"item_id": "p001-b001", "page_idx": 0, "final_status": "kept_origin", "skip_reason": "skip_interline_equation"},
        {"item_id": "p001-b002", "page_idx": 0, "final_status": "kept_origin", "skip_reason": "skip_display_formula"},
    ]));
    write(sources.translated_dir.join("page-002-deepseek.json"), json!([
        {"item_id": "p002-b000", "page_idx": 1, "final_status": "kept_origin", "skip_reason": "skip_model_keep_origin"},
        {"item_id": "p002-b001", "page_idx": 1, "final_status": "failed", "skip_reason": ""},
    ]));
    write(sources.artifacts_dir.join("translation_qa.v1.json"), json!({
        "generated_at": "2026-10-10T02:46:31+00:00",
        "summary": {"item_count": 794, "checked_item_count": 708, "violation_count": 3,
                    "by_severity": {"critical": 0, "major": 1, "minor": 2}, "by_check": {"terms": 1, "punctuation": 2},
                    "by_type": {"term_violation": 1, "halfwidth_punctuation": 2}},
        "violations": [
            {"id": "qa-1", "check": "terms", "type": "term_violation", "severity": "major", "message": "m1",
             "location": {"item_id": "p001-b000", "page_number": 1}},
            {"id": "qa-2", "check": "punctuation", "type": "halfwidth_punctuation", "severity": "minor", "message": "m2",
             "location": {"item_id": "p002-b003", "page_number": 2}},
            {"id": "qa-3", "check": "punctuation", "type": "halfwidth_punctuation", "severity": "minor", "message": "m3",
             "location": {"item_id": "p002-b004"}},
        ]
    }));
    write(sources.artifacts_dir.join("fit_report.v1.json"), json!({
        "summary": {"blocks": 4, "shrunk_blocks": 2, "overflow_blocks": 1, "min_scale": 0.4436,
                    "min_final_font_size": 4.8, "math_formulas": 10, "math_failed": 1},
        "blocks": [
            {"item_id": "p001-b000", "page": 1, "measured": true, "scale": 1.0, "overflow": false},
            {"item_id": "p002-b003", "page": 2, "measured": true, "scale": 0.9, "overflow": true, "overflow_pt": 3.5, "final_font_size": 9.0},
            {"item_id": "p002-b004", "page": 2, "measured": true, "scale": 0.4436, "overflow": false, "final_font_size": 4.8},
            {"item_id": "p003-b000", "page": 3, "measured": false, "scale": 0.5, "overflow": false},
        ]
    }));
    write(sources.artifacts_dir.join("refine_report.v1.json"), json!({
        "mode": "editorial", "status": "completed", "stopped_reason": null, "generated_at": "2026-10-10T03:15:21+00:00",
        "qa_before": {"violation_count": 664, "by_severity": {"major": 204}},
        "qa_after": {"violation_count": 534, "by_severity": {"major": 69}},
        "fix_summary": {"applied": 155, "rejected": 67, "skipped": 59,
                        "reject_reasons": {"crosses_protected_token": 30}, "skip_reasons": {"model_returned_no_edit": 59}},
        "editorial": {"escalated": [
            {"item_id": "p002-b001", "page_number": 2, "reason": "2 轮后仍未解决", "categories": ["terminology"], "attempts": ["patch:rejected"]},
            {"item_id": "p005-b002", "reason": "交给人确认", "categories": [], "attempts": []},
        ]}
    }));
    sources
}

#[test]
fn summary_reads_every_report_section() {
    let sources = full_fixture("summary");
    let view = quality_summary("job-1", &sources);

    let preparation = view.preparation.expect("preparation");
    assert_eq!(preparation.mode, "editorial");
    assert_eq!(preparation.problems, ["term_base_incomplete", "style_guide_fallback"]);
    let term_base = preparation.term_base.unwrap();
    assert_eq!((term_base.term_count, term_base.locked_count, term_base.batch_count), (874, 664, 120));
    assert_eq!(term_base.failed_batch_ids, ["b00110", "b00118"]);
    assert_eq!(preparation.style_guide.unwrap().rule_count, 2);

    let qa = view.qa.expect("qa");
    assert_eq!((qa.violation_count, qa.by_severity["major"].as_u64()), (3, Some(1)));

    let layout = view.layout.expect("layout");
    assert_eq!(layout.overflow_pages, [2]);
    assert_eq!(layout.small_blocks, 1, "没量过的块不算缩得太小");
    assert_eq!((layout.min_scale, layout.math_failed), (Some(0.4436), 1));

    let refine = view.refine.expect("refine");
    assert_eq!((refine.applied, refine.rejected, refine.skipped, refine.escalated_count), (155, 67, 59, 2));
    assert_eq!(refine.qa_after.unwrap().violation_count, 534);
    assert_eq!(refine.stopped_reason, None);

    // 公式、模型判定不用翻都不是问题；只有 failed 是。
    assert_eq!(view.untranslated, UntranslatedSummary { failed: 1, formula: 2, model_kept: 1, other: 0 });
}

#[test]
fn missing_reports_are_null_not_errors() {
    let sources = fixture("empty");
    let view = quality_summary("job-2", &sources);
    assert!(view.preparation.is_none() && view.qa.is_none() && view.layout.is_none() && view.refine.is_none());
    assert_eq!(view.untranslated, UntranslatedSummary::default());
    let items = quality_items(&sources, &QualityItemsQuery { kind: "qa".into(), limit: 10, ..Default::default() });
    assert_eq!(items.total, 0);
}

fn items(sources: &QualitySources, kind: &str) -> QualityItemsView {
    quality_items(sources, &QualityItemsQuery { kind: kind.into(), limit: 200, ..Default::default() })
}

#[test]
fn item_lists_carry_page_reason_and_detail() {
    let sources = full_fixture("items");

    let layout = items(&sources, "layout");
    assert_eq!(layout.items.iter().map(|i| (i.translation_item_id.as_str(), i.reason.as_str())).collect::<Vec<_>>(),
               [("p002-b003", "overflow"), ("p002-b004", "small_scale")]);
    // 阅读页的编号是四位（/reader/regions），跳转和取框靠它。
    assert_eq!(layout.items[0].item_id, "p002-b0003");
    assert_eq!(layout.items[0].detail["overflow_pt"], 3.5);

    let untranslated = items(&sources, "untranslated");
    assert_eq!(untranslated.items.iter().map(|i| i.reason.as_str()).collect::<Vec<_>>(),
               ["formula", "formula", "model_kept", "failed"]);
    assert_eq!(untranslated.items[3].page, Some(2));

    let qa = items(&sources, "qa");
    assert_eq!(qa.items[2].page, Some(2), "没有 page_number 时从 item_id 推页码");
    let serialized = serde_json::to_value(&qa.items[0]).unwrap();
    assert_eq!((serialized["severity"].as_str(), serialized["check"].as_str()), (Some("major"), Some("terms")));

    let escalated = items(&sources, "escalated");
    assert_eq!(escalated.total, 2);
    assert_eq!((escalated.items[1].page, escalated.items[1].reason.as_str()), (Some(5), "交给人确认"));
}

#[test]
fn item_lists_filter_by_page_and_severity_and_paginate() {
    let sources = full_fixture("filters");
    let page_two = quality_items(&sources, &QualityItemsQuery { kind: "qa".into(), page: Some(2), limit: 1, offset: 1, ..Default::default() });
    assert_eq!((page_two.total, page_two.items.len()), (2, 1));
    assert_eq!(page_two.items[0].translation_item_id, "p002-b004");
    let major = quality_items(&sources, &QualityItemsQuery { kind: "qa".into(), severity: Some("major".into()), limit: 50, ..Default::default() });
    assert_eq!(major.total, 1);
}
