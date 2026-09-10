use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use regex::{Captures, Regex};
use reqwest::Client;
use serde_json::Value;

pub(super) async fn materialize_paddle_markdown_artifacts(
    payload: &Value,
    job_root: &Path,
) -> Result<Option<PathBuf>> {
    let Some(layout_results) = payload
        .get("layoutParsingResults")
        .and_then(Value::as_array)
    else {
        return Ok(None);
    };
    if layout_results.is_empty() {
        return Ok(None);
    }

    let markdown_dir = job_root.join("md");
    let images_root = markdown_dir.join("images");
    let http = Client::new();
    let mut page_texts = Vec::new();
    let mut wrote_anything = false;

    for (page_idx, page_payload) in layout_results.iter().enumerate() {
        let Some(markdown) = page_payload.get("markdown").and_then(Value::as_object) else {
            continue;
        };
        let text = markdown
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();
        let images = markdown.get("images").and_then(Value::as_object);
        if text.is_empty() && images.is_none() {
            continue;
        }

        let mut remapped_text = text;
        if let Some(images) = images {
            for (raw_rel_path, raw_payload) in images {
                let rel_path = raw_rel_path.trim().trim_start_matches('/');
                if rel_path.is_empty() {
                    continue;
                }
                // Preserve the provider-returned relative path shape under md/images.
                // The page prefix prevents multi-page jobs from colliding on identical image names.
                let target_rel = paddle_markdown_target_rel_path_for_image_key(
                    rel_path,
                    &remapped_text,
                    page_idx + 1,
                );
                let markdown_rel = PathBuf::from("images").join(&target_rel);
                let target_path = images_root.join(&target_rel);
                let image_bytes = decode_markdown_image_payload(&http, raw_payload).await?;
                if let Some(parent) = target_path.parent() {
                    tokio::fs::create_dir_all(parent).await?;
                }
                tokio::fs::write(&target_path, image_bytes)
                    .await
                    .with_context(|| format!("failed to write {}", target_path.display()))?;
                if !is_page_prefixed_alias(&target_rel.to_string_lossy(), rel_path) {
                    remapped_text =
                        remapped_text.replace(rel_path, &markdown_rel.to_string_lossy());
                }
                wrote_anything = true;
            }
        }
        remapped_text = normalize_paddle_markdown_images(&remapped_text, page_idx + 1);

        if !remapped_text.trim().is_empty() {
            page_texts.push(remapped_text.trim().to_string());
            wrote_anything = true;
        }
    }

    if !wrote_anything {
        return Ok(None);
    }

    tokio::fs::create_dir_all(&markdown_dir).await?;
    let full_md_path = markdown_dir.join("full.md");
    let mut content = page_texts.join("\n\n");
    if !content.ends_with('\n') {
        content.push('\n');
    }
    tokio::fs::write(&full_md_path, content)
        .await
        .with_context(|| format!("failed to write {}", full_md_path.display()))?;
    Ok(Some(full_md_path))
}

fn paddle_markdown_target_rel_path(rel_path: &str, page_index: usize) -> PathBuf {
    let normalized = rel_path.trim().trim_start_matches('/').replace('\\', "/");
    if normalized
        .split_once('/')
        .map(|(prefix, _)| is_page_prefix(prefix))
        .unwrap_or_else(|| is_page_prefix(&normalized))
    {
        return PathBuf::from(normalized);
    }
    PathBuf::from(format!("page-{page_index}")).join(normalized)
}

fn paddle_markdown_target_rel_path_for_image_key(
    rel_path: &str,
    markdown_text: &str,
    page_index: usize,
) -> PathBuf {
    let normalized = rel_path.trim().trim_start_matches('/').replace('\\', "/");
    if normalized
        .split_once('/')
        .map(|(prefix, _)| is_page_prefix(prefix))
        .unwrap_or_else(|| is_page_prefix(&normalized))
    {
        return PathBuf::from(normalized);
    }
    let re = Regex::new(r#"(?i)<img\b[^>]*\bsrc=["']([^"']+)["']"#).expect("valid img src regex");
    for captures in re.captures_iter(markdown_text) {
        let src = captures[1]
            .trim()
            .trim_start_matches('/')
            .replace('\\', "/");
        if src.ends_with(&normalized)
            && src
                .split_once('/')
                .map(|(prefix, _)| is_page_prefix(prefix))
                .unwrap_or_else(|| is_page_prefix(&src))
        {
            return PathBuf::from(src);
        }
    }
    paddle_markdown_target_rel_path(&normalized, page_index)
}

fn paddle_markdown_rel_src_path(src: &str, page_index: usize) -> String {
    let normalized = src.trim().trim_start_matches('/').replace('\\', "/");
    if normalized.is_empty()
        || normalized.starts_with("http://")
        || normalized.starts_with("https://")
        || normalized.starts_with("data:")
    {
        return normalized;
    }
    if normalized.starts_with("images/") {
        return normalized;
    }
    PathBuf::from("images")
        .join(paddle_markdown_target_rel_path(&normalized, page_index))
        .to_string_lossy()
        .replace('\\', "/")
}

fn rewrite_paddle_markdown_image_srcs(text: &str, page_index: usize) -> String {
    let re =
        Regex::new(r#"(?i)(<img\b[^>]*\bsrc=["'])([^"']+)(["'])"#).expect("valid img src regex");
    re.replace_all(text, |captures: &Captures<'_>| {
        format!(
            "{}{}{}",
            &captures[1],
            paddle_markdown_rel_src_path(&captures[2], page_index),
            &captures[3]
        )
    })
    .into_owned()
}

fn normalize_paddle_markdown_images(text: &str, page_index: usize) -> String {
    let rewritten = rewrite_paddle_markdown_image_srcs(text, page_index);
    let centered_div_re = Regex::new(
        r#"(?i)<div\s+style=["']text-align:\s*center;?["']\s*>\s*(<img\b[^>]*>)\s*</div>"#,
    )
    .expect("valid centered img div regex");
    let without_center_div = centered_div_re.replace_all(&rewritten, |captures: &Captures<'_>| {
        markdown_image_from_img_tag(&captures[1])
    });
    let img_re = Regex::new(r#"(?i)<img\b([^>]*)>"#).expect("valid img tag regex");
    img_re
        .replace_all(&without_center_div, |captures: &Captures<'_>| {
            markdown_image_from_attrs(&captures[1])
        })
        .into_owned()
}

