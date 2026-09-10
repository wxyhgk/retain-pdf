import {
  compareProgressEventOrder,
} from "../presentation/job-stage-presentation-utils.js";
import { compositeOcrProgressFromRecord } from "./job-stage-ocr-progress.js";
import {
  compositeRenderCompileProgress,
  compositeRenderPageProgress,
  compositeRenderPrepareProgress,
  compositeRenderPrewarmProgress,
  compositeRenderProgressFromRecords,
} from "./job-stage-render-progress.js";
import { compositeTranslationProgressFromRecord } from "./job-stage-translation-progress.js";
import type { ProgressRecord } from "../types.js";

type ProgressReplaceFn = (
  previous: ProgressRecord | null | undefined,
  next: ProgressRecord | null | undefined,
) => boolean;

type StageProgressRecordOptions = {
  shouldReplaceCurrentStageProgress?: ProgressReplaceFn;
  shouldReplaceStageProgress?: ProgressReplaceFn;
};

type StageProgressContext = {
  mode?: string;
  latest?: ProgressRecord | null;
  latestSameSubstage?: ProgressRecord | null;
  requestedSubstageKey?: string;
  bySubstage?: Record<string, ProgressRecord | null | undefined>;
  renderRecords?: {
    prepare?: ProgressRecord | null;
    prewarm?: ProgressRecord | null;
    pages?: ProgressRecord | null;
    compile?: ProgressRecord | null;
  };
  [key: string]: unknown;
};

function baseAdapter() {
  return {
    record(
      stageContext: StageProgressContext,
      nextProgress: ProgressRecord,
      {
        shouldReplaceCurrentStageProgress,
        shouldReplaceStageProgress,
      }: StageProgressRecordOptions = {},
    ) {
      const replaceLatest = stageContext.mode === "current"
        ? shouldReplaceCurrentStageProgress
        : shouldReplaceStageProgress || shouldReplaceCurrentStageProgress;
      if (replaceLatest?.(stageContext.latest, nextProgress)) {
        stageContext.latest = nextProgress;
      }
      if (
        stageContext.requestedSubstageKey
        && nextProgress.substageKey === stageContext.requestedSubstageKey
        && shouldReplaceCurrentStageProgress?.(stageContext.latestSameSubstage, nextProgress)
      ) {
        stageContext.latestSameSubstage = nextProgress;
      }
    },
    current(stageContext: StageProgressContext) {
      return stageContext.latestSameSubstage || stageContext.latest || null;
    },
    final(stageContext: StageProgressContext) {
      return stageContext.latest || null;
    },
  };
}

const defaultStageProgressAdapter = baseAdapter();

const ocrStageProgressAdapter = {
  ...baseAdapter(),
  record(
    stageContext: StageProgressContext,
    nextProgress: ProgressRecord,
    options: StageProgressRecordOptions = {},
  ) {
    defaultStageProgressAdapter.record(stageContext, nextProgress, options);
    if (!nextProgress.substageKey) {
      return;
    }
    const bySubstage = stageContext.bySubstage || {};
    if (compareProgressEventOrder(bySubstage[nextProgress.substageKey], nextProgress) > 0) {
      bySubstage[nextProgress.substageKey] = nextProgress;
    }
    stageContext.bySubstage = bySubstage;
  },
  current(stageContext: StageProgressContext) {
    return compositeOcrProgressFromRecord(stageContext.latestSameSubstage || stageContext.latest || null);
  },
  final(stageContext: StageProgressContext) {
    const preferredProgress = stageContext.latest || null;
    const bySubstage = stageContext.bySubstage || {};
    const normalizedBySubstage = Object.fromEntries(
      Object.entries(bySubstage).map(([substageKey, record]) => [
        substageKey,
        compositeOcrProgressFromRecord(record),
      ]),
    );
    if (!preferredProgress && Object.keys(normalizedBySubstage).length === 0) {
      return null;
    }
    return {
      ...compositeOcrProgressFromRecord(preferredProgress),
      bySubstage: normalizedBySubstage,
    };
  },
};

