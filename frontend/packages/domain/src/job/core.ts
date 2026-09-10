import type { JobLike, JobPayload, JobStatus } from "./types.js";

export type { JobLike, JobPayload, JobStatus } from "./types.js";

export function numberOrNull(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function arrayOrEmpty<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export function objectOrNull<T extends object = Record<string, unknown>>(value: unknown): T | null {
  return value && typeof value === "object" ? (value as T) : null;
}

export function unwrapEnvelope<T = unknown>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload && "code" in payload) {
    const envelope = payload as { code: number; message?: string; data?: T };
    if (envelope.code !== 0) {
      throw new Error(envelope.message || `API returned code ${envelope.code}`);
    }
    return (envelope.data ?? null) as T;
  }
  return payload as T;
}

export function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function firstDefined<T>(...values: T[]): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

export function isTerminalStatus(status: JobStatus | string | null | undefined): boolean {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

function activeStageSignal(payload: JobLike | JobPayload | null | undefined = {}): string {
  const text = firstNonEmpty(
    payload?.display_stage,
    payload?.stage_snapshot?.publicStage,
    payload?.stage_snapshot?.stageKey,
  ).toLowerCase();
  if (!text) {
    return "";
  }
  if (text === "translation" || text === "translate" || text.includes("translat")) {
    return "translation";
  }
  if (text === "ocr" || text.includes("ocr") || text.includes("paddle") || text.includes("mineru") || text.includes("normaliz")) {
    return "ocr";
  }
  if (text === "render" || text.includes("render") || text.includes("compile") || text.includes("overlay") || text.includes("saving")) {
    return "render";
  }
  if (text === "done") {
    return "done";
  }
  return "";
}

function hasFinalArtifactSignal(payload: JobLike | JobPayload | null | undefined = {}): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const artifacts = (payload.artifacts || {}) as Record<string, unknown>;
  const artifactFlags = [
    payload.output_pdf_ready,
    payload.pdf_ready,
    payload.translated_pdf_ready,
    artifacts.output_pdf_ready,
    artifacts.pdf_ready,
    artifacts.translated_pdf_ready,
  ];
  if (artifactFlags.some((value) => value === true)) {
    return true;
  }
  const displayArtifacts = Array.isArray(payload.artifacts_display) ? payload.artifacts_display : [];
  return displayArtifacts.some((artifact) => {
    const key = `${artifact?.key || artifact?.kind || ""}`.trim().toLowerCase();
    return artifact?.ready === true && (key === "pdf" || key === "translated_pdf" || key === "output_pdf");
  });
}

function hasExplicitDoneSignal(payload: JobLike | JobPayload | null | undefined = {}): boolean {
  const stageSignal = activeStageSignal(payload);
  if (stageSignal) {
    return stageSignal === "done";
  }
  const runtime = (payload?.runtime || {}) as { terminal_reason?: string };
  const terminalReason = firstNonEmpty(payload?.terminal_reason, runtime.terminal_reason).toLowerCase();
  if (terminalReason === "completed" || terminalReason === "done") {
    return true;
  }
  return hasFinalArtifactSignal(payload);
}

export function isJobTerminal(
  payload: JobLike | JobPayload | JobStatus | string | null | undefined = {},
): boolean {
  const status = typeof payload === "string" ? payload : payload?.status;
  if (status === "failed" || status === "canceled") {
    return true;
  }
  if (status !== "succeeded") {
    return false;
  }
  if (typeof payload === "string" || !payload || typeof payload !== "object") {
    return true;
  }
  return hasExplicitDoneSignal(payload);
}
