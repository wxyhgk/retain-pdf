import type { LibraryJobItem } from "./state.js";

export async function hydrateCreatedRecentJob({
  job,
  apiPrefix,
  fetchJobPayload,
  runtimePatches,
}: {
  job?: { job_id?: string | null } | null;
  apiPrefix?: string;
  fetchJobPayload?: (jobId: string, options: { apiPrefix?: string }) => Promise<unknown>;
  runtimePatches?: { update?: (payload: LibraryJobItem) => void } | null;
} = {}) {
  const jobId = `${job?.job_id || ""}`.trim();
  if (!jobId || typeof fetchJobPayload !== "function") {
    return null;
  }
  try {
    const payload = await fetchJobPayload(jobId, { apiPrefix });
    // 任务载荷按卡片形状合并；update 对缺 job_id 的值直接忽略，所以不必先校验形状。
    runtimePatches?.update?.(payload as LibraryJobItem);
    return payload;
  } catch {
    return null;
  }
}
