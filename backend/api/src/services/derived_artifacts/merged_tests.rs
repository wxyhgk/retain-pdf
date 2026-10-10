use super::*;
use crate::test_support::python::project_venv_bin;

struct Dir(PathBuf);

impl Dir {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("retain-merged-{:016x}", fastrand::u64(..)));
        std::fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn file(&self, name: &str, bytes: &[u8]) -> PathBuf {
        let path = self.0.join(name);
        std::fs::write(&path, bytes).unwrap();
        path
    }
}

impl Drop for Dir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn cov(job_id: &str, pdf: &Path, ocr_pages: &[u32]) -> (String, BuildInputs) {
    (
        job_id.to_string(),
        BuildInputs {
            output_pdf: pdf.to_path_buf(),
            ocr_page_numbers: ocr_pages.to_vec(),
            translations_dir: None,
            normalized_document: None,
            markdown_images_dir: None,
        },
    )
}

fn jobs<const N: usize>(entries: [(String, BuildInputs); N]) -> JobInputs {
    entries.into_iter().collect()
}

fn job(id: &str, local: usize) -> PageSource {
    PageSource::Job { job_id: id.to_string(), local_index: local }
}

#[test]
fn the_fingerprint_changes_when_the_plan_changes() {
    let dir = Dir::new();
    let source = dir.file("source.pdf", b"src");
    let a = dir.file("a.pdf", b"a");
    let coverages = jobs([cov("a", &a, &[1, 2])]);
    let both = [job("a", 0), job("a", 1)];
    let first_only = [job("a", 0), PageSource::Original];
    assert_ne!(
        merge_fingerprint(&source, &both, &coverages).unwrap(),
        merge_fingerprint(&source, &first_only, &coverages).unwrap()
    );
}

#[test]
fn the_fingerprint_changes_when_a_participating_pdf_is_rewritten() {
    // 原地重新排版会重写同一路径的输出 PDF —— 指纹必须跟着变，否则一直给旧排版。
    let dir = Dir::new();
    let source = dir.file("source.pdf", b"src");
    let a = dir.file("a.pdf", b"a");
    let coverages = jobs([cov("a", &a, &[1])]);
    let plan = [job("a", 0)];
    let before = merge_fingerprint(&source, &plan, &coverages).unwrap();
    std::fs::write(&a, b"rewritten, longer").unwrap();
    assert_ne!(before, merge_fingerprint(&source, &plan, &coverages).unwrap());
}

#[test]
fn deleting_a_newer_job_changes_the_fingerprint_even_though_every_input_is_older() {
    // mtime 比较在这里会说「缓存还新鲜」—— 剩下的输入都比产物旧。指纹不会。
    let dir = Dir::new();
    let source = dir.file("source.pdf", b"src");
    let old = dir.file("old.pdf", b"old");
    let new = dir.file("new.pdf", b"new");
    let with_new = merge_fingerprint(
        &source,
        &[job("new", 0)],
        &jobs([cov("old", &old, &[1]), cov("new", &new, &[1])]),
    )
    .unwrap();
    let after_delete = merge_fingerprint(&source, &[job("old", 0)], &jobs([cov("old", &old, &[1])])).unwrap();
    assert_ne!(with_new, after_delete);
}

#[test]
fn the_fingerprint_changes_when_a_participating_translation_manifest_is_rewritten() {
    // 「从翻译阶段重试」会重写译文而 PDF 可能还没重渲 —— 数据层合并也必须跟着失效。
    let dir = Dir::new();
    let source = dir.file("source.pdf", b"src");
    let a = dir.file("a.pdf", b"a");
    let translated = dir.0.join("translated");
    std::fs::create_dir(&translated).unwrap();
    std::fs::write(translated.join("translation-manifest.json"), b"{}").unwrap();
    let mut coverage = cov("a", &a, &[1]);
    coverage.1.translations_dir = Some(translated.clone());
    let coverages = jobs([coverage]);
    let plan = [job("a", 0)];
    let before = merge_fingerprint(&source, &plan, &coverages).unwrap();
    std::fs::write(translated.join("translation-manifest.json"), b"{\"pages\": []}").unwrap();
    assert_ne!(before, merge_fingerprint(&source, &plan, &coverages).unwrap());
}

#[test]
fn unreferenced_jobs_do_not_affect_the_fingerprint() {
    // 一个被完全盖掉的旧任务被重写，不该让合并结果重新生成。
    let dir = Dir::new();
    let source = dir.file("source.pdf", b"src");
    let used = dir.file("used.pdf", b"u");
    let shadowed = dir.file("shadowed.pdf", b"s");
    let plan = [job("used", 0)];
    let coverages = jobs([cov("used", &used, &[1]), cov("shadowed", &shadowed, &[1])]);
    let before = merge_fingerprint(&source, &plan, &coverages).unwrap();
    std::fs::write(&shadowed, b"rewritten shadowed").unwrap();
    assert_eq!(before, merge_fingerprint(&source, &plan, &coverages).unwrap());
}

