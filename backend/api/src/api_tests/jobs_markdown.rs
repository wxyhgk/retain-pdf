use std::fs;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use super::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

#[tokio::test]
async fn markdown_document_route_returns_content_and_direct_image_links() {
    let state = test_state("markdown-document");
    let job_root = state.config.output_root.join("markdown-document-job");
    let markdown_dir = job_root.join("md");
    let images_dir = markdown_dir.join("images/page-1/imgs");
    fs::create_dir_all(&images_dir).expect("create markdown images");
    fs::write(images_dir.join("chart a.png"), b"fake png").expect("write image");
    fs::write(
        markdown_dir.join("full.md"),
        concat!(
            "hello\n\n![Image](images/page-1/imgs/chart a.png)\n",
            "![Encoded](images/page-1/imgs/chart%20a.png)\n",
        ),
    )
    .expect("write markdown");

    let mut input = CreateJobInput::default();
    input.runtime.job_id = "markdown-document-job".to_string();
    let mut job = JobSnapshot::new(
        "markdown-document-job".to_string(),
        input,
        vec!["python".to_string()],
    );
    job.artifacts = Some(JobArtifacts {
        job_root: Some("jobs/markdown-document-job".to_string()),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/markdown-document-job/reader/markdown")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("markdown document request"),
        )
        .await
        .expect("markdown document response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["job_id"], "markdown-document-job");
    assert_eq!(payload["data"]["ready"], true);
    assert_eq!(
        payload["data"]["content"],
        concat!(
            "hello\n\n![Image](images/page-1/imgs/chart a.png)\n",
            "![Encoded](images/page-1/imgs/chart%20a.png)\n",
        )
    );
    let abs_md = payload["data"]["content_with_absolute_image_urls"]
        .as_str()
        .expect("absolute markdown");
    assert!(
        abs_md.contains(
            "http://127.0.0.1:41000/api/v1/jobs/markdown-document-job/files/output/ocr/images/page-1/imgs/chart%20a.png"
        ),
        "absolute markdown unexpected: {abs_md:?}"
    );
    // 不得出现双 images 前缀
    assert!(!abs_md.contains("/ocr/images/images/"));
    assert!(!abs_md.contains("chart%2520a.png"));
    assert_eq!(abs_md.matches("chart%20a.png").count(), 2);
    assert_eq!(
        payload["data"]["raw_path"],
        "/api/v1/jobs/markdown-document-job/files/output/ocr.md"
    );
    assert_eq!(
        payload["data"]["images_base_path"],
        "/api/v1/jobs/markdown-document-job/files/output/ocr/images/"
    );
    // 契约 reader-data.v1 的 MarkdownDocumentView（2026-11-24 起对真实返回钉键集合）。
    super::job_view_contract::assert_reader_view(&payload["data"], "MarkdownDocumentView", "markdown");
    let image = &payload["data"]["images"][0];
    super::job_view_contract::assert_reader_view(image, "MarkdownImageView", "markdown.images[0]");
    assert_eq!(image["path"], "images/page-1/imgs/chart a.png");
    assert_eq!(image["content_type"], "image/png");
    assert_eq!(image["size_bytes"], 8);
    assert_eq!(
        image["url"],
        "http://127.0.0.1:41000/api/v1/jobs/markdown-document-job/files/output/ocr/images/page-1/imgs/chart%20a.png"
    );
}

#[tokio::test]
async fn markdown_document_rewrites_html_img_and_titled_markdown_links() {
    let state = test_state("markdown-html-img");
    let job_root = state.config.output_root.join("markdown-html-img-job");
    let markdown_dir = job_root.join("md");
    let images_dir = markdown_dir.join("images/page-2/imgs");
    fs::create_dir_all(&images_dir).expect("create markdown images");
    fs::write(images_dir.join("fig.png"), b"fake png").expect("write image");
    fs::write(
        markdown_dir.join("full.md"),
        concat!(
            "html\n\n",
            "<div><img src=\"images/page-2/imgs/fig.png\" alt=\"Image\" width=\"48%\" /></div>\n\n",
            "md titled\n\n",
            "![cap](images/page-2/imgs/fig.png \"figure\")\n",
        ),
    )
    .expect("write markdown");

    let mut input = CreateJobInput::default();
    input.runtime.job_id = "markdown-html-img-job".to_string();
    let mut job = JobSnapshot::new(
        "markdown-html-img-job".to_string(),
        input,
        vec!["python".to_string()],
    );
    job.artifacts = Some(JobArtifacts {
        job_root: Some("jobs/markdown-html-img-job".to_string()),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/jobs/markdown-html-img-job/reader/markdown")
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("markdown document request"),
        )
        .await
        .expect("markdown document response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    let abs = payload["data"]["content_with_absolute_image_urls"]
        .as_str()
        .expect("absolute markdown");
    let expected = "http://127.0.0.1:41000/api/v1/jobs/markdown-html-img-job/files/output/ocr/images/page-2/imgs/fig.png";
    assert!(abs.contains(expected), "html img rewritten: {abs}");
    assert!(
        abs.contains(&format!("![cap]({expected})")),
        "titled md rewritten: {abs}"
    );
    assert!(!abs.contains("/ocr/images/images/"));
}

/// `?raw=true` 必须支持 HTTP Range,阅读器据此按需分段拉正文。
///
/// 阅读器需要"滚到底再拉下一段",不能整篇读入。这件事不需要一套自定义的
/// 游标端点:`stream_file` 早就实现了 Range/206/Content-Range,原先只是
/// markdown 这条路没接上——它把整篇(实测最大 620 KB)`read_to_string` 进堆
/// 再整个返回。
///
/// 用例锁三件事:分段内容与整篇一致(拼回去逐字节相等)、`Accept-Ranges` 与
/// `Content-Range` 如实给出、ETag 存在(客户端靠它发现正文换了版本——分段
/// 期间正文若被改写,拼出来会是两个版本的混合,而那是静默的)。
#[tokio::test]
async fn raw_markdown_serves_byte_ranges_so_readers_can_page_through_it() {
    use axum::body::to_bytes;
    use axum::http::header;

    let state = test_state("markdown-range");
    let job_root = state.config.output_root.join("markdown-range-job");
    let markdown_dir = job_root.join("md");
    fs::create_dir_all(&markdown_dir).expect("create markdown dir");
    // 含多字节字符:按字节切会切进 UTF-8 序列中间,这正是客户端要用
    // TextDecoder({stream:true}) 处理的情形,服务端只管如实给字节。
    let full = "# 光谱综述\n\n第一段正文。\n\n第二段正文,更长一些。\n";
    fs::write(markdown_dir.join("full.md"), full).expect("write markdown");

    let mut input = CreateJobInput::default();
    input.runtime.job_id = "markdown-range-job".to_string();
    let mut job = JobSnapshot::new(
        "markdown-range-job".to_string(),
        input,
        vec!["python".to_string()],
    );
    job.artifacts = Some(JobArtifacts {
        job_root: Some("jobs/markdown-range-job".to_string()),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");
    let app = build_app(state);
    let uri = "/api/v1/jobs/markdown-range-job/files/output/ocr.md";
    let total = full.as_bytes().len();

    // 不带 Range:整篇 + 声明支持 Range
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(uri)
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("full request"),
        )
        .await
        .expect("full response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get(header::ACCEPT_RANGES)
            .and_then(|value| value.to_str().ok()),
        Some("bytes"),
        "必须声明支持 Range,否则客户端不会尝试分段"
    );
    let etag = response
        .headers()
        .get(header::ETAG)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
        .expect("raw markdown 必须带 ETag,客户端靠它发现正文换了版本");
    let whole = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("full body");
    assert_eq!(whole.as_ref(), full.as_bytes());

    // 分段拉取,拼回去必须与整篇逐字节相等
    let window = 16;
    let mut assembled: Vec<u8> = Vec::new();
    let mut start = 0usize;
    while start < total {
        let end = (start + window - 1).min(total - 1);
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(uri)
                    .header("X-API-Key", "test-key")
                    .header(header::RANGE, format!("bytes={start}-{end}"))
                    .body(Body::empty())
                    .expect("range request"),
            )
            .await
            .expect("range response");
        assert_eq!(
            response.status(),
            StatusCode::PARTIAL_CONTENT,
            "带 Range 必须返回 206,返回 200 会让客户端每段都收到整篇"
        );
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_RANGE)
                .and_then(|value| value.to_str().ok()),
            Some(format!("bytes {start}-{end}/{total}").as_str()),
            "Content-Range 是客户端唯一的总长度来源"
        );
        assert_eq!(
            response
                .headers()
                .get(header::ETAG)
                .and_then(|value| value.to_str().ok()),
            Some(etag.as_str()),
            "同一份正文的每一段 ETag 必须一致,否则客户端无法判断版本"
        );
        let chunk = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("range body");
        assert!(!chunk.is_empty(), "bytes={start}-{end} 不得返回空段");
        assembled.extend_from_slice(chunk.as_ref());
        start = end + 1;
    }
    assert_eq!(assembled, full.as_bytes(), "分段拼回去必须与整篇逐字节相等");
}
