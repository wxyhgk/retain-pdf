import type { JobListItemView, JobListView } from "@retainpdf/contracts/job-status";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  cancelJob,
  cancelOcrJob,
  fetchJobList,
  fetchJobPayload,
  rerunJob,
} from "@/platform/api/index.js";
import { resolveJobActions } from "@retainpdf/domain/job";

export const TASK_CENTER_PAGE_LIMIT = 500;
export const TASK_CENTER_MAX_ITEMS = 2000;

export type TaskCenterLoadResult = {
  items: JobListItemView[];
  reachedLimit: boolean;
};

export type TaskCenterApiDependencies = {
  fetchList: typeof fetchJobList;
  fetchDetail: typeof fetchJobPayload;
  cancelTranslation: typeof cancelJob;
  cancelOcr: typeof cancelOcrJob;
  rerun: typeof rerunJob;
  resolveActions: typeof resolveJobActions;
};

const DEFAULT_DEPENDENCIES: TaskCenterApiDependencies = {
  fetchList: fetchJobList,
  fetchDetail: fetchJobPayload,
  cancelTranslation: cancelJob,
  cancelOcr: cancelOcrJob,
  rerun: rerunJob,
  resolveActions: resolveJobActions,
};

export async function loadTaskCenterJobs(
  dependencies: Pick<TaskCenterApiDependencies, "fetchList"> = DEFAULT_DEPENDENCIES,
): Promise<TaskCenterLoadResult> {
  const items: JobListItemView[] = [];
  const seen = new Set<string>();
  let reachedLimit = false;
  for (let offset = 0; offset < TASK_CENTER_MAX_ITEMS; offset += TASK_CENTER_PAGE_LIMIT) {
    const page = await dependencies.fetchList(API_PREFIX, {
      limit: TASK_CENTER_PAGE_LIMIT,
      offset,
    }) as JobListView;
    const pageItems = Array.isArray(page?.items) ? page.items : [];
    for (const item of pageItems) {
      const jobId = `${item?.job_id || ""}`.trim();
      if (jobId && !seen.has(jobId)) {
        seen.add(jobId);
        items.push(item);
      }
    }
    if (pageItems.length < TASK_CENTER_PAGE_LIMIT) break;
    if (offset + TASK_CENTER_PAGE_LIMIT >= TASK_CENTER_MAX_ITEMS) reachedLimit = true;
  }
  return { items, reachedLimit };
}

export async function cancelTaskCenterJob(
  job: Pick<JobListItemView, "job_id" | "workflow">,
  dependencies: Pick<TaskCenterApiDependencies, "cancelTranslation" | "cancelOcr"> = DEFAULT_DEPENDENCIES,
): Promise<unknown> {
  const jobId = `${job?.job_id || ""}`.trim();
  if (!jobId) throw new Error("任务缺少 job_id，无法取消。");
  return `${job.workflow || ""}`.trim().toLowerCase() === "ocr"
    ? dependencies.cancelOcr(jobId, API_PREFIX)
    : dependencies.cancelTranslation(jobId, API_PREFIX);
}

export async function retryTaskCenterJob(
  jobId: string,
  dependencies: Pick<TaskCenterApiDependencies, "fetchDetail" | "rerun" | "resolveActions"> = DEFAULT_DEPENDENCIES,
): Promise<unknown> {
  const normalizedJobId = `${jobId || ""}`.trim();
  if (!normalizedJobId) throw new Error("任务缺少 job_id，无法重试。");
  const detail = await dependencies.fetchDetail(normalizedJobId, { apiPrefix: API_PREFIX });
  const actions = dependencies.resolveActions(detail || {});
  const actionUrl = `${actions?.rerun || ""}`.trim();
  if (!actions?.rerunEnabled || !actionUrl) {
    throw new Error("后端未提供可用的重试操作，请打开详情查看恢复建议。");
  }
  return dependencies.rerun(actionUrl);
}
