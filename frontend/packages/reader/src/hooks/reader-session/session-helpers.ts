// 纯函数：job 状态归一化、标题选择、boot 进度上报、committed 源 URL。
// 无 React 依赖，可独立单测；行为与拆分前 use-reader-session.ts 内联实现一致。

import {
  resolveResourceUrl,
  READER_DIALOG_MESSAGES,
  defaultReaderPageConfigPort,
} from "../../external.js";
import type { BootState } from "./types.js";
import { documentSourcePdfPath, isFinishedJobStatus } from "@retainpdf/domain/job";


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
  return resolveResourceUrl(documentSourcePdfPath(documentId, revision));
}

export function isJobIdLikeTitle(title: string, jobId = ""): boolean {
  const t = `${title || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  if (!t) return true;
  if (id && (t === id || t === `${id}.pdf`)) return true;
  if (/^\d{8,14}-[0-9a-f]{4,}$/i.test(t)) return true;
  return false;
}

/**
 * 顶栏书名。后端任务详情（GET /jobs/:id）顶层没有书名，书名在 book_summary.title（书库里显示的那个，可能是自动认出的论文标题；
 * 没有时后端填任务号，由 isJobIdLikeTitle 滤掉）。2026-11-28 以前漏读它：只有带上传记录的任务才有 source_file_name，
 * 重排版、续跑出来的任务顶栏没有书名，左边一片空。
 */
export function pickDisplayTitle(jobPayload: Record<string, unknown> | null | undefined, jobId: string): string {
  const book = (jobPayload as { book_summary?: { title?: string; source_file_name?: string } } | null)?.book_summary;
  const candidates = [
    jobPayload?.title,
    jobPayload?.display_name,
    book?.title,
    jobPayload?.source_file_name,
    book?.source_file_name,
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
