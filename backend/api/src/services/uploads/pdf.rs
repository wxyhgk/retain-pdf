use super::UploadError;
use lopdf::Document;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const REPAIR_TIMEOUT: Duration = Duration::from_secs(60);

pub(super) fn load_pdf_page_count(path: &Path) -> Result<u32, lopdf::Error> {
    Document::load(path).map(|doc| doc.get_pages().len() as u32)
}

pub(super) fn repair_pdf_with_pymupdf(path: &Path, python_bin: &str) -> Result<(), UploadError> {
    let repaired_path = path.with_extension("repairing.pdf");
    let script = r#"
import pathlib
import sys

import fitz

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
doc = fitz.open(source)
doc.save(target, garbage=4, deflate=True)
doc.close()
"#;
    let mut command = Command::new(python_bin);
    command.arg("-c").arg(script).arg(path).arg(&repaired_path);
    run_repair_command(&mut command, REPAIR_TIMEOUT)?;
    std::fs::rename(&repaired_path, path)
        .map_err(|_| UploadError::internal("Failed to install repaired PDF"))
}

pub(super) fn run_repair_command(
    command: &mut Command,
    timeout: Duration,
) -> Result<(), UploadError> {
    // Neither buffer unbounded output nor expose Python stderr/paths to clients.
    let child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| UploadError::RepairUnavailable)?;
    struct RepairChild(std::process::Child);
    impl Drop for RepairChild {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
    let mut child = RepairChild(child);
    let started = Instant::now();
    loop {
        if let Some(status) = child
            .0
            .try_wait()
            .map_err(|_| UploadError::internal("PDF repair process failed"))?
        {
            return if status.success() {
                Ok(())
            } else {
                Err(UploadError::bad_request("invalid PDF: repair failed"))
            };
        }
        if started.elapsed() >= timeout {
            return Err(UploadError::RepairTimeout);
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}
