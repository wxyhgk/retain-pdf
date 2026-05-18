#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum PipelineStage {
    Ocr,
    Translate,
    Render,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct PipelinePlan {
    stages: Vec<PipelineStage>,
}

impl PipelinePlan {
    pub(super) fn book_with_ocr() -> Self {
        Self {
            stages: vec![
                PipelineStage::Ocr,
                PipelineStage::Translate,
                PipelineStage::Render,
            ],
        }
    }

    pub(super) fn translate_with_ocr() -> Self {
        Self {
            stages: vec![PipelineStage::Ocr, PipelineStage::Translate],
        }
    }

    pub(super) fn next_after(&self, stage: PipelineStage) -> Option<PipelineStage> {
        let index = self.stages.iter().position(|item| *item == stage)?;
        self.stages.get(index + 1).copied()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pipeline_plan_exposes_next_stage() {
        assert_eq!(
            PipelinePlan::book_with_ocr().next_after(PipelineStage::Translate),
            Some(PipelineStage::Render)
        );
        assert_eq!(
            PipelinePlan::translate_with_ocr().next_after(PipelineStage::Translate),
            None
        );
    }
}
