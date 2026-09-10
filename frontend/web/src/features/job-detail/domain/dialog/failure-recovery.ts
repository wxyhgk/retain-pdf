type UnknownRecord = Record<string, unknown>;

export type FailureRecoveryKind = "queue_full" | "ocr_ambiguous" | "generic";

export type FailureRecoveryAction = {
  available: boolean;
  enabled: boolean;
  method: "POST" | "";
  url: string;
  body: UnknownRecord;
  reason: string;
  requiresDuplicateRisk: boolean;
};

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
  checkpointArtifacts: string[];
  preservesSourcePdf: boolean;
  statusText: string;
  preservationText: string;
  backendGaps: string[];
};

function recordOf(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function textOf(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? `${value}`.trim()
    : "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = textOf(value);
    if (text) return text;
  }
  return "";
}

function positiveInteger(...values: unknown[]): number | null {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return Math.floor(number);
  }
  return null;
}

function normalizedToken(value: unknown): string {
  return textOf(value).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase();
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

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(textOf).filter(Boolean)
    : [];
}

function ocrStageAction(stageActions: unknown): UnknownRecord {
  const stages = recordOf(stageActions).stages;
  if (!Array.isArray(stages)) return {};
  return stages.map(recordOf).find((item) => normalizedToken(item.stage) === "ocr") || {};
}

function buildRetryAction(stageActions: unknown, ambiguity: UnknownRecord): FailureRecoveryAction {
  const stageAction = ocrStageAction(stageActions);
  const action = recordOf(stageAction.action);
  const body = recordOf(action.body);
  const method = normalizedToken(action.method) === "post" ? "POST" : "";
  const url = textOf(action.url);
  const valid = method === "POST" && Boolean(url) && normalizedToken(body.stage) === "ocr";
  const requiresDuplicateRisk = normalizedToken(ambiguity.status) === "ambiguous"
    || Boolean(stageAction.danger);
  return {
    available: valid,
    enabled: valid && stageAction.can_retry === true && !requiresDuplicateRisk,
    method,
    url,
    body,
    reason: firstText(stageAction.disabled_reason, stageAction.reason),
    requiresDuplicateRisk,
  };
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
  const retryStage = ocrStageAction(stageActions);
  const checkpointArtifacts = Array.from(new Set([
    ...stringList(retryStage.will_reuse),
    ...stringList(resumePlan.reuses_artifacts),
  ]));
  const preservesSourcePdf = checkpointArtifacts.includes("source_pdf");
  const retryOcr = buildRetryAction(stageActions, ambiguity);
  const backendGaps: string[] = [];
  if (isQueueFull && retryTiming.retryAtMs === null) backendGaps.push("retry_after");
  if (isQueueFull && (attempt === null || maxAttempts === null)) backendGaps.push("attempt/max_attempts");
  if (!traceId) backendGaps.push("trace_id");
  if (!retryOcr.available && !isAmbiguous) backendGaps.push("stage_actions.ocr.action");

  const attemptText = attempt !== null && maxAttempts !== null
    ? `（第 ${attempt}/${maxAttempts} 次）`
    : "";
  const statusText = isQueueFull
    ? retryTiming.retryAtMs !== null
      ? `OCR 服务队列繁忙，等待自动重试${attemptText}`
      : `OCR 服务队列繁忙，等待服务自动重试；也可立即重试${attemptText}`
    : isAmbiguous
      ? "OCR 请求结果不明确，需要先确认重复执行风险。"
      : "当前没有可识别的专门恢复状态。";
  const preservationText = preservesSourcePdf
    ? checkpointArtifacts.length > 1
      ? `原 PDF 会保留；恢复时将复用 ${checkpointArtifacts.join("、")}。`
      : "原 PDF 会保留并用于重新 OCR。"
    : "重试不会覆盖当前任务记录；请保留原 PDF，便于安全恢复。";

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
  async function retryOcrNow(jobId: string, model: FailureRecoveryModel, options: { acceptDuplicateRisk?: boolean } = {}) {
    if (!model.retryOcr.available || !model.retryOcr.enabled) {
      throw new Error(model.retryOcr.reason || "后端当前未开放安全的 OCR 重试操作。");
    }
    if (model.retryOcr.requiresDuplicateRisk && !options.acceptDuplicateRisk) {
      throw new Error("该请求可能重复执行，请使用重复风险确认流程。");
    }
    if (!retryStage) throw new Error("OCR 重试服务不可用。");
    const body = { ...recordOf(model.retryOcr.body) };
    if (model.retryOcr.requiresDuplicateRisk && options.acceptDuplicateRisk) {
      body.ambiguous_request_policy = "accept_duplicate_risk";
    }
    return retryStage(jobId, "ocr", body);
  }

  async function copyTraceId(model: FailureRecoveryModel) {
    if (!model.traceId) throw new Error("后端未返回 Trace ID。");
    if (!copyTrace) throw new Error("当前浏览器不支持复制 Trace ID。");
    await copyTrace(model.traceId);
    return model.traceId;
  }

  return { retryOcrNow, copyTraceId };
}
