//! 原地重跑（重渲染 / 精修）期间的上一份译文 PDF。
//!
//! 原地重跑把 `output_pdf` 挪进 `previous_output_pdf`（排队期间阅读接着用它）。渲染写的是同一个
//! 文件名（`rendered/<名>.pdf`），而且不是原子替换（`doc.save` 直接改写、有的步骤先删再写），
//! 留在原地的话新一次渲染一开始就可能把它截断。所以：
//!
//! 1. 落库开跑之前 [`plan_previous_output_pdf_move`]：快照里的 `previous_output_pdf` 换成同目录的
//!    `<名>.previous.pdf`；落库成功（确实轮到这一次运行）之后 [`PreviousOutputPdfMove::apply`] 把文件挪过去。
//!    渲染要写的名字空出来，新文件是另建的，旧文件不会被碰到。
//! 2. 这一次没跑成（failed / canceled）落库时 [`restore_previous_output_pdf`]：`output_pdf` 为空、上一份
//!    还在，就把 `output_pdf` 指回它，下载、预览、Word 照旧有译文 PDF 可用。

use std::path::{Path, PathBuf};

use crate::models::domain::{JobSnapshot, JobStatusKind};

use super::job_paths::JobPaths;
use super::path_ops::resolve_data_path;

/// 挪开后的文件名后缀。渲染输出名是 `<原文名>-translated.pdf` 或请求里的 `translated_pdf_name`，
/// 不会用这个后缀。
const PREVIOUS_OUTPUT_PDF_SUFFIX: &str = ".previous.pdf";

/// 是不是挪开后的上一份译文（`<名>.previous.pdf`）。清理成功任务里用完的上一份时认它。
pub fn is_previous_output_pdf(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.ends_with(PREVIOUS_OUTPUT_PDF_SUFFIX))
}

/// 落库成功之后要做的那一次挪动（见模块说明）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviousOutputPdfMove {
    from: PathBuf,
    to: PathBuf,
}

impl PreviousOutputPdfMove {
    /// 同目录内改名，原子操作；`to` 已有（更早一次挪开的）就覆盖。
    pub fn apply(&self) -> std::io::Result<()> {
        std::fs::rename(&self.from, &self.to)
    }
}

/// 原地重跑落库之前调：`previous_output_pdf` 指向的文件在本任务目录下、还没挪开过，就把快照里的
/// 路径改成挪开后的名字，返回落库成功后要做的挪动。文件不在、不在本任务目录下（不动别人的文件）、
/// 已经是挪开后的名字（上一次没跑成接回来的），都不挪，快照不改。
pub fn plan_previous_output_pdf_move(
    job: &mut JobSnapshot,
    data_root: &Path,
    output_root: &Path,
) -> Option<PreviousOutputPdfMove> {
    let job_root = JobPaths::for_job(output_root, &job.job_id).root;
    let artifacts = job.artifacts.as_mut()?;
    let stored = artifacts.previous_output_pdf.as_deref()?;
    let stored_path = Path::new(stored);
    let file_name = stored_path.file_name()?.to_str()?;
    if file_name.ends_with(PREVIOUS_OUTPUT_PDF_SUFFIX) {
        return None;
    }
    let from = resolve_data_path(data_root, stored).ok()?;
    if !from.is_file() || !is_inside(&from, &job_root) {
        return None;
    }
    let stem = Path::new(file_name).file_stem()?.to_str()?;
    let aside_name = format!("{stem}{PREVIOUS_OUTPUT_PDF_SUFFIX}");
    let to = from.with_file_name(&aside_name);
    artifacts.previous_output_pdf = Some(
        stored_path
            .with_file_name(&aside_name)
            .to_string_lossy()
            .into_owned(),
    );
    Some(PreviousOutputPdfMove { from, to })
}

/// 落库时调（任何一次整行写）：任务落在 failed / canceled、`output_pdf` 为空、`previous_output_pdf`
/// 的文件还在，就把 `output_pdf` 指回上一份。其它情况不动。
pub fn restore_previous_output_pdf(job: &mut JobSnapshot, data_root: &Path) {
    if !matches!(job.status, JobStatusKind::Failed | JobStatusKind::Canceled) {
        return;
    }
    let Some(artifacts) = job.artifacts.as_mut() else {
        return;
    };
    if artifacts.output_pdf.is_some() {
        return;
    }
    let Some(previous) = artifacts.previous_output_pdf.as_deref() else {
        return;
    };
    if resolve_data_path(data_root, previous).is_ok_and(|path| path.is_file()) {
        artifacts.output_pdf = Some(previous.to_string());
    }
}

