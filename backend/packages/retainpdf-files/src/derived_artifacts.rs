use std::path::{Path, PathBuf};

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::JobSnapshot;

mod freshness;
pub(crate) mod pdf;
pub(crate) mod preview;
pub(crate) mod retention;
pub(crate) mod side_by_side;
pub(crate) mod watermark;
pub(crate) mod word;

pub(crate) use freshness::cached_output_is_fresh;

#[derive(Clone, Copy)]
pub struct DerivedArtifactDeps<'a> {
    pub python_bin: &'a str,
    pub pipeline_command: &'a str,
}

impl<'a> DerivedArtifactDeps<'a> {
    pub fn new(python_bin: &'a str) -> Self {
        Self {
            python_bin,
            pipeline_command: "retainpdf-pipeline",
        }
    }

    pub fn with_pipeline_command(python_bin: &'a str, pipeline_command: &'a str) -> Self {
        Self {
            python_bin,
            pipeline_command,
        }
    }
}

pub(crate) fn job_artifacts_dir(data_root: &Path, job: &JobSnapshot) -> Result<PathBuf, AppError> {
    let output_dir = job_artifacts_dir_path(data_root, job)?;
    std::fs::create_dir_all(&output_dir)?;
    Ok(output_dir)
}

/// 任务派生产物（Word、双栏 PDF、缩略图…）的缓存目录。
///
/// 普通任务是 `data/jobs/<job_id>/artifacts`。合并结果的虚拟 id 不能这么拼 —— 会在
/// `jobs/` 下凭空多出一个假任务目录 —— 它的缓存放进合并目录自己的 `artifacts/`：合并目录
/// 按内容指纹命名、不可变，缓存天然跟着内容走。
pub fn job_artifacts_dir_path(data_root: &Path, job: &JobSnapshot) -> Result<PathBuf, AppError> {
    if retainpdf_api_base::job_loading::is_virtual_job_id(&job.job_id) {
        let root = retainpdf_core::storage_paths::resolve_job_root(job, data_root)
            .ok_or_else(|| AppError::internal(format!("merged job has no root: {}", job.job_id)))?;
        return Ok(root.join("artifacts"));
    }
    Ok(data_root.join("jobs").join(&job.job_id).join("artifacts"))
}

// 派生缓存的文件名。生成和回收（`retention.rs`）都从这里拿，改了名字回收那边跟着认得。

pub(crate) fn side_by_side_file_name(job_id: &str) -> String {
    format!("{job_id}-side-by-side.pdf")
}

pub(crate) fn layout_docx_file_name(job_id: &str, cache_suffix: &str) -> String {
    format!("{job_id}-layout-{cache_suffix}.docx")
}

/// 盖了水印的 PDF：`<label>.watermarked-v<版本>.pdf`（版本见 `watermark.rs`）。
pub(crate) fn watermarked_file_name(label: &str) -> String {
    format!("{}.watermarked-v{}.pdf", label.replace('/', "_"), watermark::WATERMARK_VERSION)
}

pub(crate) fn linearized_file_name(label: &str) -> String {
    format!("{}.linearized.pdf", label.replace('/', "_"))
}

/// 任务的页预览：`artifacts/preview-<source|translated>-p0001-w1200-d0.jpg`。
pub fn job_page_preview_file_name(kind: &str, page: u32, width_px: u32, dpi: u32) -> String {
    format!("preview-{kind}-p{page:04}-w{width_px}-d{dpi}.jpg")
}

/// 书的页预览：`documents/<文档>/pages/p0001-w1200-d0.jpg`。
pub fn document_page_preview_path(
    data_root: &Path,
    document_id: &str,
    page: u32,
    width_px: u32,
    dpi: u32,
) -> Result<PathBuf, AppError> {
    Ok(document_artifacts_dir(data_root, document_id)?
        .join(retention::DOCUMENT_PAGES_DIR)
        .join(format!("p{page:04}-w{width_px}-d{dpi}.jpg")))
}