const translationStageProgressAdapter = {
  ...baseAdapter(),
  record(
    stageContext: StageProgressContext,
    nextProgress: ProgressRecord,
    options: StageProgressRecordOptions = {},
  ) {
    defaultStageProgressAdapter.record(stageContext, nextProgress, options);
    if (!nextProgress.substageKey) {
      return;
    }
    const bySubstage = stageContext.bySubstage || {};
    if (compareProgressEventOrder(bySubstage[nextProgress.substageKey], nextProgress) > 0) {
      bySubstage[nextProgress.substageKey] = nextProgress;
    }
    stageContext.bySubstage = bySubstage;
  },
  current(stageContext: StageProgressContext) {
    return compositeTranslationProgressFromRecord(stageContext.latestSameSubstage || stageContext.latest || null);
  },
  final(stageContext: StageProgressContext) {
    const preferredProgress = stageContext.latest || null;
    const bySubstage = stageContext.bySubstage || {};
    const normalizedBySubstage = Object.fromEntries(
      Object.entries(bySubstage).map(([substageKey, record]) => [
        substageKey,
        compositeTranslationProgressFromRecord(record),
      ]),
    );
    if (!preferredProgress && Object.keys(normalizedBySubstage).length === 0) {
      return null;
    }
    return {
      ...compositeTranslationProgressFromRecord(preferredProgress),
      bySubstage: normalizedBySubstage,
    };
  },
};

const renderStageProgressAdapter = {
  ...baseAdapter(),
  record(
    stageContext: StageProgressContext,
    nextProgress: ProgressRecord,
    {
      shouldReplaceCurrentStageProgress,
      shouldReplaceStageProgress,
    }: StageProgressRecordOptions = {},
  ) {
    defaultStageProgressAdapter.record(stageContext, nextProgress, { shouldReplaceCurrentStageProgress, shouldReplaceStageProgress });
    const records = stageContext.renderRecords || {};
    if (
      nextProgress.substageKey === "render_prepare"
      && nextProgress.progressUnit === "step"
      && shouldReplaceCurrentStageProgress?.(records.prepare, nextProgress)
    ) {
      records.prepare = nextProgress;
    }
    if (
      nextProgress.substageKey === "render_prewarm"
      && nextProgress.progressUnit === "step"
      && shouldReplaceCurrentStageProgress?.(records.prewarm, nextProgress)
    ) {
      records.prewarm = nextProgress;
    }
    if (
      nextProgress.progressUnit === "page"
      && shouldReplaceCurrentStageProgress?.(records.pages, nextProgress)
    ) {
      records.pages = nextProgress;
    }
    if (
      nextProgress.substageKey === "render_compile"
      && nextProgress.progressUnit === "step"
      && shouldReplaceCurrentStageProgress?.(records.compile, nextProgress)
    ) {
      records.compile = nextProgress;
    }
    stageContext.renderRecords = records;
  },
  current(stageContext: StageProgressContext) {
    return compositeRenderProgressFromRecords(stageContext.renderRecords || {}, stageContext.latestSameSubstage || stageContext.latest || null);
  },
  final(stageContext: StageProgressContext) {
    const records = stageContext.renderRecords || {};
    const progress = compositeRenderProgressFromRecords(records, stageContext.latest || null);
    if (!progress) {
      return null;
    }
    return {
      ...progress,
      bySubstage: {
        ...(records.prepare ? { render_prepare: compositeRenderPrepareProgress(records.prepare) || records.prepare } : {}),
        ...(records.prewarm ? { render_prewarm: compositeRenderPrewarmProgress(records.prewarm) || records.prewarm } : {}),
        ...(records.pages ? { render_pages: compositeRenderPageProgress(records.pages) || records.pages } : {}),
        ...(records.compile ? { render_compile: compositeRenderCompileProgress(records.compile) || records.compile } : {}),
      },
    };
  },
};

export function stageProgressAdapterFor(stageKey = "") {
  if (stageKey === "ocr") {
    return ocrStageProgressAdapter;
  }
  if (stageKey === "translate") {
    return translationStageProgressAdapter;
  }
  if (stageKey === "render") {
    return renderStageProgressAdapter;
  }
  return defaultStageProgressAdapter;
}