fn markdown_image_from_img_tag(img_tag: &str) -> String {
    let img_re = Regex::new(r#"(?i)<img\b([^>]*)>"#).expect("valid img tag regex");
    let Some(captures) = img_re.captures(img_tag) else {
        return img_tag.to_string();
    };
    markdown_image_from_attrs(&captures[1])
}

fn markdown_image_from_attrs(attrs_text: &str) -> String {
    let attr_re = Regex::new(r#"([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*["']([^"']*)["']"#)
        .expect("valid html attr regex");
    let mut src = String::new();
    let mut alt = String::from("Image");
    for captures in attr_re.captures_iter(attrs_text) {
        let key = captures[1].to_ascii_lowercase();
        if key == "src" {
            src = captures[2].trim().to_string();
        } else if key == "alt" {
            let value = captures[2].trim();
            if !value.is_empty() {
                alt = value.to_string();
            }
        }
    }
    if src.is_empty() {
        return format!("<img{attrs_text}>");
    }
    let escaped_alt = alt.replace('[', r"\[").replace(']', r"\]");
    format!("![{escaped_alt}]({src})")
}

fn is_page_prefixed_alias(target_rel_path: &str, source_rel_path: &str) -> bool {
    let target = target_rel_path
        .trim()
        .trim_start_matches('/')
        .replace('\\', "/");
    let source = source_rel_path
        .trim()
        .trim_start_matches('/')
        .replace('\\', "/");
    target != source
        && target.ends_with(&source)
        && target
            .split_once('/')
            .map(|(prefix, _)| is_page_prefix(prefix))
            .unwrap_or_else(|| is_page_prefix(&target))
}

fn is_page_prefix(value: &str) -> bool {
    let Some(number) = value.strip_prefix("page-") else {
        return false;
    };
    !number.is_empty() && number.chars().all(|ch| ch.is_ascii_digit())
}

async fn decode_markdown_image_payload(http: &Client, raw_payload: &Value) -> Result<Vec<u8>> {
    let payload = raw_payload
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow!("empty paddle markdown image payload"))?;

    if payload.starts_with("http://") || payload.starts_with("https://") {
        let response = http
            .get(payload)
            .send()
            .await
            .with_context(|| format!("failed to download markdown image {payload}"))?
            .error_for_status()
            .with_context(|| format!("markdown image returned error status: {payload}"))?;
        let bytes = response.bytes().await?;
        return Ok(bytes.to_vec());
    }

    if payload.starts_with("data:") {
        let (_, encoded) = payload
            .split_once(',')
            .ok_or_else(|| anyhow!("invalid data-url markdown image payload"))?;
        return STANDARD
            .decode(encoded)
            .context("failed to decode data-url markdown image payload");
    }

    STANDARD
        .decode(payload)
        .context("failed to decode base64 markdown image payload")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn materialize_paddle_markdown_artifacts_writes_full_md_and_images() {
        let root = std::env::temp_dir().join(format!("rust-api-paddle-md-{}", fastrand::u64(..)));
        let payload = json!({
            "layoutParsingResults": [
                {
                    "markdown": {
                        "text": "<div style=\"text-align: center;\"><img src=\"imgs/a.png\" alt=\"Image\" width=\"48%\" /></div>",
                        "images": {
                            "imgs/a.png": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD3sAAAAASUVORK5CYII="
                        }
                    }
                }
            ]
        });

        let full_md = materialize_paddle_markdown_artifacts(&payload, &root)
            .await
            .expect("materialize")
            .expect("markdown path");
        let content = tokio::fs::read_to_string(&full_md)
            .await
            .expect("read markdown");
        assert!(content.contains("![Image](images/page-1/imgs/a.png)"));
        assert!(!content.contains("<img"));
        assert!(root.join("md/images/page-1/imgs/a.png").exists());

        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn materialize_paddle_markdown_artifacts_rewrites_page_prefixed_src_with_unprefixed_key()
    {
        let root = std::env::temp_dir().join(format!("rust-api-paddle-md-{}", fastrand::u64(..)));
        let payload = json!({
            "layoutParsingResults": [
                {
                    "markdown": {
                        "text": "<div><img src=\"page-5/imgs/a.png\" alt=\"Image\" /></div>",
                        "images": {
                            "imgs/a.png": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD3sAAAAASUVORK5CYII="
                        }
                    }
                }
            ]
        });

        let full_md = materialize_paddle_markdown_artifacts(&payload, &root)
            .await
            .expect("materialize")
            .expect("markdown path");
        let content = tokio::fs::read_to_string(&full_md)
            .await
            .expect("read markdown");
        assert!(content.contains("![Image](images/page-5/imgs/a.png)"));
        assert!(!content.contains("<img"));
        assert!(root.join("md/images/page-5/imgs/a.png").exists());

        let _ = std::fs::remove_dir_all(root);
    }
}