#[test]
fn a_plan_referencing_an_unknown_job_is_an_error() {
    let dir = Dir::new();
    let source = dir.file("source.pdf", b"src");
    assert!(merge_fingerprint(&source, &[job("ghost", 0)], &JobInputs::new()).is_err());
}

#[test]
fn plan_json_matches_the_python_contract() {
    let dir = Dir::new();
    let a = dir.file("a.pdf", b"a");
    let json: serde_json::Value = serde_json::from_str(
        &plan_json(&[PageSource::Original, job("a", 3)], &jobs([cov("a", &a, &[2, 3, 4, 5])])).unwrap(),
    )
    .unwrap();
    assert_eq!(
        json,
        serde_json::json!({ "pages": [null, { "pdf": a, "index": 3 }] })
    );
}

#[test]
fn old_merged_directories_and_crash_leftovers_are_pruned_by_age() {
    let dir = Dir::new();
    let merged = dir.0.join("merged");
    let keep = merged.join("aaaaaaaaaaaaaaaa");
    let old = merged.join("bbbbbbbbbbbbbbbb");
    let recent = merged.join("cccccccccccccccc");
    let stale_building = merged.join(".building-dddddddddddddddd-1");
    let unknown = merged.join("notes");
    for path in [&keep, &old, &recent, &stale_building, &unknown] {
        std::fs::create_dir_all(path).unwrap();
    }
    // 不改文件时间，而是把「现在」往后拨：old 和 recent 同时创建，用两个不同的「现在」区分。
    let created = std::fs::metadata(&old).unwrap().modified().unwrap();
    let now = created + Duration::from_secs(2 * 60 * 60);
    prune_stale(&merged, &keep, now);
    assert!(keep.is_dir(), "当前的合并目录被删了");
    assert!(old.is_dir() && recent.is_dir(), "2 小时的旧合并目录不该删（阅读器可能还开着）");
    assert!(!stale_building.exists(), "超过 1 小时的临时目录该删");
    let later = created + Duration::from_secs(25 * 60 * 60);
    prune_stale(&merged, &keep, later);
    assert!(!old.exists() && !recent.exists(), "超过 24 小时的旧合并目录该删");
    assert!(keep.is_dir());
    assert!(unknown.is_dir(), "不认识的目录不该碰");
}

fn python(script: &str, args: &[&Path]) -> String {
    let output = Command::new(project_venv_bin("python"))
        .arg("-c")
        .arg(script)
        .args(args)
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    String::from_utf8(output.stdout).unwrap()
}

const MAKE_PDF: &str = r#"
import sys, fitz
doc = fitz.open()
for text in sys.argv[2:]:
    doc.new_page(width=595, height=842).insert_text((72, 100), text, fontsize=24)
doc.save(sys.argv[1])
"#;

const PAGE_TEXTS: &str = r#"
import sys, fitz
print("|".join(page.get_text().strip() for page in fitz.open(sys.argv[1])))
"#;

fn make_pdf(path: &Path, texts: &[&str]) {
    let mut command = Command::new(project_venv_bin("python"));
    command.arg("-c").arg(MAKE_PDF).arg(path).args(texts);
    let output = command.output().unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
}

use std::process::Command;

/// 一个子集 OCR 范围任务的产物（页号全是本地的，和流水线真实产出一致）。
fn make_range_job(dir: &Path, name: &str, document_pages: &[u32], texts: &[&str]) -> (String, BuildInputs) {
    let root = dir.join(name);
    let translated = root.join("translated");
    let normalized = root.join("ocr/normalized");
    std::fs::create_dir_all(&translated).unwrap();
    std::fs::create_dir_all(&normalized).unwrap();
    let mut manifest_pages = Vec::new();
    for (local, text) in texts.iter().enumerate() {
        let file = format!("page-{:03}-deepseek.json", local + 1);
        let item = serde_json::json!([{
            "item_id": format!("p{:03}-b001", local + 1),
            "page_idx": local,
            "translated_text": text,
            "final_status": "translated",
        }]);
        std::fs::write(translated.join(&file), item.to_string()).unwrap();
        manifest_pages.push(serde_json::json!({
            "page_index": local, "page_number": local + 1, "path": file,
        }));
    }
    std::fs::write(
        translated.join("translation-manifest.json"),
        serde_json::json!({ "schema": "translation_manifest_v1", "pages": manifest_pages }).to_string(),
    )
    .unwrap();
    let ocr_pages: Vec<_> = (0..texts.len())
        .map(|local| serde_json::json!({
            "page_index": local, "page": local + 1, "width": 595, "height": 842,
            "blocks": [{ "block_id": format!("p{:03}-b0000", local + 1), "page_index": local }],
        }))
        .collect();
    std::fs::write(
        normalized.join("document.v1.json"),
        serde_json::json!({ "schema": "normalized_document_v1", "pages": ocr_pages }).to_string(),
    )
    .unwrap();
    let pdf = root.join("out.pdf");
    make_pdf(&pdf, texts);
    let mut coverage = cov(name, &pdf, document_pages);
    coverage.1.translations_dir = Some(translated);
    coverage.1.normalized_document = Some(normalized.join("document.v1.json"));
    coverage
}

