// 纯函数：job 状态归一化、标题选择、boot 进度上报、committed 源 URL。
// 无 React 依赖，可独立单测；行为与拆分前 use-reader-session.ts 内联实现一致。

import {
  resolveResourceUrl,
  READER_DIALOG_MESSAGES,
  defaultReaderPageConfigPort,
} from "../../external.js";
import type { BootState } from "./types.js";

export const TERMINAL_JOB_STATUSES = new Set(["succeeded", "failed", "cancelled", "canceled"]);

export function normalizeJobStatus(jobPayload: unknown): string {
  return `${(jobPayload as Record<string, unknown> | null)?.status || ""}`.trim().toLowerCase();
}

export function resolveJobDocumentId(jobPayload: unknown): string {
  if (!jobPayload || typeof jobPayload !== "object") return "";
  const payload = jobPayload as Record<string, any>;
  const candidates = [
    payload.document_id,
    payload.documentId,
    payload.document?.document_id,
    payload.book_summary?.document_id,
    payload.request_payload?.source?.document_id,
  ];
  for (const value of candidates) {
    const normalized = `${value || ""}`.trim();
    if (normalized) return normalized;
  }
  return "";
}

export function buildCommittedDocumentSourceUrl(
  documentId: string,
  revision: string,
): string {
  const path = `/api/v1/documents/${encodeURIComponent(documentId)}/source.pdf`;
  const normalizedRevision = `${revision || ""}`.trim();
  return resolveResourceUrl(normalizedRevision
    ? `${path}?version=${encodeURIComponent(normalizedRevision)}`
    : path);
}

export function isJobIdLikeTitle(title: string, jobId = ""): boolean {
  const t = `${title || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  if (!t) return true;
  if (id && (t === id || t === `${id}.pdf`)) return true;
  if (/^\d{8,14}-[0-9a-f]{4,}$/i.test(t)) return true;
  return false;
}

export function pickDisplayTitle(jobPayload: Record<string, unknown> | null | undefined, jobId: string): string {
  const candidates = [
    jobPayload?.title,
    jobPayload?.display_name,
    jobPayload?.source_file_name,
    (jobPayload as { book_summary?: { source_file_name?: string } } | null)?.book_summary?.source_file_name,
  ];
  for (const raw of candidates) {
    const text = `${raw || ""}`.trim();
    if (text && !isJobIdLikeTitle(text, jobId)) {
      return text.replace(/\.pdf$/i, "");
    }
  }
  return "";
}

export function postProgress({
  percent,
  text,
  stage,
}: {
  percent: number;
  text: string;
  stage: string;
}): void {
  try {
    window.parent?.postMessage(
      {
        type: READER_DIALOG_MESSAGES.progress,
        stage,
        percent,
        text,
      },
      defaultReaderPageConfigPort.messageTargetOrigin(),
    );
  } catch {
    // ignore
  }
}

export function setBootProgress(
  setBoot: (value: BootState | ((prev: BootState) => BootState)) => void,
  percent: number,
  text: string,
  stage = "progress",
): void {
  setBoot({
    loading: true,
    percent,
    text,
    stage,
    failed: false,
  });
  postProgress({ percent, text, stage });
}
