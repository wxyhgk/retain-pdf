//! 文件出口的返回快照：`docs/file-responses.txt`。
//!
//! 下载类接口（译文 PDF、对照版、Word、封面、预览图、Markdown、打包、产物清单……）要整理成
//! 一个 `open(任务, 文件名)`，前端照着这些接口的状态码、`Content-Type`、下载文件名、缓存头
//! 在工作。整理前先把这些钉住：改完以后快照一个字不变，才说明对外没变。确认是有意改的，用
//! `UPDATE_FILE_RESPONSES=1 cargo test -p retainpdf-api --lib file_responses` 重新生成。
//!
//! 按需生成的产物（对照版、Word、封面、缩略图、预览图）事先在缓存位置放好文件，测试不调
//! Python，只走"找文件 → 组响应"这一段。PDF 可能被 qpdf 线性化（看机器上有没有 qpdf），
//! 所以 PDF 和 zip 只记类型，不记内容哈希和长度。

use std::fs;
use std::path::Path;

use axum::body::{to_bytes, Body};
use axum::http::Request;
use tower::util::ServiceExt;

use super::jobs_common::{minimal_pdf_bytes, test_state};
use crate::app::build_app;
use crate::db::documents::sha256_hex;
use crate::models::domain::{
    now_iso, CreateJobInput, JobArtifacts, JobSnapshot, JobStatusKind, UploadRecord,
};
use crate::services::files::LayoutDocxOptions;

pub(super) const JOB: &str = "files-contract-job";
pub(super) const RUNNING_JOB: &str = "files-contract-running";

/// 只记这些响应头；ETag、Last-Modified、Content-Length 随文件时间和线性化变化，不记。
const RECORDED_HEADERS: [&str; 6] = [
    "content-type",
    "content-disposition",
    "cache-control",
    "accept-ranges",
    "content-range",
    "x-job-id",
];

fn write(path: &Path, bytes: &[u8]) {
    fs::create_dir_all(path.parent().expect("parent")).expect("create dir");
    fs::write(path, bytes).expect("write fixture");
}

pub(super) struct Fixture {
    pub(super) state: crate::AppState,
    pub(super) document_id: String,
}