fn pipeline_deps(pipeline: &Path) -> DerivedArtifactDeps<'_> {
    DerivedArtifactDeps::with_pipeline_command("python3", pipeline.to_str().unwrap())
}

#[test]
fn end_to_end_the_real_pipeline_builds_a_full_length_merged_directory_and_caches_it() {
    let dir = Dir::new();
    let data_root = dir.0.join("data");
    let source = dir.0.join("source.pdf");
    make_pdf(&source, &["SRC 1", "SRC 2", "SRC 3", "SRC 4"]);
    // 两个从不同位置开始的范围任务：各自的「第 1 页」都叫 p001。
    let coverages = jobs([
        make_range_job(&dir.0, "a", &[1], &["ZH 1"]),
        make_range_job(&dir.0, "mid", &[3, 4], &["ZH 3", "ZH 4"]),
    ]);
    let ranked = [ranked("a", &[1]), ranked("mid", &[3, 4])];
    let plan = crate::services::merge::plan::merge_plan(4, &ranked);
    let pipeline = project_venv_bin("retainpdf-pipeline");

    let merged =
        ensure_merged_translation(pipeline_deps(&pipeline), &data_root, "doc1", &source, &plan, &coverages)
            .unwrap();
    assert!(merged.root.starts_with(data_root.join("documents/doc1/merged")));
    assert_eq!(python(PAGE_TEXTS, &[&merged.output_pdf()]).trim(), "ZH 1|SRC 2|ZH 3|ZH 4");

    let manifest: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(merged.translations_dir().join("translation-manifest.json")).unwrap(),
    )
    .unwrap();
    let indices: Vec<_> = manifest["pages"].as_array().unwrap().iter().map(|p| p["page_index"].as_i64().unwrap()).collect();
    assert_eq!(indices, [0, 2, 3]);
    let page4: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(merged.translations_dir().join("page-004.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(page4[0]["item_id"], "p004-b001", "mid 的本地第 2 页没改成文档第 4 页");
    assert_eq!(page4[0]["translated_text"], "ZH 4");
    let document: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(merged.normalized_document()).unwrap()).unwrap();
    assert_eq!(document["pages"].as_array().unwrap().len(), 4, "OCR 文档不是整本长度");

    // 第二次直接命中缓存：同一个目录，PDF 没有重写。
    let stamp = std::fs::metadata(merged.output_pdf()).unwrap().modified().unwrap();
    let again =
        ensure_merged_translation(pipeline_deps(&pipeline), &data_root, "doc1", &source, &plan, &coverages)
            .unwrap();
    assert_eq!(again, merged);
    assert_eq!(std::fs::metadata(again.output_pdf()).unwrap().modified().unwrap(), stamp);

    // 不留临时目录和计划文件。
    let leftovers: Vec<_> = std::fs::read_dir(merged.root.parent().unwrap())
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|name| name.starts_with('.'))
        .collect();
    assert!(leftovers.is_empty(), "残留: {leftovers:?}");
}

#[test]
fn end_to_end_a_failed_step_publishes_nothing_and_surfaces_the_python_error() {
    let dir = Dir::new();
    let data_root = dir.0.join("data");
    let source = dir.0.join("source.pdf");
    make_pdf(&source, &["SRC 1", "SRC 2"]);
    let mut job = make_range_job(&dir.0, "r", &[1], &["ZH 1"]);
    // OCR 页号表说这个任务只覆盖第 2 页，计划却从它取第 1 页 —— 数据层必须拒绝。
    job.1.ocr_page_numbers = vec![2];
    let plan = [job_page("r", 0), PageSource::Original];
    let pipeline = project_venv_bin("retainpdf-pipeline");
    let error = ensure_merged_translation(pipeline_deps(&pipeline), &data_root, "doc1", &source, &plan, &jobs([job]))
        .unwrap_err()
        .to_string();
    assert!(error.contains("document page 1 is not in this job's OCR coverage"), "{error}");
    let merged_dir = data_root.join("documents/doc1/merged");
    let entries: Vec<_> = std::fs::read_dir(&merged_dir).unwrap().collect();
    assert!(entries.is_empty(), "失败后留下了东西: {entries:?}");
}

fn ranked(job_id: &str, pages: &[u32]) -> crate::services::merge::plan::RankedPages {
    crate::services::merge::plan::RankedPages {
        rank: crate::services::merge::plan::Rank {
            producer_created_at: "2026-10-01T00:00:00".to_string(),
            finished_at: "2026-10-01T00:00:00".to_string(),
            created_at: "2026-10-01T00:00:00".to_string(),
            job_id: job_id.to_string(),
        },
        pages: pages.to_vec(),
    }
}

fn job_page(id: &str, local: usize) -> PageSource {
    job(id, local)
}
