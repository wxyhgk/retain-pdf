import type { JobLike } from "../../job/types.js";
import {
  shouldReplaceCurrentStageProgress,
  shouldReplaceStageProgress,
} from "./job-stage-progress-replacement.js";
import {
  normalizeProgressRecordFromEventRecord,
} from "../contract/job-stage-progress-record-normalizer.js";
import {
  eventStageForMatchRecord,
  normalizedStageEventRecord,
} from "../job-stage-event-record.js";
import { stageProgressAdapterFor } from "./stage-progress-adapters.js";
import type { EventsPayload, ProgressRecord, StageEvent, StageEventRecord } from "../types.js";

type StageProgressContext = {
  latest: ProgressRecord | null;
  latestSameSubstage: ProgressRecord | null;
  requestedSubstageKey: string;
  mode: string;
  bySubstage?: Record<string, ProgressRecord | null | undefined>;
  renderRecords?: {
    prepare?: ProgressRecord | null;
    prewarm?: ProgressRecord | null;
    pages?: ProgressRecord | null;
    compile?: ProgressRecord | null;
  };
};

function recordStageForProgress(record: Partial<StageEventRecord>): string {
  return eventStageForMatchRecord(record);
}

export function collectLatestCurrentStageProgress(
  job: JobLike,
  eventsPayload: EventsPayload,
  stageKey = "",
  substageKey = "",
): ProgressRecord | null {
  const items: StageEvent[] = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const stageContext: StageProgressContext = {
    latest: null,
    latestSameSubstage: null,
    requestedSubstageKey: substageKey,
    mode: "current",
  };
  const adapter = stageProgressAdapterFor(stageKey);
  for (const item of items) {
    const record = normalizedStageEventRecord(item);
    if (!record.isMainLane) {
      continue;
    }
    const itemStage = recordStageForProgress(record);
    if (!itemStage) {
      continue;
    }
    const next = normalizeProgressRecordFromEventRecord(job, record, itemStage);
    if (!next || next.stageKey !== stageKey) {
      continue;
    }
    adapter.record(stageContext, next, {
      shouldReplaceCurrentStageProgress,
      shouldReplaceStageProgress,
    });
  }
  return adapter.current(stageContext);
}

export function collectStageProgressByKey(
  job: JobLike,
  eventsPayload: EventsPayload,
): Record<string, ProgressRecord> {
  const items: StageEvent[] = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const contextsByKey: Record<string, StageProgressContext> = {};
  for (const item of items) {
    const record = normalizedStageEventRecord(item);
    if (!record.isMainLane) {
      continue;
    }
    const itemStage = recordStageForProgress(record);
    if (!itemStage) {
      continue;
    }
    const nextProgress = normalizeProgressRecordFromEventRecord(job, record, itemStage);
    if (!nextProgress) {
      continue;
    }
    const { stageKey } = nextProgress;
    const context = contextsByKey[stageKey] || {
      latest: null,
      latestSameSubstage: null,
      requestedSubstageKey: "",
      mode: "summary",
    };
    stageProgressAdapterFor(stageKey).record(context, nextProgress, {
      shouldReplaceCurrentStageProgress,
      shouldReplaceStageProgress,
    });
    contextsByKey[stageKey] = context;
  }
  const progressByKey: Record<string, ProgressRecord> = {};
  Object.entries(contextsByKey).forEach(([stageKey, context]) => {
    const progress = stageProgressAdapterFor(stageKey).final(context);
    if (progress) {
      progressByKey[stageKey] = progress;
    }
  });
  return progressByKey;
}
