// Reader 的轻量本地恢复状态。这里只保存视图偏好，不保存文档内容或凭据。

import type { PageScrollProgress } from "../../pdf/scroll-to-page.js";

export type StoredReaderPaneContent = "source" | "translated" | "markdown" | "ai";

export type StoredReaderSplitLayout = {
  left: StoredReaderPaneContent;
  right: StoredReaderPaneContent;
};

export type ReaderViewState = {
  schema: "retainpdf_reader_view_v1";
  anchor?: PageScrollProgress;
  zoom?: number;
  splitLayout?: StoredReaderSplitLayout | null;
  assistantPanel?: "markdown" | "ai" | null;
  updatedAt: number;
};

type ReaderViewStatePatch = Partial<Pick<ReaderViewState, "anchor" | "zoom" | "splitLayout" | "assistantPanel">>;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_PREFIX = "retainpdf:reader:view:v1:";
const VALID_PANE_CONTENT = new Set<StoredReaderPaneContent>([
  "source",
  "translated",
  "markdown",
  "ai",
]);

function defaultStorage(): StorageLike | null {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function normalizeScopePart(value: unknown): string {
  return `${value || ""}`.trim();
}

export function readerViewStateScope({
  documentId,
  jobId,
}: {
  documentId?: unknown;
  jobId?: unknown;
}): string {
  const document = normalizeScopePart(documentId);
  if (document) return `document:${document}`;
  const job = normalizeScopePart(jobId);
  return job ? `job:${job}` : "";
}

export function readerViewStateStorageKey(scope: string): string {
  const normalized = normalizeScopePart(scope);
  return normalized ? `${STORAGE_PREFIX}${normalized}` : "";
}

function normalizeAnchor(value: unknown): PageScrollProgress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const page = Math.floor(Number((value as PageScrollProgress).page));
  const fraction = Number((value as PageScrollProgress).fraction);
  if (!Number.isFinite(page) || page < 1 || !Number.isFinite(fraction)) return undefined;
  return {
    page,
    fraction: Math.max(0, Math.min(1, fraction)),
  };
}

function normalizeSplitLayout(value: unknown): StoredReaderSplitLayout | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const left = `${(value as StoredReaderSplitLayout).left || ""}` as StoredReaderPaneContent;
  const right = `${(value as StoredReaderSplitLayout).right || ""}` as StoredReaderPaneContent;
  if (!VALID_PANE_CONTENT.has(left) || !VALID_PANE_CONTENT.has(right) || left === right) {
    return undefined;
  }
  return { left, right };
}

function normalizeAssistantPanel(value: unknown): "markdown" | "ai" | null | undefined {
  if (value === null) return null;
  return value === "markdown" || value === "ai" ? value : undefined;
}

export function normalizeReaderViewState(value: unknown): ReaderViewState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ReaderViewState>;
  if (raw.schema !== "retainpdf_reader_view_v1") return null;
  const anchor = normalizeAnchor(raw.anchor);
  const zoom = Number(raw.zoom);
  const splitLayout = normalizeSplitLayout(raw.splitLayout);
  const assistantPanel = normalizeAssistantPanel(raw.assistantPanel);
  return {
    schema: "retainpdf_reader_view_v1",
    ...(anchor ? { anchor } : {}),
    ...(Number.isFinite(zoom) ? { zoom: Math.max(0.25, Math.min(1, zoom)) } : {}),
    ...(splitLayout !== undefined ? { splitLayout } : {}),
    ...(assistantPanel !== undefined ? { assistantPanel } : {}),
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0,
  };
}

export function loadReaderViewState(
  scope: string,
  storage: StorageLike | null = defaultStorage(),
): ReaderViewState | null {
  const key = readerViewStateStorageKey(scope);
  if (!key || !storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? normalizeReaderViewState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveReaderViewState(
  scope: string,
  patch: ReaderViewStatePatch,
  storage: StorageLike | null = defaultStorage(),
): ReaderViewState | null {
  const key = readerViewStateStorageKey(scope);
  if (!key || !storage) return null;
  const previous = loadReaderViewState(scope, storage);
  const next = normalizeReaderViewState({
    schema: "retainpdf_reader_view_v1",
    ...(previous || {}),
    ...patch,
    updatedAt: Date.now(),
  });
  if (!next) return null;
  try {
    storage.setItem(key, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}
