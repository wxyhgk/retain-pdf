// 卡片上的 invocation 是后端透传的扩展字段（经 index signature，类型是 unknown）。
type InvocationItem = { invocation?: unknown; [key: string]: unknown };

export function summarizeRecentJobsInvocationCounts(items: readonly InvocationItem[] | null | undefined) {
  let stageSpecCount = 0;
  let unknownCount = 0;
  for (const item of Array.isArray(items) ? items : []) {
    const invocation = item?.invocation as { input_protocol?: unknown } | null | undefined;
    const protocol = `${invocation?.input_protocol || ""}`.trim();
    if (protocol === "stage_spec") {
      stageSpecCount += 1;
    } else {
      unknownCount += 1;
    }
  }
  return { stageSpecCount, unknownCount };
}

export function buildRecentJobsSummaryViewModel(
  invocationSummary: { stage_spec_count?: unknown; unknown_count?: unknown } | null | undefined,
  items: readonly InvocationItem[] | null | undefined,
) {
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
