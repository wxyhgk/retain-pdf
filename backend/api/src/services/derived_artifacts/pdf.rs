use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::error::AppError;
use crate::models::domain::JobSnapshot;

use super::job_artifacts_dir;

pub(crate) fn linearized_pdf_or_original(
    data_root: &Path,
    job: &JobSnapshot,
    input_pdf: &Path,
    label: &str,
) -> Result<PathBuf, AppError> {
    if !input_pdf.exists() || !input_pdf.is_file() {
        return Ok(input_pdf.to_path_buf());
    }
    let output_dir = job_artifacts_dir(data_root, job)?;
    let safe_label = label.replace('/', "_");
    let output_pdf = output_dir.join(format!("{safe_label}.linearized.pdf"));
    let input_meta = std::fs::metadata(input_pdf)?;
    if output_pdf.exists() && output_pdf.is_file() {
        let output_meta = std::fs::metadata(&output_pdf)?;
        if output_meta.modified().ok() >= input_meta.modified().ok() {
            return Ok(output_pdf);
        }
    }
    if !linearize_pdf_with_qpdf(input_pdf, &output_pdf) {
        return Ok(input_pdf.to_path_buf());
    }
    Ok(output_pdf)
}

fn linearize_pdf_with_qpdf(input_pdf: &Path, output_pdf: &Path) -> bool {
    let Some(qpdf) = find_tool("qpdf") else {
        return false;
    };
    // Linearization is optional: timeout/spawn/output failures keep serving the
    // original PDF and never replace a previous good cached derivative.
    super::side_by_side::build_with_command(output_pdf, Duration::from_secs(120), |temporary| {
        let mut command = std::process::Command::new(qpdf);
        command.arg("--linearize").arg(input_pdf).arg(temporary);
        command
    })
    .is_ok()
}

fn find_tool(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.exists() && candidate.is_file())
}
