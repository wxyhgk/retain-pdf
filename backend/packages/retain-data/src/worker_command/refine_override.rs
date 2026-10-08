//! `retry-stage stage=refine` 的一次性精修覆盖在磁盘上的落点。
//!
//! 覆盖值**不**写进任务的 `translation.refine`：那是「翻译之后紧接着的那次渲染要不要
//! 精修」的任务配置，写进去之后每次普通重渲染都会再精修一遍、再花一次钱。所以覆盖值
//! 单独落在 `<job_root>/specs/refine-override.json`：
//!
//! - API 在提交原地 Render workflow **之前**写入（写在启动之后会和运行时读它赛跑）；
//! - Render workflow 写 render.spec.json 时读取，带进 `params.refine`（trigger=manual）；
//! - Render workflow 结束（成功 / 失败 / 取消）后删除；
//! - 任务运行时重启时文件还在：被启动恢复判成可续跑（queued）的任务续跑时仍然带这次
//!   精修；被判成 failed 的任务留下的文件无害——任何一次原地渲染提交（普通重渲染、
//!   rerun、PATCH rerender）都会先清掉它，精修重试则会重新写。

use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use crate::models::domain::RefineOverride;
use crate::storage_paths::JobPaths;

pub const REFINE_OVERRIDE_FILE_NAME: &str = "refine-override.json";

pub fn refine_override_path(job_paths: &JobPaths) -> PathBuf {
    job_paths.specs_dir.join(REFINE_OVERRIDE_FILE_NAME)
}

/// 原子写入（临时文件 + rename），不会被读到半个文件。
pub fn write_refine_override(job_paths: &JobPaths, value: &RefineOverride) -> Result<PathBuf> {
    fs::create_dir_all(&job_paths.specs_dir)
        .with_context(|| format!("create specs dir: {}", job_paths.specs_dir.display()))?;
    let path = refine_override_path(job_paths);
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(value)?)
        .with_context(|| format!("write refine override: {}", tmp.display()))?;
    fs::rename(&tmp, &path)
        .with_context(|| format!("commit refine override: {}", path.display()))?;
    Ok(path)
}

/// 没有覆盖时返回 `None`。文件损坏也返回 `None`（并由调用方记日志）：
/// 精修是可选的增强，坏掉的覆盖文件不该让整个渲染失败。
pub fn load_refine_override(job_paths: &JobPaths) -> Result<Option<RefineOverride>> {
    read_refine_override(&refine_override_path(job_paths))
}

fn read_refine_override(path: &Path) -> Result<Option<RefineOverride>> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(error).with_context(|| format!("read refine override: {}", path.display()))
        }
    };
    serde_json::from_slice(&bytes)
        .map(Some)
        .with_context(|| format!("parse refine override: {}", path.display()))
}

/// 删除覆盖（不存在时是空操作）。
pub fn clear_refine_override(job_paths: &JobPaths) -> Result<()> {
    let path = refine_override_path(job_paths);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => {
            Err(error).with_context(|| format!("remove refine override: {}", path.display()))
        }
    }
}
