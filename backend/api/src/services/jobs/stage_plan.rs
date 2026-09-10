use std::path::Path;

use crate::models::api::RetryStageKind;
use crate::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
use crate::services::jobs::translation_request_recovery::load_translation_request_recovery;
use crate::services::runtime_gateway::{
    translation_artifacts_are_ready, translation_checkpoint_candidate_is_ready,
};
use crate::storage_paths::resolve_data_path;

#[derive(Debug, Clone)]
pub(crate) struct JobStagePlan {
    pub stage: RetryStageKind,
    pub label: String,
    pub can_retry: bool,
    pub disabled_reason: String,
    pub will_reuse: Vec<String>,
    pub will_rerun: Vec<String>,
    pub retry_workflow: WorkflowKind,
    pub danger: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct JobResumePlan {
    pub can_resume: bool,
    pub from_stage: Option<String>,
    pub resume_workflow: Option<WorkflowKind>,
    pub reuses_artifacts: Vec<String>,
    pub reruns_stages: Vec<String>,
    pub reason: Option<String>,
}

pub(crate) fn stage_plans(job: &JobSnapshot, data_root: &Path) -> Vec<JobStagePlan> {
    vec![
        stage_plan(job, RetryStageKind::Ocr, data_root),
        stage_plan(job, RetryStageKind::Translation, data_root),
        stage_plan(job, RetryStageKind::Render, data_root),
    ]
}

pub(crate) fn stage_plan(
    job: &JobSnapshot,
    stage: RetryStageKind,
    data_root: &Path,
) -> JobStagePlan {
    let availability = StageArtifactAvailability::from_job(job, data_root);
    let running = matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running);
    let mut plan = base_stage_plan(stage, &availability);

    if job
        .request_payload
        .translation
        .execution_connection
        .is_some()
        && !matches!(plan.stage, RetryStageKind::Render)
    {
        plan.can_retry = false;
        plan.disabled_reason =
            "Rust model retry requires receipt-preserving recovery; legacy retry is disabled"
                .into();
        return plan;
    }

    if running {
        plan.can_retry = false;
        plan.disabled_reason =
            "job is queued or running; cancel it before retrying a stage".to_string();
    } else if !plan.can_retry {
        plan.disabled_reason = disabled_reason_for_stage(&plan.stage, &availability);
    }
    plan
}

pub(crate) fn resume_plan(job: &JobSnapshot, data_root: &Path) -> JobResumePlan {
    if matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return JobResumePlan {
            can_resume: false,
            from_stage: None,
            resume_workflow: None,
            reuses_artifacts: Vec::new(),
            reruns_stages: Vec::new(),
            reason: Some("job is queued or running; cancel it before resuming".to_string()),
        };
    }
    let availability = StageArtifactAvailability::from_job(job, data_root);
    if availability.translations_available {
        return JobResumePlan {
            can_resume: true,
            from_stage: Some("render".to_string()),
            resume_workflow: Some(WorkflowKind::Render),
            reuses_artifacts: vec![
                "source_pdf".to_string(),
                "translations_dir".to_string(),
                "normalized_document_json".to_string(),
            ],
            reruns_stages: vec!["rendering".to_string()],
            reason: None,
        };
    }
    if job
        .request_payload
        .translation
        .execution_connection
        .is_some()
    {
        return JobResumePlan {
            can_resume: false,
            from_stage: Some("translate".into()),
            resume_workflow: None,
            reuses_artifacts: Vec::new(),
            reruns_stages: Vec::new(),
            reason: Some(
                "Rust model recovery requires successful receipt reuse; legacy resume is disabled"
                    .into(),
            ),
        };
    }
    if availability.ocr_available && availability.translation_retry_requires_confirmation {
        return JobResumePlan {
            can_resume: false,
            from_stage: Some("translate".to_string()),
            resume_workflow: Some(WorkflowKind::Book),
            reuses_artifacts: vec![
                "source_pdf".to_string(),
                "normalized_document_json".to_string(),
                "translation_request_journal_jsonl".to_string(),
            ],
            reruns_stages: vec!["translation".to_string(), "rendering".to_string()],
            reason: Some(
                "translation recovery is blocked; consult supported retry policies before retrying"
                    .to_string(),
            ),
        };
    }
    if availability.ocr_available {
        let mut reuses_artifacts = vec![
            "source_pdf".to_string(),
            "normalized_document_json".to_string(),
            "normalization_report_json".to_string(),
        ];
        if availability.translation_checkpoint_available {
            reuses_artifacts.push("translation_checkpoint_json".to_string());
            reuses_artifacts.push("translation_request_journal_jsonl".to_string());
        }
        return JobResumePlan {
            can_resume: true,
            from_stage: Some("translate".to_string()),
            resume_workflow: Some(WorkflowKind::Book),
            reuses_artifacts,
            reruns_stages: vec!["translation".to_string(), "rendering".to_string()],
            reason: None,
        };
    }
    JobResumePlan {
        can_resume: false,
        from_stage: None,
        resume_workflow: None,
        reuses_artifacts: Vec::new(),
        reruns_stages: Vec::new(),
        reason: Some(resume_unavailable_reason(&availability)),
    }
}

