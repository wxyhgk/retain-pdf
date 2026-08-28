use crate::error::AppError;
use crate::models::api::{to_absolute_url, MarkdownDocumentView, MarkdownImageView};
use crate::models::domain::JobSnapshot;
use crate::storage_paths::{resolve_markdown_images_dir, resolve_markdown_path};

use super::super::query::load_supported_job;
use super::paths::safe_markdown_image_path;
use super::{FileDownload, MarkdownDownload, QueryJobsDeps};

// Khớp ![alt](images/...)，Đường dẫn có thể chứa khoảng trắng；TÃ¹y chá»n "title"/'title'、Giá đỡ góc、./ Tiền tố
// path Với lòng tham [^)>\n]+；title Phải được trích dẫn，Tránh đặt `chart a.png` Khi không gian sai title Riêng biệt
const MARKDOWN_IMAGE_LINK_RE: &str =
    r#"!\[([^\]]*)\]\(\s*<?((?:\./)?images/[^)>\n]+)>?(?:[ \t]+(?:"[^"]*"|'[^']*'))?\s*\)"#;
// HTML: Tách đơn hàng/Dấu ngoặc kép（regex crate Không hỗ trợ backref）
const HTML_IMAGE_SRC_DQ_RE: &str =
    r#"(?i)(<img\b[^>]*?\bsrc\s*=\s*")((?:\./)?images/[^"]+)(")"#;
const HTML_IMAGE_SRC_SQ_RE: &str =
    r#"(?i)(<img\b[^>]*?\bsrc\s*=\s*')((?:\./)?images/[^']+)(')"#;

pub(crate) async fn markdown_download(
    deps: &QueryJobsDeps<'_>,
    job_id: String,
) -> Result<MarkdownDownload, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, &job_id)?;
    let markdown_path = resolve_markdown_path(&job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown not found: {job_id}")))?;
    let content = tokio::fs::read_to_string(&markdown_path).await?;
    Ok(MarkdownDownload {
        job_id: job.job_id.clone(),
        content,
    })
}

pub(crate) async fn markdown_document_view(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
    base_url: &str,
) -> Result<MarkdownDocumentView, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    let markdown_path = resolve_markdown_path(&job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown not found: {job_id}")))?;
    let content = tokio::fs::read_to_string(&markdown_path).await?;
    let raw_path = format!("/api/v1/jobs/{}/markdown?raw=true", job.job_id);
    let markdown_path_url = format!("/api/v1/jobs/{}/markdown/document", job.job_id);
    let images_base_path = format!("/api/v1/jobs/{}/markdown/images/", job.job_id);
    let images = markdown_images_view(deps, &job, base_url)?;
    let content_with_absolute_image_urls =
        rewrite_markdown_image_links_to_absolute_urls(&content, &job.job_id, base_url);
    Ok(MarkdownDocumentView {
        job_id: job.job_id.clone(),
        ready: true,
        content,
        content_with_absolute_image_urls,
        markdown_path: markdown_path_url.clone(),
        markdown_url: to_absolute_url(base_url, &markdown_path_url),
        raw_path: raw_path.clone(),
        raw_url: to_absolute_url(base_url, &raw_path),
        images_base_path: images_base_path.clone(),
        images_base_url: to_absolute_url(base_url, &images_base_path),
        images,
    })
}

pub(crate) fn markdown_image_download(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
    path: &str,
) -> Result<FileDownload, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    let images_dir = resolve_markdown_images_dir(&job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown images not found: {job_id}")))?;
    let relative_path = safe_markdown_image_path(path)?;
    let file_path = images_dir.join(relative_path);
    if !file_path.exists() || !file_path.is_file() {
        return Err(AppError::not_found(format!(
            "markdown image not found: {path}"
        )));
    }
    let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
    Ok(FileDownload::new(file_path, mime.as_ref(), None))
}

fn markdown_images_view(
    deps: &QueryJobsDeps<'_>,
    job: &JobSnapshot,
    base_url: &str,
) -> Result<Vec<MarkdownImageView>, AppError> {
    let Some(images_dir) = resolve_markdown_images_dir(job, deps.data_root) else {
        return Ok(Vec::new());
    };
    let mut images = Vec::new();
    for entry in walkdir::WalkDir::new(&images_dir)
        .into_iter()
        .filter_map(std::result::Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        let path = entry.path();
        let Ok(relative) = path.strip_prefix(&images_dir) else {
            continue;
        };
        let relative_path = relative.to_string_lossy().replace('\\', "/");
        let resource_path = format!(
            "/api/v1/jobs/{}/markdown/images/{}",
            job.job_id,
            url_path_escape(&relative_path)
        );
        let metadata = path.metadata().ok();
        // path VÀ markdown Báo giá ban đầu là nhất quán：images/<rel>
        // Ghi chú：liều images_base_url khi mặt trước phải được gỡ bỏ images/ Tiền tố，thấy normalize_markdown_image_rel
        images.push(MarkdownImageView {
            path: format!("images/{relative_path}"),
            url: to_absolute_url(base_url, &resource_path),
            content_type: mime_guess::from_path(path)
                .first_or_octet_stream()
                .to_string(),
            size_bytes: metadata.map(|item| item.len()),
        });
    }
    images.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(images)
}

