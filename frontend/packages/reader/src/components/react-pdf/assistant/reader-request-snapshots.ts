// Frozen per-request routing snapshot. A submitted question keeps the mode,
// scope, and selection context it was sent with: switching the visible mode
// later must never reinterpret or retry it under the other mode.

import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";

export type ReaderRequestScope = "document" | "selection" | "page";

export type ReaderRequestSnapshot = {
  assistantMode: ReaderAssistantMode;
  scope: ReaderRequestScope;
  context: Record<string, unknown> | null;
};

const REQUEST_SNAPSHOT_PREFIX = "retainpdf.reader.ai.request.v1:";
export const LEGACY_REQUEST_SNAPSHOT: ReaderRequestSnapshot = Object.freeze({
  assistantMode: "reading",
  scope: "document",
  context: null,
});

export function requestSnapshotKey(jobId: string, assistantMessageId: string): string {
  return `${REQUEST_SNAPSHOT_PREFIX}${`${jobId || ""}`.trim()}:${`${assistantMessageId || ""}`.trim()}`;
}

export function normalizeRequestSnapshot(value: unknown): ReaderRequestSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const assistantMode = record.assistantMode === "operations" ? "operations"
    : record.assistantMode === "reading" ? "reading"
      : null;
  const scope = record.scope === "selection" || record.scope === "page" || record.scope === "document"
    ? record.scope
    : null;
  if (!assistantMode || !scope) return null;
  const context = record.context && typeof record.context === "object" && !Array.isArray(record.context)
    ? { ...(record.context as Record<string, unknown>) }
    : null;
  return { assistantMode, scope, context };
}

export function saveReaderRequestSnapshot(
  jobId: string,
  assistantMessageId: string,
  snapshot: ReaderRequestSnapshot,
): void {
  const job = `${jobId || ""}`.trim();
  const messageId = `${assistantMessageId || ""}`.trim();
  if (!job || !messageId) return;
  try {
    globalThis.localStorage?.setItem(
      requestSnapshotKey(job, messageId),
      JSON.stringify(snapshot),
    );
  } catch {
    // Private mode/quota: the current request still carries the frozen body.
  }
}

export function loadReaderRequestSnapshot(
  jobId: string,
  assistantMessageId: string,
): ReaderRequestSnapshot | null {
  const job = `${jobId || ""}`.trim();
  const messageId = `${assistantMessageId || ""}`.trim();
  if (!job || !messageId) return null;
  try {
    const raw = globalThis.localStorage?.getItem(requestSnapshotKey(job, messageId));
    return raw ? normalizeRequestSnapshot(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Preferred scope key: document-scoped snapshots stay stable across job/document id forms. */
export function requestSnapshotScopeKey(options: {
  documentId?: string;
  documentIdRef?: string;
  jobId: string;
}): string {
  return `${options.documentId || options.documentIdRef || options.jobId}`.trim();
}

/** Load the frozen snapshot for a retry, with jobId fallback and legacy default. */
export function loadRetryRequestSnapshot(options: {
  scopeKey: string;
  jobId: string;
  assistantMessageId: string;
}): ReaderRequestSnapshot {
  const scopeKey = `${options.scopeKey || ""}`.trim();
  const jobId = `${options.jobId || ""}`.trim();
  const messageId = `${options.assistantMessageId || ""}`.trim();
  return loadReaderRequestSnapshot(scopeKey, messageId)
    || (scopeKey !== jobId ? loadReaderRequestSnapshot(jobId, messageId) : null)
    || LEGACY_REQUEST_SNAPSHOT;
}

export type ReaderSelectionContextInput = Record<string, unknown> | null;

/**
 * Build the frozen snapshot for a new submission.
 * Reading keeps the live selection; operations are always document-scoped
 * with no selection context so an operation can never inherit a quote.
 */
export function buildReaderRequestSnapshot(options: {
  assistantMode: ReaderAssistantMode;
  selectionContext: ReaderSelectionContextInput;
}): ReaderRequestSnapshot {
  const { assistantMode, selectionContext } = options;
  if (assistantMode === "operations") {
    return { assistantMode, scope: "document", context: null };
  }
  return selectionContext
    ? { assistantMode, scope: "selection", context: { ...selectionContext } }
    : { assistantMode, scope: "document", context: null };
}
