use crate::config::WorkerCommandRuntimeConfig;
use std::path::Path;

use super::command_builder::CommandBuilder;

#[cfg(test)]
pub(super) fn provider_case_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    spec_path: &Path,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(config.python_bin, config.run_provider_case_script, true);
    cmd.path_arg("--spec", spec_path);
    cmd.finish()
}

pub(super) fn provider_ocr_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    upload_path: Option<&Path>,
    file_url: &str,
    push_ocr_args: impl FnOnce(&mut CommandBuilder),
    push_job_path_args: impl FnOnce(&mut CommandBuilder),
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(config.python_bin, config.run_provider_ocr_script, true);
    if let Some(upload_path) = upload_path {
        cmd.path_arg("--file-path", upload_path);
    } else {
        cmd.arg("--file-url", file_url);
    }
    push_ocr_args(&mut cmd);
    push_job_path_args(&mut cmd);
    cmd.finish()
}

pub(super) fn translate_only_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    spec_path: &Path,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(config.python_bin, config.run_translate_only_script, true);
    cmd.path_arg("--spec", spec_path);
    cmd.finish()
}

pub(super) fn render_only_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    spec_path: &Path,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(config.python_bin, config.run_render_only_script, true);
    cmd.path_arg("--spec", spec_path);
    cmd.finish()
}

pub(super) fn normalize_ocr_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    spec_path: &Path,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(config.python_bin, config.run_normalize_ocr_script, false);
    cmd.path_arg("--spec", spec_path);
    cmd.finish()
}
