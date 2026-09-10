export function summarizeRecentJobsInvocationCounts(items) {
  let stageSpecCount = 0;
  let unknownCount = 0;
  for (const item of Array.isArray(items) ? items : []) {
    const protocol = `${item?.invocation?.input_protocol || ""}`.trim();
    if (protocol === "stage_spec") {
      stageSpecCount += 1;
    } else {
      unknownCount += 1;
    }
  }
  return { stageSpecCount, unknownCount };
}

export function buildRecentJobsSummaryViewModel(invocationSummary, items) {
  const stageSpecCountValue = Number(invocationSummary?.stage_spec_count);
  const unknownCountValue = Number(invocationSummary?.unknown_count);
  const counts = Number.isFinite(stageSpecCountValue) && Number.isFinite(unknownCountValue)
    ? { stageSpecCount: stageSpecCountValue, unknownCount: unknownCountValue }
    : summarizeRecentJobsInvocationCounts(items);
  return {
    ...counts,
    text: `Stage Spec ${counts.stageSpecCount} · Unknown ${counts.unknownCount}`,
  };
}
