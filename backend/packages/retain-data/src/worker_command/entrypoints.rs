use crate::config::WorkerCommandRuntimeConfig;
use std::path::Path;

// Stage workers are independent OS processes: `python -m retainpdf_pipeline.<stage>`.

use super::command_builder::CommandBuilder;

#[cfg(test)]
pub(super) fn provider_case_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    spec_path: &Path,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(config.python_bin, "retainpdf_pipeline.ocr", Some("provider-case"));
    cmd.path_arg("--spec", spec_path);
    cmd.finish()
}

pub(super) fn provider_ocr_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    spec_path: &Path,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(config.python_bin, "retainpdf_pipeline.ocr", Some("provider-ocr"));
    cmd.path_arg("--spec", spec_path);
    cmd.finish()
}

pub(super) fn translate_only_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    spec_path: &Path,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(config.python_bin, "retainpdf_pipeline.translate", None);
    cmd.path_arg("--spec", spec_path);
    cmd.finish()
}

pub(super) fn render_only_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    spec_path: &Path,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(config.python_bin, "retainpdf_pipeline.render", None);
    cmd.path_arg("--spec", spec_path);
    cmd.finish()
}

pub(super) fn normalize_ocr_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    spec_path: &Path,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(config.python_bin, "retainpdf_pipeline.ocr", Some("normalize-ocr"));
    cmd.path_arg("--spec", spec_path);
    cmd.finish()
}
