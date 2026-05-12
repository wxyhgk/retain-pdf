#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JobStage {
    Queued,
    Running,
    OcrSubmitting,
    OcrUpload,
    MineruUpload,
    OcrProcessing,
    MineruProcessing,
    OcrResultReady,
    Normalizing,
    Translating,
    Rendering,
    Finished,
    Canceled,
    Failed,
}

impl JobStage {
    pub fn as_str(self) -> &'static str {
        match self {
            JobStage::Queued => "queued",
            JobStage::Running => "running",
            JobStage::OcrSubmitting => "ocr_submitting",
            JobStage::OcrUpload => "ocr_upload",
            JobStage::MineruUpload => "mineru_upload",
            JobStage::OcrProcessing => "ocr_processing",
            JobStage::MineruProcessing => "mineru_processing",
            JobStage::OcrResultReady => "ocr_result_ready",
            JobStage::Normalizing => "normalizing",
            JobStage::Translating => "translating",
            JobStage::Rendering => "rendering",
            JobStage::Finished => "finished",
            JobStage::Canceled => "canceled",
            JobStage::Failed => "failed",
        }
    }

    pub fn as_stage_detail(self) -> &'static str {
        match self {
            JobStage::Queued => "任务已创建，等待可用执行槽位",
            JobStage::Running => "正在启动 Python worker",
            JobStage::OcrSubmitting => "正在提交 OCR 任务",
            JobStage::OcrUpload => "OCR 任务上传中",
            JobStage::MineruUpload => "MinerU 任务上传中",
            JobStage::OcrProcessing => "OCR 任务处理中",
            JobStage::MineruProcessing => "MinerU 任务处理中",
            JobStage::OcrResultReady => "OCR 结果已就绪",
            JobStage::Normalizing => "OCR 完成，开始标准化",
            JobStage::Translating => "OCR 完成，开始翻译",
            JobStage::Rendering => "翻译完成，开始渲染",
            JobStage::Finished => "任务完成",
            JobStage::Canceled => "任务已取消",
            JobStage::Failed => "任务失败",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value.trim() {
            "queued" => Some(JobStage::Queued),
            "running" => Some(JobStage::Running),
            "ocr_submitting" => Some(JobStage::OcrSubmitting),
            "ocr_upload" => Some(JobStage::OcrUpload),
            "mineru_upload" => Some(JobStage::MineruUpload),
            "ocr_processing" => Some(JobStage::OcrProcessing),
            "mineru_processing" => Some(JobStage::MineruProcessing),
            "ocr_result_ready" => Some(JobStage::OcrResultReady),
            "normalizing" => Some(JobStage::Normalizing),
            "translating" => Some(JobStage::Translating),
            "rendering" => Some(JobStage::Rendering),
            "finished" => Some(JobStage::Finished),
            "canceled" => Some(JobStage::Canceled),
            "failed" => Some(JobStage::Failed),
            _ => None,
        }
    }

    pub fn is_terminal(self) -> bool {
        matches!(self, JobStage::Finished | JobStage::Canceled | JobStage::Failed)
    }
}

pub fn normalize_job_stage(value: Option<&str>) -> Option<JobStage> {
    value.and_then(JobStage::from_str)
}

pub fn job_stage_str(stage: JobStage) -> &'static str {
    stage.as_str()
}

pub fn job_stage_detail(stage: JobStage) -> &'static str {
    stage.as_stage_detail()
}
