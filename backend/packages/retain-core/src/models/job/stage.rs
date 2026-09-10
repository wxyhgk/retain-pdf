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
        matches!(
            self,
            JobStage::Finished | JobStage::Canceled | JobStage::Failed
        )
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

pub fn job_user_stage(stage: Option<&str>) -> Option<&'static str> {
    public_stage_for_raw_stage(stage)
}

pub fn normalize_event_user_stage(value: &str) -> Option<&'static str> {
    match value.trim() {
        "ocr" => Some("ocr"),
        "translate" | "translation" => Some("translation"),
        "render" => Some("render"),
        "done" => None,
        _ => None,
    }
}

pub fn normalize_event_substage(value: &str) -> String {
    match value.trim() {
        "translating" => "translation_batches".to_string(),
        "rendering" => "render_pages".to_string(),
        "compile" => "render_compile".to_string(),
        "overlay" | "saving" => "render_pages".to_string(),
        "provider_processing" => "ocr_processing".to_string(),
        other => other.to_string(),
    }
}

pub fn public_stage_for_substage(substage: Option<&str>) -> Option<&'static str> {
    match substage.map(str::trim).unwrap_or_default() {
        "ocr_submitting" | "ocr_upload" | "mineru_upload" | "ocr_processing"
        | "mineru_processing" | "ocr_result_ready" | "normalizing" => Some("ocr"),
        "translation_prepare"
        | "translation_batches"
        | "continuation_review"
        | "page_policies"
        | "domain_inference"
        | "garbled_repair"
        | "agent_repair"
        | "final_untranslated_recovery" => Some("translation"),
        "render_prepare" | "render_preprocess" | "render_prewarm" | "render_pages"
        | "render_compile" => Some("render"),
        "finished" | "done" | "succeeded" => None,
        _ => None,
    }
}

pub fn public_stage_for_raw_stage(stage: Option<&str>) -> Option<&'static str> {
    match stage.map(str::trim).unwrap_or_default() {
        "queued" | "running" => None,
        "ocr_submitting" | "ocr_upload" | "mineru_upload" | "ocr_processing"
        | "mineru_processing" | "ocr_result_ready" | "normalizing" => Some("ocr"),
        "translation_prepare"
        | "translating"
        | "translation_batches"
        | "continuation_review"
        | "page_policies"
        | "domain_inference"
        | "garbled_repair"
        | "agent_repair"
        | "final_untranslated_recovery" => Some("translation"),
        "render_prepare" | "render_preprocess" | "rendering" | "compile" | "overlay" | "saving" => {
            Some("render")
        }
        "finished" | "done" | "succeeded" => None,
        "failed" | "canceled" => None,
        _ => None,
    }
}

pub fn job_progress_unit(stage: Option<&str>, event: &str) -> &'static str {
    event_progress_unit(stage, event)
}

pub fn event_progress_unit(stage_or_substage: Option<&str>, event: &str) -> &'static str {
    match stage_or_substage.map(str::trim).unwrap_or_default() {
        "translating" | "translation_batches" => "batch",
        "ocr_processing"
        | "mineru_processing"
        | "continuation_review"
        | "page_policies"
        | "domain_inference"
        | "garbled_repair"
        | "agent_repair"
        | "final_untranslated_recovery"
        | "rendering" => "page",
        "ocr_submitting"
        | "ocr_upload"
        | "mineru_upload"
        | "ocr_result_ready"
        | "normalizing"
        | "compile"
        | "overlay"
        | "saving"
        | "render_prepare"
        | "render_preprocess"
        | "render_prewarm"
        | "render_compile"
        | "translation_prepare" => "step",
        _ if event == "stage_progress" => "step",
        _ => "none",
    }
}

pub fn job_stage_rank(stage: Option<&str>) -> i32 {
    match stage.and_then(JobStage::from_str) {
        Some(JobStage::Queued | JobStage::Running | JobStage::Canceled | JobStage::Failed) => 0,
        Some(
            JobStage::OcrSubmitting
            | JobStage::OcrUpload
            | JobStage::MineruUpload
            | JobStage::OcrProcessing
            | JobStage::MineruProcessing
            | JobStage::OcrResultReady
            | JobStage::Normalizing,
        ) => 1,
        Some(JobStage::Translating) => 2,
        Some(JobStage::Rendering | JobStage::Finished) => 3,
        None => match job_user_stage(stage) {
            Some("ocr") => 1,
            Some("translation") => 2,
            Some("render") => 3,
            _ => 0,
        },
    }
}
