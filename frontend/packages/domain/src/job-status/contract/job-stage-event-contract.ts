import type { EventIdentity, StageEvent } from "../types.js";

export type { EventIdentity, StageEvent } from "../types.js";

const PUBLIC_STAGE_KEYS = new Set(["ocr", "translate", "render", "done"]);

export function eventPayloadOf(event: StageEvent = {}): Record<string, unknown> {
  return event?.payload && typeof event.payload === "object" ? event.payload : {};
}

export function normalizeEventStage(value: unknown = ""): string {
  const stage = `${value || ""}`.trim().toLowerCase();
  if (stage === "translation") {
    return "translate";
  }
  return stage;
}

export function normalizeUserStage(value: unknown = ""): string {
  return normalizeEventStage(value);
}

export function normalizeDisplayStage(value: unknown = ""): string {
  const stage = normalizeEventStage(value);
  return stage === "translating" ? "translate" : stage;
}

export function isPublicStageKey(value: unknown = ""): boolean {
  return PUBLIC_STAGE_KEYS.has(normalizeEventStage(value));
}

export function hasStructuredProgress(event: StageEvent = {}): boolean {
  const payload = eventPayloadOf(event);
  return Boolean(event?.progress && typeof event.progress === "object")
    || Boolean(payload?.progress && typeof payload.progress === "object");
}

export function eventIdentity(event: StageEvent = {}): EventIdentity {
  const seq = Number(event.seq);
  const ts = Date.parse(event.ts || event.created_at || "");
  return {
    seq: Number.isFinite(seq) ? seq : null,
    ts: Number.isFinite(ts) ? ts : null,
  };
}

export function eventLaneOf(event: StageEvent = {}): string {
  const payload = eventPayloadOf(event);
  return `${event?.lane || payload.lane || ""}`.trim().toLowerCase();
}

export function isMainLaneEvent(event: StageEvent = {}): boolean {
  const lane = eventLaneOf(event);
  return !lane || lane === "main";
}

export function structuredPublicStageOf(event: StageEvent = {}): string {
  const payload = eventPayloadOf(event);
  const explicitCandidates = [event.display_stage, payload.display_stage];
  for (const candidate of explicitCandidates) {
    const normalized = normalizeDisplayStage(candidate);
    if (PUBLIC_STAGE_KEYS.has(normalized)) {
      return normalized;
    }
  }
  return "";
}

export function hasStructuredPublicStage(event: StageEvent = {}): boolean {
  const payload = eventPayloadOf(event);
  return Boolean(`${event.display_stage || payload.display_stage || ""}`.trim());
}

export function hasCanonicalEventContract(event: StageEvent | Record<string, unknown> = {}): boolean {
  const payload = eventPayloadOf(event as StageEvent);
  return hasStructuredPublicStage(event as StageEvent)
    || Boolean(`${(event as StageEvent).lane || payload.lane || ""}`.trim());
}

export function progressUnitOf(event: StageEvent = {}): string {
  const progress = (event?.progress && typeof event.progress === "object" ? event.progress : {}) as {
    unit?: string;
  };
  if (`${progress.unit || ""}`.trim()) {
    return `${progress.unit}`.trim().toLowerCase();
  }
  const payload = eventPayloadOf(event);
  const payloadProgress = (payload?.progress && typeof payload.progress === "object" ? payload.progress : {}) as {
    unit?: string;
  };
  if (`${payloadProgress.unit || ""}`.trim()) {
    return `${payloadProgress.unit}`.trim().toLowerCase();
  }
  if (hasStructuredProgress(event) || hasCanonicalEventContract(event)) {
    return "";
  }
  return `${event?.progress_unit || payload.progress_unit || ""}`.trim().toLowerCase();
}
