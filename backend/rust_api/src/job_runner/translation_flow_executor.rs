use std::path::Path;

use anyhow::{anyhow, Result};

use crate::models::JobRuntimeState;
use crate::storage_paths::JobPaths;

use super::super::pipeline_plan::{PipelinePlan, PipelineStage};
use super::translation_flow_stage::run_render_stage_after_translation;
use super::ProcessRuntimeDeps;

pub(super) async fn run_after_translation_stage(
    deps: ProcessRuntimeDeps,
    plan: &PipelinePlan,
    translated_job: JobRuntimeState,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
) -> Result<JobRuntimeState> {
    match plan.next_after(PipelineStage::Translate) {
        Some(PipelineStage::Render) => {
            run_render_stage_after_translation(deps, translated_job, job_paths, source_pdf_path)
                .await
        }
        Some(next_stage) => Err(anyhow!(
            "unsupported pipeline stage after translation: {next_stage:?}"
        )),
        None => Ok(translated_job),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn translate_only_plan_has_no_stage_after_translation() {
        assert_eq!(
            PipelinePlan::translate_with_ocr().next_after(PipelineStage::Translate),
            None
        );
    }

    #[test]
    fn book_plan_runs_render_after_translation() {
        assert_eq!(
            PipelinePlan::book_with_ocr().next_after(PipelineStage::Translate),
            Some(PipelineStage::Render)
        );
    }
}
