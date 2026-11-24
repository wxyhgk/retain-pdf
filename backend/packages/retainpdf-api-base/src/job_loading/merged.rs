//! 合并阅读的虚拟任务：`merged-<文档 id>-<指纹前 16 位>`。
//!
//! 读路径上它和普通任务一样经过 [`super::load_supported_job`]，所以"认出虚拟 id、读出它的任务快照"
//! 放在这一层；生成合并目录、写说明文件的是 `services::library::merge`。

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde::{Deserialize, Serialize};

use retainpdf_data::db::Db;
use crate::error::AppError;
use retainpdf_core::models::domain::{JobArtifacts, JobSnapshot, JobStatusKind};
use retainpdf_core::storage_paths::{is_merged_job_id, to_relative_data_path, MergedJobId};

/// 合并目录里的说明文件名。
pub const SIDECAR: &str = "reading.json";

/// 合并目录里「最后一次被读」的标记文件，看的是它的修改时间。清理旧合并目录时按它算年龄
/// （`retainpdf_library` 的 `merge::build::prune_stale`），不按目录的生成时间：两天前生成、
/// 今天还开着的阅读器不能因为别处生成了新的合并就被删掉。
pub const LAST_USED_MARKER: &str = ".last-used";

/// 虚拟 id 格式对、合并目录却不在了（被清理，或者从没生成过）：404 带这个
/// `error.details.reason`。客户端重新调 `GET /documents/:id/reading` 换一个新 id。
pub const MERGED_READING_EXPIRED: &str = "merged_reading_expired";

/// 标记最多多久写一次。阅读器每翻一页都要读几次，没必要每次都写盘；和保留一天相比，
/// 差这几分钟无所谓。
const MARK_USED_EVERY: Duration = Duration::from_secs(10 * 60);

/// 记下合并目录此刻还在被用。尽力而为：写不了（目录已经没了、只读盘）不影响这次读。
pub fn mark_merged_used(root: &Path, now: SystemTime) {
    if !root.is_dir() {
        return;
    }
    let marker = root.join(LAST_USED_MARKER);
    let recent = std::fs::metadata(&marker)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|modified| now.duration_since(modified).ok())
        .is_some_and(|age| age < MARK_USED_EVERY);
    if recent {
        return;
    }
    if let Ok(file) = std::fs::File::options().create(true).truncate(false).write(true).open(&marker) {
        let _ = file.set_modified(now);
    }
}

/// 合并目录最后一次被用的时间：标记和目录本身的修改时间（生成时间）取晚的那个。
pub fn merged_last_used(root: &Path) -> Option<SystemTime> {
    let modified = |path: &Path| std::fs::metadata(path).and_then(|meta| meta.modified()).ok();
    match (modified(root), modified(&root.join(LAST_USED_MARKER))) {
        (Some(dir), Some(marker)) => Some(dir.max(marker)),
        (dir, marker) => dir.or(marker),
    }
}

/// 虚拟任务 id 的格式定义在 `storage_paths::MergedJobId`：Python 的 AI 服务也要认它。
pub type VirtualJobId = MergedJobId;

pub fn is_virtual_job_id(job_id: &str) -> bool {
    is_merged_job_id(job_id)
}

/// 合并目录。布局与普通任务目录一致，下游按读普通任务的方式读。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MergedTranslation {
    pub root: PathBuf,
}

impl MergedTranslation {
    pub fn output_pdf(&self) -> PathBuf {
        self.root.join("rendered").join("merged.pdf")
    }

    pub fn translations_dir(&self) -> PathBuf {
        self.root.join("translated")
    }

    pub fn normalized_document(&self) -> PathBuf {
        self.root.join("ocr").join("normalized").join("document.v1.json")
    }
}

/// 合并目录里的说明文件：拼任务快照要的、目录本身看不出来的东西。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReadingSidecar {
    pub document_id: String,
    /// 最新的参与任务。快照的请求参数、标题这些展示信息取自它。
    pub base_job_id: String,
    pub contributing_job_ids: Vec<String>,
    pub page_count: u32,
    pub source_pdf: String,
}

