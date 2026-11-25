//! 按编号读出任务、确认它的目录格式还受支持。
//!
//! 任务、文件、书库、合并阅读都要用，本质是读数据库，不是哪个领域的业务逻辑，所以放在 services
//! 下面一层，大家往下依赖它（拆包规划第 5 节第 2 条）。这里不许依赖 `services`、`routes`。
//!
//! 合并结果的虚拟 id（`merged-<文档>-<指纹>`）只在读路径（`load_supported_job`）上认；写操作走
//! `load_job_or_404`，数据库里查不到它，重试、取消、删除自然被拒绝。

mod merged;

use std::path::Path;

use retainpdf_data::db::Db;
use crate::error::AppError;
use retainpdf_core::models::domain::JobSnapshot;
use retainpdf_core::storage_paths::{
    job_uses_legacy_output_layout, job_uses_legacy_path_storage, LEGACY_JOB_UNSUPPORTED_MESSAGE,
};

pub use merged::{
    contributing_jobs, is_virtual_job_id, load_virtual_job, mark_merged_used, merged_last_used,
    MergedTranslation, ReadingSidecar, VirtualJobId, LAST_USED_MARKER, MERGED_READING_EXPIRED, SIDECAR,
};

/// 没有这个任务是 404；有记录但读不出来（行解码失败、库被锁……）是 500，不能说成「找不到」。
pub fn load_job_or_404(db: &Db, job_id: &str) -> Result<JobSnapshot, AppError> {
    db.get_job(job_id)
        .map_err(|error| AppError::from_lookup(error, format!("job not found: {job_id}")))
}

fn ensure_supported_job_layout(data_root: &Path, job: &JobSnapshot) -> Result<(), AppError> {
    if job_uses_legacy_output_layout(job, data_root) || job_uses_legacy_path_storage(job) {
        return Err(AppError::conflict_because("legacy_job_unsupported", LEGACY_JOB_UNSUPPORTED_MESSAGE));
    }
    Ok(())
}

pub fn load_supported_job(
    db: &Db,
    data_root: &Path,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    // 合并结果的虚拟 id（`merged-<文档>-<指纹>`）只在读路径上认。写操作走
    // `load_job_or_404`，数据库里查不到它，重试/取消/删除自然被拒绝。
    if is_virtual_job_id(job_id) {
        return load_virtual_job(db, data_root, job_id);
    }
    let job = load_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    Ok(job)
}

