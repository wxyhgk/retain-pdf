import { resolveJobDisplayState } from "./job-display-state.js";
import { resolvePinnedStagePresentation } from "./stage-pinning-port.js";

export function resolveRenderStagePresentation({
  state,
  job,
  jobId,
  events,
}: any) {
  const displayState = resolveJobDisplayState(job, events);
  const presentation = resolvePinnedStagePresentation({
    state,
    jobId,
    presentation: displayState.stagePresentation,
  });
  return {
    ...presentation,
    stageProgressByKey: displayState.stageProgressByKey,
    backgroundStages: displayState.backgroundStages,
  };
}