/// 把虚拟 id 解析成一个任务快照：请求参数、标题取自最新的参与任务，产物全部指向合并目录。
///
/// 产物从 `JobArtifacts::default()` 起步，只填合并目录里真有的东西。不沿用参与任务的
/// 产物字段：那些路径（诊断、日志、OCR 原始包…）属于某一个任务，挂在合并结果上会让
/// 下游读到只覆盖一部分页的数据。
pub fn load_virtual_job(db: &Db, data_root: &Path, job_id: &str) -> Result<JobSnapshot, AppError> {
    let not_found = || AppError::not_found(format!("job not found: {job_id}"));
    let id = VirtualJobId::parse(job_id).ok_or_else(not_found)?;
    let merged = MergedTranslation { root: id.root(data_root) };
    // 说明文件不在：合并目录被清理了（或者生成到一半进程没了，下一次 `/reading` 会补写）。
    // 两种情况客户端都该重新问一次阅读入口，所以带上 reason；提示和普通 404 一样。
    let sidecar: ReadingSidecar = std::fs::read(merged.root.join(SIDECAR))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .ok_or_else(|| AppError::not_found_because(MERGED_READING_EXPIRED, format!("job not found: {job_id}")))?;
    if sidecar.document_id != id.document_id {
        return Err(not_found());
    }
    mark_merged_used(&merged.root, SystemTime::now());
    let base = db
        .get_job(&sidecar.base_job_id)
        .map_err(|error| AppError::from_lookup(error, format!("job not found: {job_id}")))?;
    let relative = |path: &Path| {
        to_relative_data_path(data_root, path).unwrap_or_else(|_| path.to_string_lossy().into_owned())
    };
    let mut job = base;
    job.job_id = job_id.to_string();
    job.status = JobStatusKind::Succeeded;
    job.request_payload.translation.start_page = 0;
    job.request_payload.translation.end_page = -1;
    job.request_payload.translation.page_ranges = Default::default();
    job.artifacts = Some(JobArtifacts {
        job_root: Some(relative(&merged.root)),
        source_pdf: Some(sidecar.source_pdf.clone()),
        output_pdf: Some(relative(&merged.output_pdf())),
        translations_dir: Some(relative(&merged.translations_dir())),
        normalized_document_json: Some(relative(&merged.normalized_document()))
            .filter(|_| merged.normalized_document().is_file()),
        ocr_page_numbers: (1..=sidecar.page_count).collect(),
        ..JobArtifacts::default()
    });
    Ok(job)
}

/// 参与这份合并的任务 id，按页序首次出现的顺序。给界面说「这本书由哪几次翻译拼成」。
pub fn contributing_jobs(data_root: &Path, job_id: &str) -> Option<Vec<String>> {
    let id = VirtualJobId::parse(job_id)?;
    let bytes = std::fs::read(id.root(data_root).join(SIDECAR)).ok()?;
    let sidecar: ReadingSidecar = serde_json::from_slice(&bytes).ok()?;
    Some(sidecar.contributing_job_ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;

    struct Root(PathBuf);

    impl Root {
        fn new(name: &str) -> Self {
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!("retain-merged-{name}-{}-{nanos}", std::process::id()));
            std::fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for Root {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn virtual_id() -> VirtualJobId {
        VirtualJobId { document_id: "a".repeat(64), fingerprint: "0123456789abcdef".to_string() }
    }

    /// 合并目录被清理以后，正在读的阅读器拿着旧的虚拟 id 来读：404 要带 reason，前端才知道该
    /// 重新问一次 `/documents/:id/reading` 换新 id，而不是当成「任务被删了」。
    #[test]
    fn a_merged_reading_whose_directory_is_gone_is_404_with_an_expired_reason() {
        let root = Root::new("expired");
        let db = Db::new(root.0.join("jobs.db"), root.0.clone());
        let job_id = virtual_id().format();
        let error = load_virtual_job(&db, &root.0, &job_id).unwrap_err();
        assert!(
            matches!(&error, AppError::Reasoned { status, reason, message, .. }
                if *status == StatusCode::NOT_FOUND && *reason == "merged_reading_expired"
                    && *message == format!("job not found: {job_id}")),
            "{error:?}"
        );
    }

    /// 每次读都记下「最后一次被读」，清理旧合并目录时按它算年龄（`merge::build::prune_stale`）。
    #[test]
    fn reading_a_merged_job_records_that_it_is_still_in_use() {
        use retainpdf_core::models::request::CreateJobInput;

        let root = Root::new("in-use");
        let db = Db::new(root.0.join("jobs.db"), root.0.clone());
        db.save_job(&JobSnapshot::new("base".to_string(), CreateJobInput::default(), vec![])).unwrap();
        let id = virtual_id();
        let merged = id.root(&root.0);
        std::fs::create_dir_all(&merged).unwrap();
        let sidecar = ReadingSidecar {
            document_id: id.document_id.clone(),
            base_job_id: "base".to_string(),
            contributing_job_ids: vec!["base".to_string()],
            page_count: 2,
            source_pdf: "uploads/up/book.pdf".to_string(),
        };
        std::fs::write(merged.join(SIDECAR), serde_json::to_vec(&sidecar).unwrap()).unwrap();
        let marker = merged.join(".last-used");
        assert!(!marker.exists());
        let job = load_virtual_job(&db, &root.0, &id.format()).unwrap();
        assert_eq!(job.job_id, id.format());
        let used = std::fs::metadata(&marker).expect("读了合并目录却没记下").modified().unwrap();
        assert!(used.elapsed().unwrap_or_default() < std::time::Duration::from_secs(60));
    }

    #[test]
    fn a_malformed_merged_id_stays_a_plain_404() {
        let root = Root::new("malformed");
        let db = Db::new(root.0.join("jobs.db"), root.0.clone());
        let error = load_virtual_job(&db, &root.0, "merged-nope").unwrap_err();
        assert!(matches!(error, AppError::NotFound(_)), "{error:?}");
    }
}
