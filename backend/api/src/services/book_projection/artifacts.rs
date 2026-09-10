use crate::models::api::{ArtifactDisplayItemView, ArtifactLinksView};

pub(crate) fn build_artifacts_display(
    artifacts: &ArtifactLinksView,
) -> Vec<ArtifactDisplayItemView> {
    vec![
        artifact_display_item(
            "output_pdf",
            "译文 PDF",
            "pdf",
            artifacts.pdf.ready,
            artifacts.pdf.file_name.clone(),
            artifacts.pdf.size_bytes,
            Some(artifacts.pdf.url.clone()),
        ),
        artifact_display_item(
            "markdown",
            "Markdown",
            "markdown",
            artifacts.markdown.ready,
            artifacts.markdown.file_name.clone(),
            artifacts.markdown.size_bytes,
            Some(artifacts.markdown.raw_url.clone()),
        ),
        artifact_display_item(
            "bundle",
            "任务打包文件",
            "zip",
            artifacts.bundle.ready,
            artifacts.bundle.file_name.clone(),
            artifacts.bundle.size_bytes,
            Some(artifacts.bundle.url.clone()),
        ),
        artifact_display_item(
            "normalized_document",
            "标准化 OCR 文档",
            "json",
            artifacts.normalized_document.ready,
            artifacts.normalized_document.file_name.clone(),
            artifacts.normalized_document.size_bytes,
            Some(artifacts.normalized_document.url.clone()),
        ),
        artifact_display_item(
            "normalization_report",
            "OCR 标准化报告",
            "json",
            artifacts.normalization_report.ready,
            artifacts.normalization_report.file_name.clone(),
            artifacts.normalization_report.size_bytes,
            Some(artifacts.normalization_report.url.clone()),
        ),
    ]
}

fn artifact_display_item(
    key: &str,
    label: &str,
    kind: &str,
    ready: bool,
    file_name: Option<String>,
    size_bytes: Option<u64>,
    download_url: Option<String>,
) -> ArtifactDisplayItemView {
    ArtifactDisplayItemView {
        key: key.to_string(),
        label: label.to_string(),
        ready,
        kind: kind.to_string(),
        file_name,
        size_bytes,
        download_url: download_url.filter(|_| ready),
    }
}
