import {
  buildRetryAction,
  buildStageRecoveries,
  firstText,
  normalizedToken,
  preservationTextOf,
  recordOf,
  stageActionFor,
  stringList,
  textOf,
} from "./failure-recovery-stages.js";
import type {
  FailureRecoveryAction,
  FailureRecoveryStage,
  UnknownRecord,
} from "./failure-recovery-stages.js";

export type { FailureRecoveryAction, FailureRecoveryStage };

export type FailureRecoveryKind = "queue_full" | "ocr_ambiguous" | "generic";

export type FailureRecoveryModel = {
  kind: FailureRecoveryKind;
  provider: string;
  providerCode: string;
  traceId: string;
  attempt: number | null;
  maxAttempts: number | null;
  retryAtMs: number | null;
  retryAfterSource: string;
  retryOcr: FailureRecoveryAction;
  /** 后端 failure.resume_from：可以从哪个阶段续跑，空串表示只能整个重跑。 */
  resumeFrom: string;
  /** 后端 failure.recovery_hint：这次重试会做什么、要不要再花钱。 */
  recoveryHint: string;
  /** 后端返回的全部阶段恢复入口，前端不筛分类、只排版。 */
  stages: FailureRecoveryStage[];
  checkpointArtifacts: string[];
  preservesSourcePdf: boolean;
  statusText: string;
  preservationText: string;
  backendGaps: string[];
};

function positiveInteger(...values: unknown[]): number | null {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return Math.floor(number);
  }
  return null;
}

function eventItems(eventsPayload: unknown): UnknownRecord[] {
  const items = recordOf(eventsPayload).items;
  return Array.isArray(items) ? items.map(recordOf) : [];
}

function latestStructuredRetryEvent(eventsPayload: unknown): UnknownRecord {
  return eventItems(eventsPayload)
    .filter((item) => normalizedToken(item.event) === "retry_scheduled")
    .sort((left, right) => {
      const leftAt = Date.parse(firstText(left.ts, left.timestamp, left.created_at)) || 0;
      const rightAt = Date.parse(firstText(right.ts, right.timestamp, right.created_at)) || 0;
      return rightAt - leftAt;
    })[0] || {};
}

function retryAtFromValue(value: unknown, baseMs: number): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return baseMs + value * 1000;
  }
  const text = textOf(value);
  if (!text) return null;
  if (/^\d+(?:\.\d+)?$/.test(text)) return baseMs + Number(text) * 1000;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function structuredRetryAfter(
  sources: Array<{ name: string; value: UnknownRecord; baseMs?: number }>,
  nowMs: number,
): { retryAtMs: number | null; source: string } {
  for (const source of sources) {
    const baseMs = source.baseMs || nowMs;
    const seconds = source.value.retry_after_seconds;
    if (seconds !== undefined) {
      const retryAtMs = retryAtFromValue(seconds, baseMs);
      if (retryAtMs !== null) return { retryAtMs, source: `${source.name}.retry_after_seconds` };
    }
    const retryAfter = source.value.retry_after;
    if (retryAfter !== undefined) {
      const retryAtMs = retryAtFromValue(retryAfter, baseMs);
      if (retryAtMs !== null) return { retryAtMs, source: `${source.name}.retry_after` };
    }
    const retryAt = firstText(source.value.retry_at, source.value.next_retry_at);
    if (retryAt) {
      const retryAtMs = retryAtFromValue(retryAt, baseMs);
      if (retryAtMs !== null) return { retryAtMs, source: `${source.name}.retry_at` };
    }
  }
  return { retryAtMs: null, source: "" };
}

function queueFull(providerCode: string, ...categories: unknown[]): boolean {
  if (providerCode === "10010" || providerCode === "429") return true;
  return categories.some((category) => normalizedToken(category) === "queue_full");
}

