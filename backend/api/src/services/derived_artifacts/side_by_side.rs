use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use crate::error::AppError;
use crate::models::domain::JobSnapshot;

use super::{cached_output_is_fresh, job_artifacts_dir, DerivedArtifactDeps};

const BUILD_TIMEOUT: Duration = Duration::from_secs(120);
const POLL_INTERVAL: Duration = Duration::from_millis(10);

struct TemporaryPdf(PathBuf);

impl TemporaryPdf {
    fn create(output_pdf: &Path) -> Result<Self, AppError> {
        let parent = output_pdf
            .parent()
            .ok_or_else(|| AppError::internal("PDF output has no parent"))?;
        for _ in 0..16 {
            let path = parent.join(format!(".side-by-side-{:016x}.pdf.tmp", fastrand::u64(..)));
            match std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
            {
                Ok(_) => return Ok(Self(path)),
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error.into()),
            }
        }
        Err(AppError::internal("could not reserve a temporary PDF"))
    }
}

impl Drop for TemporaryPdf {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

pub(crate) fn ensure_side_by_side_pdf(
    deps: DerivedArtifactDeps<'_>,
    data_root: &Path,
    job: &JobSnapshot,
    source_pdf: &Path,
    translated_pdf: &Path,
) -> Result<PathBuf, AppError> {
    let output_dir = job_artifacts_dir(data_root, job)?;
    let output_pdf = output_dir.join(format!("{}-side-by-side.pdf", job.job_id));
    if !cached_output_is_fresh(&output_pdf, &[source_pdf, translated_pdf])? {
        build_side_by_side_pdf(deps, source_pdf, translated_pdf, &output_pdf)?;
    }
    Ok(output_pdf)
}

fn build_side_by_side_pdf(
    deps: DerivedArtifactDeps<'_>,
    source_pdf: &Path,
    translated_pdf: &Path,
    output_pdf: &Path,
) -> Result<(), AppError> {
    build_with_command(output_pdf, BUILD_TIMEOUT, |tmp_pdf| {
        let mut command = side_by_side_command(deps);
        command
            .arg("--source-pdf")
            .arg(source_pdf)
            .arg("--translated-pdf")
            .arg(translated_pdf)
            .arg("--output-pdf")
            .arg(tmp_pdf);
        command
    })
}

pub(super) fn build_with_command(
    output_pdf: &Path,
    timeout: Duration,
    command_for_output: impl FnOnce(&Path) -> Command,
) -> Result<(), AppError> {
    let temporary = TemporaryPdf::create(output_pdf)?;
    let mut command = command_for_output(&temporary.0);
    // Do not inherit provider output or hold unread pipes that can deadlock.
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            AppError::internal(format!("failed to start side-by-side pdf builder: {error}"))
        })?;
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() < timeout => {
                std::thread::sleep(POLL_INTERVAL.min(timeout.saturating_sub(started.elapsed())));
            }
            result => {
                // Reap only after a successful kill (or an already exited child),
                // never block waiting on a process we failed to terminate.
                if child.kill().is_ok() {
                    let _ = child.wait();
                } else {
                    let _ = child.try_wait();
                }
                return Err(AppError::internal(if result.is_err() {
                    "failed to monitor side-by-side pdf builder"
                } else {
                    "side-by-side pdf builder timed out"
                }));
            }
        }
    };
    if !status.success() || !temporary.0.is_file() || std::fs::metadata(&temporary.0)?.len() == 0 {
        return Err(AppError::internal(
            "failed to build side-by-side pdf from source and translated pdf",
        ));
    }
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(&temporary.0)?;
    file.sync_all()?;
    drop(file);
    std::fs::rename(&temporary.0, output_pdf)?;
    Ok(())
}

fn side_by_side_command(deps: DerivedArtifactDeps<'_>) -> std::process::Command {
    let mut command = std::process::Command::new(deps.pipeline_command);
    command.arg("side-by-side-pdf");
    command
}

#[cfg(test)]
#[path = "side_by_side_tests.rs"]
mod tests;
