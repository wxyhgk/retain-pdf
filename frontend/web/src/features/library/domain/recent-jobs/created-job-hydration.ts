export async function hydrateCreatedRecentJob({
  job,
  apiPrefix,
  fetchJobPayload,
  runtimePatches,
}: any = {}) {
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