export function buildFailureRecoveryModel({
  job: jobValue,
  diagnostics: diagnosticsValue,
  stageActions = null,
  resumePlan: resumePlanValue,
  eventsPayload = null,
  nowMs = Date.now(),
}: {
  job?: unknown;
  diagnostics?: unknown;
  stageActions?: unknown;
  resumePlan?: unknown;
  eventsPayload?: unknown;
  nowMs?: number;
} = {}): FailureRecoveryModel {
  const job = recordOf(jobValue);
  const diagnostics = recordOf(diagnosticsValue || job.diagnostics);
  const failure = recordOf(job.failure);
  const providerDiagnostics = recordOf(job.ocr_provider_diagnostics);
  const providerError = recordOf(providerDiagnostics.last_error);
  const ambiguity = recordOf(diagnostics.ocr_ambiguity);
  const retryEvent = latestStructuredRetryEvent(eventsPayload);
  const retryPayload = recordOf(retryEvent.payload);
  const retryEventAt = Date.parse(firstText(retryEvent.ts, retryEvent.timestamp, retryEvent.created_at)) || nowMs;

  const providerCode = firstText(
    providerError.provider_code,
    failure.provider_code,
    failure.code,
  );
  const provider = normalizedToken(firstText(
    providerDiagnostics.provider,
    failure.provider,
    ambiguity.provider,
    recordOf(recordOf(job.request_payload).ocr).provider,
  ));
  const traceId = firstText(
    providerError.trace_id,
    job.provider_trace_id,
    job.trace_id,
  );
  const isQueueFull = queueFull(
    providerCode,
    providerError.category,
    failure.failure_code,
    failure.failure_category,
    failure.category,
    diagnostics.failure_code,
  );
  const isAmbiguous = normalizedToken(ambiguity.status) === "ambiguous";
  const retryTiming = structuredRetryAfter([
    { name: "diagnostics", value: diagnostics },
    { name: "failure", value: failure },
    { name: "provider_error", value: providerError },
    { name: "retry_event", value: retryPayload, baseMs: retryEventAt },
  ], nowMs);
  const attempt = positiveInteger(
    diagnostics.attempt,
    failure.attempt,
    providerError.attempt,
    retryPayload.attempt,
  );
  const maxAttempts = positiveInteger(
    diagnostics.max_attempts,
    failure.max_attempts,
    providerError.max_attempts,
    retryPayload.max_attempts,
  );
  const resumePlan = recordOf(resumePlanValue);
  // 恢复目录（后端 job_failure_catalogue）的两个字段：能从哪续跑、怎么跟用户说。
  const resumeFrom = normalizedToken(firstText(failure.resume_from, diagnostics.resume_from));
  const recoveryHint = firstText(failure.recovery_hint, diagnostics.recovery_hint);
  const stages = buildStageRecoveries(stageActions, ambiguity, resumeFrom);
  // 断点信息跟着后端的 resume_from 走；后端没说才退回 OCR 阶段（老行为）。
  const primaryStage = stageActionFor(stageActions, resumeFrom || "ocr");
  const checkpointArtifacts = Array.from(new Set([
    ...stringList(primaryStage.will_reuse),
    ...stringList(resumePlan.reuses_artifacts),
  ]));
  const preservesSourcePdf = checkpointArtifacts.includes("source_pdf");
  const retryOcr = buildRetryAction(stageActionFor(stageActions, "ocr"), "ocr", ambiguity);
  const backendGaps: string[] = [];
  if (isQueueFull && retryTiming.retryAtMs === null) backendGaps.push("retry_after");
  if (isQueueFull && (attempt === null || maxAttempts === null)) backendGaps.push("attempt/max_attempts");
  if (!traceId) backendGaps.push("trace_id");
  // 一个可点的阶段都没有才算缺口：以前只看 OCR，于是「渲染可续跑」的任务也被
  // 误报成后端没给动作。
  if (!isAmbiguous && !stages.some((item) => item.action.available)) {
    backendGaps.push("stage_actions.action");
  }

  const attemptText = attempt !== null && maxAttempts !== null
    ? `（第 ${attempt}/${maxAttempts} 次）`
    : "";
  // 队列繁忙的文案带重试次数，是 hint 给不出来的信息，所以这一支不让位给 hint；
  // 其余情况一律优先用后端的 recovery_hint——前端不再自己编分类文案。
  const statusText = isQueueFull
    ? retryTiming.retryAtMs !== null
      ? `OCR 服务队列繁忙，等待自动重试${attemptText}`
      : `OCR 服务队列繁忙，等待服务自动重试；也可立即重试${attemptText}`
    : isAmbiguous
      ? recoveryHint || "OCR 请求结果不明确，需要先确认重复执行风险。"
      : recoveryHint || (stages.length
        ? "后端提供了以下恢复方式，请选择一个继续。"
        : "当前没有可识别的专门恢复状态。");
  const preservationText = preservationTextOf(checkpointArtifacts);

  return {
    kind: isQueueFull ? "queue_full" : isAmbiguous ? "ocr_ambiguous" : "generic",
    provider,
    providerCode,
    traceId,
    attempt,
    maxAttempts,
    retryAtMs: retryTiming.retryAtMs,
    retryAfterSource: retryTiming.source,
    retryOcr,
    resumeFrom,
    recoveryHint,
    stages,
    checkpointArtifacts,
    preservesSourcePdf,
    statusText,
    preservationText,
    backendGaps,
  };
}

