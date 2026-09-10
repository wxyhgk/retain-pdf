import { resolveLiveDurations } from "./durations.js";
import type { JobDurationOptions, JobLike, JobPayload } from "./types.js";

export function buildElapsedViewModel(
  snapshot: JobLike | JobPayload | null | undefined,
  {
    finishedAtFallback = "",
    now = null,
  }: JobDurationOptions = {},
) {
  if (!snapshot) {
    return {
      hasSnapshot: false,
      stageElapsedText: "-",
      totalElapsedText: "-",
    };
  }
  const durations = resolveLiveDurations(snapshot, {
    finishedAtFallback,
    now,
  });
  return {
    hasSnapshot: true,
    stageElapsedText: durations.stageElapsedText,
    totalElapsedText: durations.totalElapsedText,
  };
}