pub(crate) fn stage_name(stage: &RetryStageKind) -> &'static str {
    match stage {
        RetryStageKind::Ocr => "ocr",
        RetryStageKind::Translation => "translation",
        RetryStageKind::Render => "render",
    }
}

fn has_request_source(job: &JobSnapshot) -> bool {
    !job.request_payload.source.upload_id.trim().is_empty()
        || !job.request_payload.source.source_url.trim().is_empty()
}

fn base_stage_plan(
    stage: RetryStageKind,
    availability: &StageArtifactAvailability,
) -> JobStagePlan {
    match stage {
        RetryStageKind::Ocr => JobStagePlan {
            stage,
            label: "重试 OCR".to_string(),
            can_retry: availability.source_retryable_from_request,
            disabled_reason: String::new(),
            will_reuse: vec!["source_pdf".to_string()],
            will_rerun: vec![
                "ocr".to_string(),
                "translation".to_string(),
                "render".to_string(),
            ],
            retry_workflow: WorkflowKind::Book,
            danger: true,
        },
        RetryStageKind::Translation => JobStagePlan {
            stage,
            label: "重试翻译".to_string(),
            can_retry: availability.ocr_available,
            disabled_reason: if availability.translation_retry_requires_confirmation {
                "request outcome is ambiguous; retry requires explicit duplicate-risk acceptance"
                    .to_string()
            } else {
                String::new()
            },
            will_reuse: {
                let mut artifacts = vec!["source_pdf".to_string(), "ocr_result".to_string()];
                if availability.translation_request_journal_available {
                    artifacts.push("translation_request_journal_jsonl".to_string());
                }
                artifacts
            },
            will_rerun: vec!["translation".to_string(), "render".to_string()],
            retry_workflow: WorkflowKind::Book,
            danger: availability.translation_retry_requires_confirmation,
        },
        RetryStageKind::Render => JobStagePlan {
            stage,
            label: "重新渲染".to_string(),
            can_retry: availability.translations_available,
            disabled_reason: String::new(),
            will_reuse: vec![
                "source_pdf".to_string(),
                "ocr_result".to_string(),
                "translation_result".to_string(),
            ],
            will_rerun: vec!["render".to_string()],
            retry_workflow: WorkflowKind::Render,
            danger: false,
        },
    }
}

fn disabled_reason_for_stage(
    stage: &RetryStageKind,
    availability: &StageArtifactAvailability,
) -> String {
    match stage {
        RetryStageKind::Ocr if !availability.has_request_source => {
            "OCR retry currently requires the original upload_id or source_url on the job; re-upload the source PDF to start a new task"
                .to_string()
        }
        RetryStageKind::Ocr => "source PDF is not available".to_string(),
        RetryStageKind::Translation => {
            "need source_pdf and normalized_document_json to retry translation".to_string()
        }
        RetryStageKind::Render => {
            "need source_pdf and translations_dir to retry render".to_string()
        }
    }
}

fn resume_unavailable_reason(availability: &StageArtifactAvailability) -> String {
    if !availability.source_available {
        "need source_pdf before resuming a job".to_string()
    } else {
        "need translations_dir+source_pdf or normalized_document_json+source_pdf; re-upload the source PDF to start over".to_string()
    }
}

#[derive(Debug)]
struct StageArtifactAvailability {
    has_request_source: bool,
    source_available: bool,
    source_retryable_from_request: bool,
    ocr_available: bool,
    translation_checkpoint_available: bool,
    translations_available: bool,
    translation_request_journal_available: bool,
    translation_retry_requires_confirmation: bool,
}

impl StageArtifactAvailability {
    fn from_job(job: &JobSnapshot, data_root: &Path) -> Self {
        let artifacts = job.artifacts.as_ref();
        let has_request_source = has_request_source(job);
        let source_artifact_available = artifact_is_file(
            data_root,
            artifacts.and_then(|item| item.source_pdf.as_deref()),
        );
        let source_available = has_request_source || source_artifact_available;
        let normalized_document_available = artifact_is_file(
            data_root,
            artifacts.and_then(|item| item.normalized_document_json.as_deref()),
        );
        let translation_checkpoint_available = artifacts.is_some_and(|item| {
            translation_checkpoint_candidate_is_ready(item, data_root, &job.job_id)
        });
        let translations_available = artifacts
            .is_some_and(|item| translation_artifacts_are_ready(item, data_root, &job.job_id));
        let translation_request_recovery = load_translation_request_recovery(job, data_root);
        let translation_request_journal_available = translation_request_recovery.is_some();
        let translation_retry_requires_confirmation =
            translation_request_recovery.is_some_and(|state| state.requires_confirmation);
        Self {
            has_request_source,
            source_available,
            source_retryable_from_request: source_available && has_request_source,
            ocr_available: source_artifact_available && normalized_document_available,
            translation_checkpoint_available,
            translations_available,
            translation_request_journal_available,
            translation_retry_requires_confirmation,
        }
    }
}

fn artifact_is_file(data_root: &Path, raw: Option<&str>) -> bool {
    raw.filter(|value| !value.trim().is_empty())
        .and_then(|value| resolve_data_path(data_root, value).ok())
        .is_some_and(|path| path.is_file())
}