export function retryCountdownSeconds(model: FailureRecoveryModel, nowMs = Date.now()): number | null {
  if (model.retryAtMs === null) return null;
  return Math.max(0, Math.ceil((model.retryAtMs - nowMs) / 1000));
}

export function queueFullTitle(model: FailureRecoveryModel): string {
  return model.provider === "paddle" ? "Paddle OCR 队列繁忙" : "OCR 服务队列繁忙";
}

export function createFailureRecoveryController({
  retryStage,
  copyTrace,
}: {
  retryStage?: (jobId: string, stage: string, payload: UnknownRecord) => Promise<unknown>;
  copyTrace?: (traceId: string) => Promise<unknown>;
} = {}) {
  function actionOf(model: FailureRecoveryModel, stage: string): FailureRecoveryAction | undefined {
    const stages = Array.isArray(model.stages) ? model.stages : [];
    const found = stages.find((item) => item.stage === stage);
    if (found) return found.action;
    // 旧快照（store 初值、测试里手工拼的 model）没有 stages 字段，OCR 仍从
    // retryOcr 取——队列繁忙卡片那条老路径不该因为新字段而失灵。
    return stage === "ocr" ? model.retryOcr : undefined;
  }

  async function retryStageNow(
    jobId: string,
    model: FailureRecoveryModel,
    stage: string,
    options: { acceptDuplicateRisk?: boolean } = {},
  ) {
    const token = normalizedToken(stage);
    const action = actionOf(model, token);
    if (!action || !action.available || !action.enabled) {
      throw new Error(action?.reason || "后端当前未开放安全的重试操作。");
    }
    if (action.requiresDuplicateRisk && !options.acceptDuplicateRisk) {
      throw new Error("该请求可能重复执行，请使用重复风险确认流程。");
    }
    if (!retryStage) throw new Error("阶段重试服务不可用。");
    const body = { ...recordOf(action.body) };
    if (action.requiresDuplicateRisk && options.acceptDuplicateRisk) {
      body.ambiguous_request_policy = "accept_duplicate_risk";
    }
    return retryStage(jobId, token, body);
  }

  async function retryOcrNow(
    jobId: string,
    model: FailureRecoveryModel,
    options: { acceptDuplicateRisk?: boolean } = {},
  ) {
    return retryStageNow(jobId, model, "ocr", options);
  }

  async function copyTraceId(model: FailureRecoveryModel) {
    if (!model.traceId) throw new Error("后端未返回 Trace ID。");
    if (!copyTrace) throw new Error("当前浏览器不支持复制 Trace ID。");
    await copyTrace(model.traceId);
    return model.traceId;
  }

  return { retryOcrNow, retryStageNow, copyTraceId };
}
