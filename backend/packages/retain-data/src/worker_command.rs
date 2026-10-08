#[path = "worker_command/command_builder.rs"]
mod command_builder;
#[path = "worker_command/entrypoints.rs"]
mod entrypoints;
#[path = "worker_command/legacy_ocr.rs"]
mod legacy_ocr;
#[path = "worker_command/refine_override.rs"]
pub mod refine_override;
#[path = "worker_command/stage_commands.rs"]
mod stage_commands;
#[path = "worker_command/stage_specs.rs"]
pub(crate) mod stage_specs;

#[cfg(test)]
use crate::config::WorkerCommandRuntimeConfig;
#[cfg(test)]
use crate::models::domain::ResolvedJobSpec;
#[cfg(test)]
use crate::storage_paths::JobPaths;
#[cfg(test)]
use std::path::Path;

pub use self::legacy_ocr::build_ocr_command;
pub use self::stage_commands::{build_worker_stage_command, RenderRefine, WorkerStageCommand};

#[cfg(test)]
fn build_legacy_provider_case_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    upload_path: &Path,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
) -> Vec<String> {
    use self::entrypoints::provider_case_command as build_provider_case_entrypoint;
    use self::stage_specs::write_provider_stage_spec;

    let spec_path = write_provider_stage_spec(request, job_paths, Some(upload_path))
        .expect("write provider stage spec");
    build_provider_case_entrypoint(config, &spec_path)
}

#[cfg(test)]
mod tests;
