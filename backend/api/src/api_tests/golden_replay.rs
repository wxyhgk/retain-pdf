use std::path::PathBuf;

/// 黄金 fixture 结构化回归 —— 用已固化的翻译成果当用例，
///
/// 覆盖：manifest 页数、page 文件完整性、document.v1 页数一致性、
/// pipeline_summary 关键字段、spec 占位符已脱敏。
///
/// 不触网、不调 Python，CI 常绿；真实渲染由
/// `pipeline/devtools/golden_harness.py --render` 覆盖。
fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/golden-jobs/chem-6ada81-10p")
        .canonicalize()
        .expect("golden fixture dir must exist — did Step 1 run?")
}

fn load_json(path: &PathBuf) -> serde_json::Value {
    let raw =
        std::fs::read_to_string(path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    serde_json::from_str(&raw).unwrap_or_else(|e| panic!("parse {}: {e}", path.display()))
}

#[test]
fn golden_fixture_exists_and_has_expected_layout() {
    let root = fixture_root();
    for rel in [
        "specs/render.spec.json",
        "specs/translate.spec.json",
        "ocr/normalized/document.v1.json",
        "translated/translation-manifest.json",
        "artifacts/pipeline_summary.json",
    ] {
        let p = root.join(rel);
        assert!(p.exists(), "missing fixture file: {}", p.display());
        assert!(
            p.metadata().unwrap().len() > 0,
            "empty fixture file: {}",
            p.display()
        );
    }
    for i in 1..=10 {
        let p = root.join(format!("translated/page-{i:03}-deepseek.json"));
        assert!(p.exists(), "missing page file: {}", p.display());
    }
}

#[test]
fn golden_manifest_pages_match_document_and_summary() {
    let root = fixture_root();
    let manifest = load_json(&root.join("translated/translation-manifest.json"));
    let pages = manifest
        .get("pages")
        .and_then(|v| v.as_array())
        .expect("manifest.pages must be array");
    assert_eq!(
        pages.len(),
        10,
        "manifest pages should be 10, got {}",
        pages.len()
    );

    for entry in pages {
        let rel = entry
            .get("path")
            .and_then(|v| v.as_str())
            .expect("manifest entry must have path");
        let p = root.join("translated").join(rel);
        assert!(p.exists(), "manifest refs missing file: {rel}");
        let meta = std::fs::metadata(&p).unwrap();
        assert!(meta.len() > 10, "page file unexpectedly tiny: {rel}");
        // 每个 page 应为 JSON list 且非空
        let v = load_json(&p);
        let arr = v.as_array().expect("page json should be array");
        assert!(!arr.is_empty(), "page {rel} should not be empty");
    }

    let doc = load_json(&root.join("ocr/normalized/document.v1.json"));
    let doc_pages = doc
        .get("page_count")
        .and_then(|v| v.as_u64())
        .expect("document page_count");
    assert_eq!(
        doc_pages as usize,
        pages.len(),
        "document page_count {doc_pages} vs manifest {}",
        pages.len()
    );

    let summary = load_json(&root.join("artifacts/pipeline_summary.json"));
    let processed = summary
        .get("pages_processed")
        .and_then(|v| v.as_u64())
        .expect("summary pages_processed");
    assert_eq!(
        processed as usize,
        pages.len(),
        "summary pages_processed {processed} vs manifest {}",
        pages.len()
    );
    assert_eq!(
        summary.get("render_mode").and_then(|v| v.as_str()),
        Some("auto")
    );
}

#[test]
fn golden_specs_have_no_absolute_paths() {
    let root = fixture_root();
    for name in [
        "render.spec.json",
        "translate.spec.json",
        "normalize.spec.json",
        "provider.spec.json",
    ] {
        let p = root.join("specs").join(name);
        if !p.exists() {
            continue;
        }
        let raw = std::fs::read_to_string(&p).unwrap();
        assert!(
            !raw.contains("/Users/"),
            "{name} still contains absolute /Users/ — fixture not sanitized"
        );
        // 已重写为占位符的应可被 harness 识别
        if name == "render.spec.json" || name == "translate.spec.json" {
            assert!(
                raw.contains("{JOB_ROOT}"),
                "{name} should contain {{JOB_ROOT}} placeholder"
            );
        }
    }
    // document.v1 也不应含 /Users/
    let doc_raw = std::fs::read_to_string(root.join("ocr/normalized/document.v1.json")).unwrap();
    assert!(
        !doc_raw.contains("/Users/"),
        "document.v1.json still contains /Users/"
    );
}
