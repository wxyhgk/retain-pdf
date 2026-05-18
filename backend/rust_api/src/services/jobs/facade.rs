mod command;
mod query;

use crate::models::{JobSnapshot, JobStatusKind, JobSubmissionView, WorkflowKind};

use super::creation::context::{CommandJobsDeps, QueryJobsDeps};
use super::support::build_submission_view;

#[derive(Clone)]
pub struct JobsFacade<'a> {
    pub(super) command: CommandJobsDeps<'a>,
    pub(super) query: QueryJobsDeps<'a>,
}

impl<'a> JobsFacade<'a> {
    pub(crate) fn new(command: CommandJobsDeps<'a>, query: QueryJobsDeps<'a>) -> Self {
        Self { command, query }
    }

    fn build_submission_view(
        &self,
        base_url: &str,
        job: &JobSnapshot,
        status: JobStatusKind,
        workflow: WorkflowKind,
    ) -> JobSubmissionView {
        build_submission_view(job, status, workflow, base_url)
    }
}

pub(crate) fn build_jobs_facade<'a>(
    command: CommandJobsDeps<'a>,
    query: QueryJobsDeps<'a>,
) -> JobsFacade<'a> {
    JobsFacade::new(command, query)
}