pub(super) fn seed() -> Fixture {
    let state = test_state("file-responses");
    let data_root = state.config.data_root.clone();
    let source_bytes = minimal_pdf_bytes(200, 280);
    let translated_bytes = minimal_pdf_bytes(210, 297);

    // 上传记录 → 书（document），任务挂在这本书下面。
    let document_id = sha256_hex(&source_bytes);
    let upload_id = "up-files-contract".to_string();
    let upload_path = data_root.join(format!("uploads/{upload_id}/paper.pdf"));
    write(&upload_path, &source_bytes);
    let upload = UploadRecord {
        upload_id: upload_id.clone(),
        filename: "光谱综述.pdf".to_string(),
        stored_path: upload_path.to_string_lossy().to_string(),
        bytes: source_bytes.len() as u64,
        page_count: 1,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: document_id.clone(),
    };
    state.db.save_upload(&upload).expect("save upload");
    state.db.upsert_document_from_upload(&upload).expect("upsert document");

    // 流水线产物。
    let root = data_root.join("jobs").join(JOB);
    write(&root.join("source/input.pdf"), &source_bytes);
    write(&root.join("rendered/translated.pdf"), &translated_bytes);
    write(&root.join("md/full.md"), b"# Title\n\n![fig](images/page-1/fig.png)\n");
    write(&root.join("md/images/page-1/fig.png"), b"fake png");
    write(&root.join("ocr/normalized/document.v1.json"), br#"{"schema":"document.v1","pages":[]}"#);
    write(&root.join("ocr/normalization_report.json"), br#"{"normalization":{"defaults":{"pages_seen":1}}}"#);
    write(&root.join("ocr/paddle_result.json"), br#"{"layoutParsingResults":[]}"#);
    write(&root.join("pipeline_summary.json"), br#"{"status":"ok"}"#);

    // 按需生成的产物：事先放进缓存位置（写在输入之后，修改时间不早于输入，算新鲜）。
    let cache = root.join("artifacts");
    write(&cache.join(format!("{JOB}-side-by-side.pdf")), &minimal_pdf_bytes(400, 280));
    // 下载默认带水印（2026-11-20）：盖好水印的译文、对照 PDF 也事先放进缓存
    write(&cache.join("output.watermarked-v1.pdf"), &minimal_pdf_bytes(210, 297));
    write(&cache.join("side-by-side.watermarked-v1.pdf"), &minimal_pdf_bytes(420, 297));
    for dpi in [LayoutDocxOptions::default().dpi, 150] {
        for watermark in [false, true] {
            let suffix = LayoutDocxOptions { dpi, watermark }.cache_suffix();
            write(&cache.join(format!("{JOB}-layout-{suffix}.docx")), format!("fake docx dpi={dpi} watermark={watermark}").as_bytes());
        }
    }
    write(&cache.join("cover.jpg"), b"job cover jpeg");
    write(&cache.join("thumbnail.jpg"), b"job thumbnail jpeg");
    write(&cache.join("preview-source-p0001-w1200-d0.jpg"), b"source page jpeg");
    write(&cache.join("preview-translated-p0001-w1200-d0.jpg"), b"translated page jpeg");
    let document_cache = data_root.join("documents").join(&document_id);
    write(&document_cache.join("cover.jpg"), b"document cover jpeg");
    write(&document_cache.join("thumbnail.jpg"), b"document thumbnail jpeg");
    write(&document_cache.join("pages/p0001-w1200-d0.jpg"), b"document source page jpeg");

    let artifacts = |prefix: &str| JobArtifacts {
        job_root: Some(format!("jobs/{prefix}")),
        source_pdf: Some(format!("jobs/{prefix}/source/input.pdf")),
        normalized_document_json: Some(format!("jobs/{prefix}/ocr/normalized/document.v1.json")),
        normalization_report_json: Some(format!("jobs/{prefix}/ocr/normalization_report.json")),
        layout_json: Some(format!("jobs/{prefix}/ocr/paddle_result.json")),
        provider_summary_json: Some(format!("jobs/{prefix}/ocr/paddle_result.json")),
        summary: Some(format!("jobs/{prefix}/pipeline_summary.json")),
        ..JobArtifacts::default()
    };

    let mut input = CreateJobInput::default();
    input.runtime.job_id = JOB.to_string();
    input.source.upload_id = upload_id.clone();
    let mut job = JobSnapshot::new(JOB.to_string(), input, vec!["python".to_string()]);
    job.upload_id = Some(upload_id.clone());
    job.status = JobStatusKind::Succeeded;
    job.artifacts = Some(JobArtifacts {
        output_pdf: Some(format!("jobs/{JOB}/rendered/translated.pdf")),
        ..artifacts(JOB)
    });
    job.sync_runtime_state();
    state.db.save_job(&job).expect("save job");

    // 还在跑的任务：什么产物都没有，用来钉"没就绪"的报错。
    let mut running_input = CreateJobInput::default();
    running_input.runtime.job_id = RUNNING_JOB.to_string();
    let mut running = JobSnapshot::new(RUNNING_JOB.to_string(), running_input, vec!["python".to_string()]);
    running.status = JobStatusKind::Running;
    running.artifacts = Some(JobArtifacts {
        job_root: Some(format!("jobs/{RUNNING_JOB}")),
        ..JobArtifacts::default()
    });
    running.sync_runtime_state();
    state.db.save_job(&running).expect("save running job");
    fs::create_dir_all(data_root.join("jobs").join(RUNNING_JOB)).expect("running job root");

    let conn = rusqlite::Connection::open(&state.config.jobs_db_path).expect("open db");
    conn.execute(
        "UPDATE jobs SET document_id = ?1 WHERE job_id = ?2",
        rusqlite::params![document_id, JOB],
    )
    .expect("link job to document");

    Fixture { state, document_id }
}

/// 每个请求：`(说明, 地址, 额外请求头)`。地址里的 `{doc}` 换成书的编号。
fn requests() -> Vec<(&'static str, String, Option<(&'static str, &'static str)>)> {
    let j = format!("/api/v1/jobs/{JOB}");
    let r = format!("/api/v1/jobs/{RUNNING_JOB}");
    let list = vec![
        // 新地址：任务的文件按 output / pages / internal 分组，书的文件挂在书下面。
        ("新：任务的文件清单", format!("{j}/files"), None),
        ("新：译文 PDF（浏览器里打开）", format!("{j}/files/output/translated.pdf"), None),
        ("新：译文 PDF（下载）", format!("{j}/files/output/translated.pdf?download=1"), None),
        ("新：对照 PDF", format!("{j}/files/output/side-by-side.pdf"), None),
        ("新：译文 PDF（不带水印）", format!("{j}/files/output/translated.pdf?watermark=0"), None),
        ("新：对照 PDF（不带水印）", format!("{j}/files/output/side-by-side.pdf?watermark=0"), None),
        ("新：Word（不带水印）", format!("{j}/files/output/translated.docx?download=1&watermark=0"), None),
        ("新：Word（默认清晰度）", format!("{j}/files/output/translated.docx?download=1"), None),
        ("新：Word（dpi=150）", format!("{j}/files/output/translated.docx?download=1&dpi=150"), None),
        ("新：原文 Markdown", format!("{j}/files/output/ocr.md"), None),
        ("新：原文 Markdown + 图片", format!("{j}/files/output/ocr.zip"), None),
        ("新：Markdown 图片", format!("{j}/files/output/ocr/images/page-1/fig.png"), None),
        ("新：全部打包", format!("{j}/files/output/all.zip?download=1"), None),
        ("新：译文第 1 页预览", format!("{j}/files/pages/1.jpg"), None),
        ("新：中间产物 规范化文档", format!("{j}/files/internal/normalized-document.json"), None),
        ("新：中间产物 规范化报告", format!("{j}/files/internal/normalization-report.json"), None),
        ("新：中间产物 OCR 原始返回", format!("{j}/files/internal/ocr-provider/result.json"), None),
        ("新：中间产物 流水线摘要", format!("{j}/files/internal/pipeline-summary.json"), None),
        ("新：书的文件清单", "/api/v1/documents/{doc}/files".to_string(), None),
        ("新：书的原文（浏览器里打开）", "/api/v1/documents/{doc}/files/source.pdf".to_string(), None),
        ("新：书的原文（下载）", "/api/v1/documents/{doc}/files/source.pdf?download=1".to_string(), None),
        ("新：书的封面", "/api/v1/documents/{doc}/files/cover.jpg".to_string(), None),
        ("新：书的缩略图", "/api/v1/documents/{doc}/files/thumbnail.jpg".to_string(), None),
        ("新：原文第 1 页预览", "/api/v1/documents/{doc}/files/pages/1.jpg".to_string(), None),
        ("新报错：没有这个文件", format!("{j}/files/output/translated.PDF"), None),
        ("新报错：layout.json 和 ocr-provider/result.json 重复，只留后者", format!("{j}/files/internal/layout.json"), None),
        ("新报错：页码从 1 开始", format!("{j}/files/pages/0.jpg"), None),
        ("新报错：页码超过总页数", format!("{j}/files/pages/2.jpg"), None),
        ("新报错：书的页码超过总页数", "/api/v1/documents/{doc}/files/pages/2.jpg".to_string(), None),
        ("新报错：书没有这个文件", "/api/v1/documents/{doc}/files/cover.png".to_string(), None),
        ("新报错：还在跑，不能打包", format!("{r}/files/output/all.zip"), None),
        // 出错的情况：前端按这些状态码和提示走分支。
        ("新报错：任务不存在", "/api/v1/jobs/no-such-job/files/output/translated.pdf".to_string(), None),
        ("新报错：还在跑，译文 PDF 没就绪", format!("{r}/files/output/translated.pdf"), None),
        // 「还没产出」一律 404 + reason=not_ready，文案 `<名字> not ready`（不存在的任务见上面，没有 reason）。
        ("新报错：还在跑，原文 Markdown 没就绪", format!("{r}/files/output/ocr.md"), None),
        ("新报错：还在跑，译文页预览没就绪", format!("{r}/files/pages/1.jpg"), None),
        ("新报错：还在跑，中间产物没就绪", format!("{r}/files/internal/normalized-document.json"), None),
        ("新报错：Markdown 图片路径越界", format!("{j}/files/output/ocr/images/..%2F..%2Fsecret"), None),
    ];
    list
}

fn body_summary(content_type: &str, bytes: &[u8], scrub: &dyn Fn(&str) -> String) -> String {
    if bytes.is_empty() {
        return "（空）".to_string();
    }
    if bytes.starts_with(b"%PDF") {
        return "pdf".to_string();
    }
    if bytes.starts_with(b"PK\x03\x04") {
        return "zip".to_string();
    }
    if content_type.starts_with("application/json") {
        if let Ok(mut value) = serde_json::from_slice::<serde_json::Value>(bytes) {
            drop_volatile(&mut value);
            return scrub(&serde_json::to_string_pretty(&value).expect("json"));
        }
    }
    format!("{} 字节，sha256 {}", bytes.len(), &sha256_hex(bytes)[..16])
}

/// 时间戳随运行变化，去掉。
fn drop_volatile(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(map) => {
            map.retain(|key, _| !key.ends_with("_at"));
            map.values_mut().for_each(drop_volatile);
        }
        serde_json::Value::Array(items) => items.iter_mut().for_each(drop_volatile),
        _ => {}
    }
}

async fn render() -> String {
    let fixture = seed();
    let root = fixture.state.config.data_root.to_string_lossy().to_string();
    let doc = fixture.document_id.clone();
    let scrub = move |text: &str| text.replace(&root, "<data_root>").replace(&doc, "<doc>");
    let app = build_app(fixture.state.clone());
    let mut out = vec![
        "# 文件出口的返回快照。由 src/api_tests/file_responses.rs 生成，不要手改：".to_string(),
        "#   UPDATE_FILE_RESPONSES=1 cargo test -p retainpdf-api --lib file_responses".to_string(),
        "# PDF / zip 只记类型；ETag、Last-Modified、Content-Length 不记；content-range 的总长记成 *。".to_string(),
    ];
    for (label, uri, extra) in requests() {
        let uri = uri.replace("{doc}", &fixture.document_id);
        let mut builder = Request::builder().uri(&uri).header("X-API-Key", "test-key");
        if let Some((name, value)) = extra {
            builder = builder.header(name, value);
        }
        let response = app
            .clone()
            .oneshot(builder.body(Body::empty()).expect("request"))
            .await
            .expect("response");
        out.push(String::new());
        let shown = match extra {
            Some((name, value)) => format!("GET {}  [{name}: {value}]", scrub(&uri)),
            None => format!("GET {}", scrub(&uri)),
        };
        out.push(format!("## {label}"));
        out.push(shown);
        out.push(format!("  status: {}", response.status().as_u16()));
        let headers = response.headers().clone();
        for name in RECORDED_HEADERS {
            if let Some(value) = headers.get(name) {
                let mut value = value.to_str().unwrap_or("<非 ASCII>").to_string();
                if name == "content-range" {
                    if let Some((range, _total)) = value.rsplit_once('/') {
                        value = format!("{range}/*");
                    }
                }
                out.push(format!("  {name}: {value}"));
            }
        }
        let content_type = headers
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .to_string();
        let bytes = to_bytes(response.into_body(), usize::MAX).await.expect("body");
        for line in body_summary(&content_type, &bytes, &scrub).lines() {
            out.push(format!("  | {line}"));
        }
    }
    out.push(String::new());
    out.join("\n")
}

#[tokio::test]
async fn file_responses_match_snapshot() {
    let current = render().await;
    let snapshot = Path::new(env!("CARGO_MANIFEST_DIR")).join("docs/file-responses.txt");
    if std::env::var_os("UPDATE_FILE_RESPONSES").is_some() {
        fs::write(&snapshot, &current).expect("write snapshot");
        return;
    }
    let saved = fs::read_to_string(&snapshot).unwrap_or_default();
    if saved != current {
        let diff: Vec<String> = saved
            .lines()
            .zip(current.lines())
            .enumerate()
            .filter(|(_, (a, b))| a != b)
            .take(20)
            .map(|(index, (a, b))| format!("line {}:\n  saved:   {a}\n  current: {b}", index + 1))
            .collect();
        panic!(
            "文件出口的返回变了（docs/file-responses.txt）。前 20 处不同：\n{}\n\
             确认是有意改的：UPDATE_FILE_RESPONSES=1 cargo test -p retainpdf-api --lib file_responses",
            diff.join("\n")
        );
    }
}

/// 文件清单里每一项带登记表的更新时间（快照把 `*_at` 去掉了，这里单独核）：落了盘、登记过的有，
/// 按需生成的没有；原文条目指向书的文件。
#[tokio::test]
async fn file_list_entries_carry_registry_times_and_the_book_source() {
    let fixture = seed();
    let app = build_app(fixture.state.clone());
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/jobs/files-contract-job/files")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    let bytes = to_bytes(response.into_body(), usize::MAX).await.expect("body");
    let data = serde_json::from_slice::<serde_json::Value>(&bytes).expect("json")["data"].clone();
    let output = |name: &str| {
        data["output"]
            .as_array()
            .unwrap()
            .iter()
            .find(|entry| entry["name"] == name)
            .cloned()
            .unwrap_or_else(|| panic!("output/{name} missing"))
    };
    assert!(data["source"]["updated_at"].is_string(), "{}", data["source"]);
    assert!(data["source"]["url"]
        .as_str()
        .unwrap()
        .ends_with(&format!("/api/v1/documents/{}/files/source.pdf", fixture.document_id)));
    assert!(output("translated.pdf")["updated_at"].is_string());
    assert!(output("side-by-side.pdf")["updated_at"].is_null(), "按需生成的没有登记时间");
    assert!(output("side-by-side.pdf")["stage"].is_null());
    assert!(data["internal"][0]["updated_at"].is_string());
}
