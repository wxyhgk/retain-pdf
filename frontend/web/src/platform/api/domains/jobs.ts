import { isMockMode } from "@/platform/config/runtime.js";
import { createInFlightDedupe } from "../in-flight-dedupe.js";
import { getMockJobList, getMockJobPayload } from "@/platform/mock/index.js";
import {
  fetchJobList as _fetchJobList,
  fetchJobPayload as _fetchJobPayload,
} from "@retainpdf/api/jobs";
import type { JobDetailView, JobListView } from "@retainpdf/contracts/job-status";

/** fetchJobList 第二个参数（分页 / 筛选项）的类型，取自真实 API 签名。 */
type FetchJobListOptions = NonNullable<Parameters<typeof _fetchJobList>[1]>;

const jobPayloadDedupe = createInFlightDedupe<any>();

// 返回值暂保留 any：后端的 JobDetailView 与前端运行时用的 JobLike / JobPayload 不重叠
// （同上，后端生成类型与前端形状没有对齐层），收紧要先补转换层，单独做。
export const fetchJobPayload = async (jobId: string, options?: { apiPrefix?: string } | string): Promise<any> => {
  let normalizedJobId = jobId;
  let apiPrefix: string | undefined;
  if (typeof jobId === "string" && jobId.startsWith("/") && typeof options === "string" && options != null && !options.startsWith("/")) {
    console.warn("[deprecated] fetchJobPayload(apiPrefix, jobId) is deprecated, use fetchJobPayload(jobId, { apiPrefix })");
    apiPrefix = jobId;
    normalizedJobId = options;
  } else if (typeof options === "string") {
    console.warn("[deprecated] fetchJobPayload(jobId, apiPrefix) string form is deprecated, use fetchJobPayload(jobId, { apiPrefix })");
    apiPrefix = options;
  } else if (options && typeof options === "object") {
    apiPrefix = (options as { apiPrefix?: string }).apiPrefix;
  }
  if (isMockMode()) { void apiPrefix; return getMockJobPayload(normalizedJobId); }
  // 四个所有者（主轮询 / 书架活跃卡 / 任务中心 / 阅读器 session）都经这一个函数
  // 拉 job detail，同一秒里会对同一个 job 各发一次；后端按设计不会合并它们
  // （见 in-flight-dedupe 的说明）。这里只合并恰好在途的那些，不做任何缓存。
  // apiPrefix 进 key：不同前缀是不同资源，不能互相顶替。
  return jobPayloadDedupe.run(
    `${apiPrefix || ""}|${normalizedJobId}`,
    () => _fetchJobPayload(normalizedJobId, apiPrefix ? { apiPrefix } : undefined),
  );
};

export const fetchJobList = async (apiPrefix: string, opts: FetchJobListOptions = {}): Promise<JobListView> => {
  if (isMockMode()) {
    const { limit = 20, offset = 0, q = "" } = opts || {};
    // mock 列表项是 JobLike | LibraryCardItem 混合形状，与真实 JobListView 不同，这里保持原行为只做类型断言。
    return getMockJobList({ limit, offset, q }) as unknown as JobListView;
  }
  return _fetchJobList(apiPrefix, opts);
};