/// cầm markdown/html Thay đổi tham chiếu hình ảnh tương đối thành có thể kết nối trực tiếp API tuyệt đối URL。
/// Sửa chữa đồng thời「images_base + images/...」Kép images Cạm bẫy chính tả ở giao diện người dùng：
/// tuyệt đối URL Trực tiếp đến /markdown/images/<rel>，Không còn phụ thuộc base hợp lại。
pub(crate) fn rewrite_markdown_image_links_to_absolute_urls(
    content: &str,
    job_id: &str,
    base_url: &str,
) -> String {
    let md_re = regex::Regex::new(MARKDOWN_IMAGE_LINK_RE).expect("valid markdown image regex");
    let html_dq = regex::Regex::new(HTML_IMAGE_SRC_DQ_RE).expect("valid html img dq regex");
    let html_sq = regex::Regex::new(HTML_IMAGE_SRC_SQ_RE).expect("valid html img sq regex");

    let rewritten_md = md_re.replace_all(content, |captures: &regex::Captures<'_>| {
        let alt = &captures[1];
        let raw_path = &captures[2];
        let absolute = absolute_markdown_image_url(raw_path, job_id, base_url);
        format!("![{alt}]({absolute})")
    });

    let rewritten_html_dq = html_dq.replace_all(&rewritten_md, |captures: &regex::Captures<'_>| {
        let prefix = &captures[1];
        let raw_path = &captures[2];
        let suffix = &captures[3];
        let absolute = absolute_markdown_image_url(raw_path, job_id, base_url);
        format!("{prefix}{absolute}{suffix}")
    });

    html_sq
        .replace_all(&rewritten_html_dq, |captures: &regex::Captures<'_>| {
            let prefix = &captures[1];
            let raw_path = &captures[2];
            let suffix = &captures[3];
            let absolute = absolute_markdown_image_url(raw_path, job_id, base_url);
            format!("{prefix}{absolute}{suffix}")
        })
        .into_owned()
}

fn absolute_markdown_image_url(raw_path: &str, job_id: &str, base_url: &str) -> String {
    let relative = normalize_markdown_image_rel(raw_path);
    if relative.is_empty() {
        return raw_path.to_string();
    }
    let resource_path = format!(
        "/api/v1/jobs/{job_id}/markdown/images/{}",
        url_path_escape(&relative)
    );
    to_absolute_url(base_url, &resource_path)
}

/// Chuẩn hoá markdown Hình ảnh đường dẫn tương đối → tương đối images Đường dẫn đến thư mục（Không bao gồm images/ Tiền tố）
fn normalize_markdown_image_rel(raw: &str) -> String {
    let mut path = raw.trim().trim_matches(|c| c == '<' || c == '>').to_string();
    // Xóa tùy chọn title：Chỉ khi `path "title"` / `path 'title'` Cắt ngắn vào
    // Bản thân tên tệp có thể chứa khoảng trắng（chart a.png），Không thể nhìn thấy khoảng trống, chỉ cần cắt chúng ra
    if let Some(idx) = path.find(" \"") {
        path = path[..idx].to_string();
    } else if let Some(idx) = path.find(" '") {
        path = path[..idx].to_string();
    }
    path = path.replace('\\', "/");
    while path.starts_with("./") {
        path = path[2..].to_string();
    }
    // Bóc một hoặc nhiều lớp images/ Tiền tố，tránh cho images/images/...
    while path.starts_with("images/") {
        path = path["images/".len()..].to_string();
    }
    path.trim().to_string()
}

fn url_path_escape(path: &str) -> String {
    path.split('/')
        .map(percent_encode_path_segment)
        .collect::<Vec<_>>()
        .join("/")
}

fn percent_encode_path_segment(segment: &str) -> String {
    let mut encoded = String::new();
    for byte in segment.as_bytes() {
        let ch = *byte as char;
        if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '~') {
            encoded.push(ch);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}
