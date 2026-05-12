use std::ops::{Deref, DerefMut};

use serde::{Deserialize, Serialize};

use crate::models::{
    job_stage_detail, job_stage_str, now_iso, JobArtifacts, JobFailureInfo, JobRuntimeInfo,
    JobStage, JobStatusKind, ProcessResult, ResolvedJobSpec, WorkflowKind,
};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobRecord {
    pub job_id: String,
    pub workflow: WorkflowKind,
    pub status: JobStatusKind,
    pub created_at: String,
    pub updated_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub upload_id: Option<String>,
    pub pid: Option<u32>,
    pub command: Vec<String>,
    pub request_payload: ResolvedJobSpec,
    pub error: Option<String>,
    pub stage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress_current: Option<i64>,
    pub progress_total: Option<i64>,
    pub log_tail: Vec<String>,
    pub result: Option<ProcessResult>,
    pub runtime: Option<JobRuntimeInfo>,
    pub failure: Option<JobFailureInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobSnapshot {
    pub record: JobRecord,
    pub artifacts: Option<JobArtifacts>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobRuntimeState {
    pub record: JobRecord,
    pub artifacts: Option<JobArtifacts>,
}

impl Deref for JobSnapshot {
    type Target = JobRecord;
    fn deref(&self) -> &Self::Target {
        &self.record
    }
}

impl DerefMut for JobSnapshot {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.record
    }
}

impl Deref for JobRuntimeState {
    type Target = JobRecord;
    fn deref(&self) -> &Self::Target {
        &self.record
    }
}

impl DerefMut for JobRuntimeState {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.record
    }
}

impl JobSnapshot {
    pub fn new<T: Into<ResolvedJobSpec>>(
        job_id: String,
        request_payload: T,
        command: Vec<String>,
    ) -> Self {
        let request_payload: ResolvedJobSpec = request_payload.into();
        let now = now_iso();
        Self {
            record: JobRecord {
                job_id,
                workflow: request_payload.workflow.clone(),
                status: JobStatusKind::Queued,
                created_at: now.clone(),
                updated_at: now,
                started_at: None,
                finished_at: None,
                upload_id: Some(request_payload.source.upload_id.clone()),
                pid: None,
                command,
                request_payload,
                error: None,
                stage: Some(job_stage_str(JobStage::Queued).to_string()),
                stage_detail: Some(job_stage_detail(JobStage::Queued).to_string()),
                progress_current: Some(0),
                progress_total: None,
                log_tail: Vec::new(),
                result: None,
                runtime: None,
                failure: None,
            },
            artifacts: Some(JobArtifacts::default()),
        }
        .with_synced_runtime()
    }

    pub fn into_runtime(self) -> JobRuntimeState {
        JobRuntimeState {
            record: self.record,
            artifacts: self.artifacts,
        }
    }
}

impl JobRuntimeState {
    pub fn snapshot(&self) -> JobSnapshot {
        JobSnapshot {
            record: self.record.clone(),
            artifacts: self.artifacts.clone(),
        }
    }

    pub fn into_snapshot(self) -> JobSnapshot {
        JobSnapshot {
            record: self.record,
            artifacts: self.artifacts,
        }
    }
}