fn is_inside(path: &Path, root: &Path) -> bool {
    match (
        path.parent().and_then(|parent| parent.canonicalize().ok()),
        root.canonicalize(),
    ) {
        (Some(parent), Ok(root)) => parent.starts_with(root),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::models::domain::JobArtifacts;
    use crate::models::request::CreateJobInput;

    struct Root(PathBuf);

    impl Drop for Root {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn fixture(status: JobStatusKind) -> (Root, JobSnapshot) {
        let root = Root(std::env::temp_dir().join(format!(
            "retain-previous-output-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        )));
        let rendered = root.0.join("jobs/job-a/rendered");
        fs::create_dir_all(&rendered).unwrap();
        fs::write(rendered.join("out.pdf"), b"old pdf").unwrap();
        let mut job = JobSnapshot::new("job-a".to_string(), CreateJobInput::default(), Vec::new());
        job.status = status;
        job.artifacts = Some(JobArtifacts {
            previous_output_pdf: Some("jobs/job-a/rendered/out.pdf".to_string()),
            ..JobArtifacts::default()
        });
        (root, job)
    }

    fn previous(job: &JobSnapshot) -> Option<&str> {
        job.artifacts.as_ref()?.previous_output_pdf.as_deref()
    }

    #[test]
    fn move_frees_the_render_target_and_keeps_the_old_bytes() {
        let (root, mut job) = fixture(JobStatusKind::Queued);
        let planned = plan_previous_output_pdf_move(&mut job, &root.0, &root.0.join("jobs"))
            .expect("move planned");
        assert_eq!(previous(&job), Some("jobs/job-a/rendered/out.previous.pdf"));
        planned.apply().unwrap();
        let rendered = root.0.join("jobs/job-a/rendered");
        assert!(!rendered.join("out.pdf").exists());
        assert_eq!(fs::read(rendered.join("out.previous.pdf")).unwrap(), b"old pdf");
    }

    #[test]
    fn nothing_moves_for_an_already_moved_missing_or_foreign_file() {
        let (root, mut job) = fixture(JobStatusKind::Queued);
        let output_root = root.0.join("jobs");
        job.artifacts.as_mut().unwrap().previous_output_pdf =
            Some("jobs/job-a/rendered/out.previous.pdf".to_string());
        fs::write(root.0.join("jobs/job-a/rendered/out.previous.pdf"), b"x").unwrap();
        assert_eq!(plan_previous_output_pdf_move(&mut job, &root.0, &output_root), None);

        job.artifacts.as_mut().unwrap().previous_output_pdf =
            Some("jobs/job-a/rendered/missing.pdf".to_string());
        assert_eq!(plan_previous_output_pdf_move(&mut job, &root.0, &output_root), None);
        assert_eq!(previous(&job), Some("jobs/job-a/rendered/missing.pdf"));

        // 别的任务目录下的文件不挪。
        fs::create_dir_all(root.0.join("jobs/job-b/rendered")).unwrap();
        fs::write(root.0.join("jobs/job-b/rendered/out.pdf"), b"b").unwrap();
        job.artifacts.as_mut().unwrap().previous_output_pdf =
            Some("jobs/job-b/rendered/out.pdf".to_string());
        assert_eq!(plan_previous_output_pdf_move(&mut job, &root.0, &output_root), None);
        assert!(root.0.join("jobs/job-b/rendered/out.pdf").is_file());
    }

    #[test]
    fn restore_only_when_the_run_did_not_succeed_and_the_file_is_there() {
        for status in [JobStatusKind::Failed, JobStatusKind::Canceled] {
            let (root, mut job) = fixture(status);
            restore_previous_output_pdf(&mut job, &root.0);
            assert_eq!(
                job.artifacts.as_ref().unwrap().output_pdf.as_deref(),
                Some("jobs/job-a/rendered/out.pdf")
            );
        }
        for status in [JobStatusKind::Queued, JobStatusKind::Running, JobStatusKind::Succeeded] {
            let (root, mut job) = fixture(status);
            restore_previous_output_pdf(&mut job, &root.0);
            assert_eq!(job.artifacts.as_ref().unwrap().output_pdf, None);
        }
        let (root, mut job) = fixture(JobStatusKind::Failed);
        fs::remove_file(root.0.join("jobs/job-a/rendered/out.pdf")).unwrap();
        restore_previous_output_pdf(&mut job, &root.0);
        assert_eq!(job.artifacts.as_ref().unwrap().output_pdf, None, "文件不在就不接");
        let (root, mut job) = fixture(JobStatusKind::Failed);
        job.artifacts.as_mut().unwrap().output_pdf = Some("jobs/job-a/rendered/new.pdf".to_string());
        restore_previous_output_pdf(&mut job, &root.0);
        assert_eq!(
            job.artifacts.as_ref().unwrap().output_pdf.as_deref(),
            Some("jobs/job-a/rendered/new.pdf"),
            "已经有 output_pdf 的不动"
        );
    }
}