/// 删书时删掉这本书的缓存目录 `documents/<文档>/`（合并阅读、封面、缩略图、页预览，2026-11-26 S51）。
/// 里面全是能从原文和任务产物重建的东西；书的编号就是原文的内容哈希，一本书一个目录，别的书不会用它。
///
/// 只删 `documents/` 下面**一层**、真的是目录（不是符号链接）、解析后确实还在 `documents/` 里的那个；
/// 编号带分隔符、`..` 之类的一律不碰。没有这个目录返回 `Ok(None)`，删了返回它的路径。
/// 调用方必须在库里的行删除提交之后再调，删不掉只记日志（留下的只是能回收的孤儿缓存）。
pub fn remove_document_artifacts_dir(data_root: &Path, document_id: &str) -> std::io::Result<Option<PathBuf>> {
    use std::io::{Error, ErrorKind};
    let mut components = Path::new(document_id).components();
    if !matches!((components.next(), components.next()), (Some(std::path::Component::Normal(_)), None)) {
        return Err(Error::new(ErrorKind::InvalidInput, format!("refusing to remove document dir for id {document_id:?}")));
    }
    let documents = data_root.join("documents");
    let dir = documents.join(document_id);
    match std::fs::symlink_metadata(&dir) {
        Ok(meta) if meta.is_dir() => {}
        Ok(_) => {
            return Err(Error::new(ErrorKind::InvalidInput, format!("not a plain directory: {}", dir.display())));
        }
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    }
    let (resolved, root) = (dir.canonicalize()?, documents.canonicalize()?);
    if resolved.parent() != Some(root.as_path()) {
        return Err(Error::new(ErrorKind::InvalidInput, format!("outside the documents dir: {}", dir.display())));
    }
    match std::fs::remove_dir_all(&dir) {
        Ok(()) => Ok(Some(dir)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

/// 文档级缓存目录（无 job 时封面/缩略图仍可落盘）。
pub fn document_artifacts_dir(
    data_root: &Path,
    document_id: &str,
) -> Result<PathBuf, AppError> {
    let output_dir = data_root.join("documents").join(document_id);
    std::fs::create_dir_all(&output_dir)?;
    Ok(output_dir)
}

#[cfg(test)]
mod document_dir_tests {
    use super::*;

    #[test]
    fn removing_a_document_dir_only_touches_that_one_directory() {
        let root = std::env::temp_dir().join(format!("retain-document-dir-{:016x}", fastrand::u64(..)));
        let documents = root.join("documents");
        std::fs::create_dir_all(documents.join("doc-a").join("merged").join("0123456789abcdef")).unwrap();
        std::fs::write(documents.join("doc-a").join("cover.jpg"), b"jpeg").unwrap();
        std::fs::create_dir_all(documents.join("doc-b")).unwrap();
        std::fs::write(root.join("keep.txt"), b"x").unwrap();

        assert_eq!(remove_document_artifacts_dir(&root, "doc-a").unwrap(), Some(documents.join("doc-a")));
        assert!(!documents.join("doc-a").exists());
        assert!(documents.join("doc-b").is_dir());
        // 再删一次、没有这个目录：不是错
        assert_eq!(remove_document_artifacts_dir(&root, "doc-a").unwrap(), None);
        // 跳出 documents/ 的编号一律拒绝
        for id in ["..", "../documents", "doc-b/..", "", "/tmp", "a/b"] {
            assert!(remove_document_artifacts_dir(&root, id).is_err(), "{id:?}");
        }
        assert!(documents.join("doc-b").is_dir() && root.join("keep.txt").exists());
        #[cfg(unix)]
        {
            // 符号链接不跟：链到外面的目录不删
            let outside = root.join("outside");
            std::fs::create_dir_all(&outside).unwrap();
            std::fs::write(outside.join("precious.txt"), b"x").unwrap();
            std::os::unix::fs::symlink(&outside, documents.join("doc-link")).unwrap();
            assert!(remove_document_artifacts_dir(&root, "doc-link").is_err());
            assert!(outside.join("precious.txt").exists());
        }
        std::fs::remove_dir_all(root).unwrap();
    }
}
