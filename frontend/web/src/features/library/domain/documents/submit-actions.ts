// 文档翻译 / OCR 提交（含每文档并发守卫与友好错误）。

import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  ocrDocument as defaultOcrDocument,
  translateDocument as defaultTranslateDocument,
} from "@/platform/api/index.js";
import type {
  JobSubmissionView,
  LibraryControllerDeps,
  OcrDocumentPayload,
  TranslateDocumentPayload,
} from "../types.js";
import { friendlyTranslateError, type ErrorLike } from "./error-messages.js";
import { assembleOcrPayload, assembleTranslatePayload } from "./submit-payloads.js";

export function createDocumentSubmitActions({
  buildTranslateConfig,
  buildOcrConfig,
  promoteDocumentToJob,
  translateDocumentApi = defaultTranslateDocument,
  ocrDocumentApi = defaultOcrDocument,
}: {
  buildTranslateConfig?: LibraryControllerDeps["buildTranslateConfig"];
  buildOcrConfig?: LibraryControllerDeps["buildOcrConfig"];
  promoteDocumentToJob: (
    documentId: string,
    result: JobSubmissionView | null | undefined,
    sourceJobId?: string,
  ) => void;
  /** 可注入，便于单测；默认走平台 API 网关。 */
  translateDocumentApi?: typeof defaultTranslateDocument;
  ocrDocumentApi?: typeof defaultOcrDocument;
}) {
  const translatingDocumentIds = new Set<string>();
  const ocrDocumentIds = new Set<string>();

  // 前置条件: documentId 非空且未在翻译中(并发守卫);失败 throw 友好文案。
  async function translateDocument(
    documentId?: string | null,
    payload: TranslateDocumentPayload = {},
  ): Promise<JobSubmissionView | null> {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId || translatingDocumentIds.has(normalizedId)) {
      return null;
    }
    translatingDocumentIds.add(normalizedId);
    let result: JobSubmissionView | null = null;
    const reusingOcr = Boolean(`${payload.source?.artifact_job_id || ""}`.trim());
    try {
      result = (await translateDocumentApi(
        API_PREFIX,
        normalizedId,
        assembleTranslatePayload(payload, buildTranslateConfig),
      )) as JobSubmissionView;
    } catch (error) {
      throw new Error(friendlyTranslateError(error as ErrorLike, { reusingOcr }));
    } finally {
      translatingDocumentIds.delete(normalizedId);
    }

    // 立刻接进度 + 更新详情/网格；不再整页 reload（运行中由单卡 patch 推进）
    promoteDocumentToJob(normalizedId, result);
    return result;
  }

  // 前置条件: documentId 非空且未在 OCR 中;凭据缺失 throw 专项提示。
  async function ocrDocument(
    documentId?: string | null,
    payload: OcrDocumentPayload = {},
  ): Promise<JobSubmissionView | null> {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId || ocrDocumentIds.has(normalizedId)) return null;
    ocrDocumentIds.add(normalizedId);
    let result: JobSubmissionView | null = null;
    try {
      result = (await ocrDocumentApi(
        API_PREFIX,
        normalizedId,
        assembleOcrPayload(payload, buildOcrConfig),
      )) as JobSubmissionView;
    } catch (error) {
      const message = typeof error === "string" ? error : `${(error as Error)?.message || error || ""}`;
      if (/(token|key|凭据|令牌|密钥|credential)/i.test(message)) {
        throw new Error("OCR 需要先在「设置」里配置 OCR 凭据后再试。");
      }
      throw new Error(message || "发起 OCR 失败，请稍后重试。");
    } finally {
      ocrDocumentIds.delete(normalizedId);
    }
    promoteDocumentToJob(normalizedId, { ...result, workflow: "ocr" });
    return result;
  }

  // 统一提交入口：仅按 workflow 分流，不改载荷组装。
  async function submitDocument(
    documentId?: string | null,
    payload: TranslateDocumentPayload | OcrDocumentPayload = {},
  ): Promise<JobSubmissionView | null> {
    const workflow = `${(payload as { workflow?: string })?.workflow || ""}`.trim().toLowerCase();
    if (workflow === "ocr") {
      return ocrDocument(documentId, payload as OcrDocumentPayload);
    }
    return translateDocument(documentId, payload as TranslateDocumentPayload);
  }

  return { translateDocument, ocrDocument, submitDocument };
}
