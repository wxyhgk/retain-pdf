export async function hydrateCreatedRecentJob({
  job,
  apiPrefix,
  fetchJobPayload,
  runtimePatches,
}: {
  job?: { job_id?: string | null } | null;
  apiPrefix?: string;
  fetchJobPayload?: (jobId: string, options: { apiPrefix?: string }) => Promise<unknown>;
  runtimePatches?: { update?: (payload: unknown) => void } | null;
} = {}) {
  const jobId = `${job?.job_id || ""}`.trim();
  if (!jobId || typeof fetchJobPayload !== "function") {
    return null;
  }
  try {
    const payload = await fetchJobPayload(jobId, { apiPrefix });
    runtimePatches?.update?.(payload);
    return payload;
  } catch {
    return null;
  }
}
