// POST /jobs/:id/resume 的回执 → 交给 onJobSubmitted 的任务摘要。
// 续跑从渲染开始时后端原地沿用同一个 job_id，其余情况新建任务；两种都要让书籍详情
// 立刻跟上新任务（source_job_id 记下从哪个任务续出来的）。
// 失败卡片的「从断点继续」和「重新处理」清单里的阶段按钮共用这一份映射。

import type { DocumentJobSummary } from "@/features/library/domain.js";

export type ResumeReceipt = { job_id?: string; id?: string; document_id?: string; workflow?: string };

export function submittedJobFromResume(
  resume: ResumeReceipt | null,
  job: DocumentJobSummary | null | undefined,
  { fallbackWorkflow = "book" }: { fallbackWorkflow?: string } = {},
): Partial<DocumentJobSummary> {
  const jobId = `${job?.job_id || job?.id || ""}`.trim();
  const resumedId = `${resume?.job_id || resume?.id || ""}`.trim();
  const nextId = resumedId || jobId;
  return {
    ...resume,
    job_id: nextId,
    active_job_id: nextId,
    source_job_id: jobId,
    document_id: resume?.document_id || job?.document_id,
    workflow: resume?.workflow
      || (nextId === jobId ? job?.workflow : undefined)
      || fallbackWorkflow,
    library_only: false,
  };
}
