// 一次上传多本时传其中一本：和选单个文件时同样的大小、页数校验，同一个上传请求，
// 但不碰单文件上传那套界面状态（文件名、进度条、页码输入框），结果直接返回。
// 失败时抛出的 Error.message 就是给用户看的那句话。

import { isRefusedSubmission } from "@/platform/api/index.js";
import type { UploadConfigPortLike, UploadResponsePayload } from "./ports.js";

export type BatchUploadedFile = {
  uploadId: string;
  documentId: string;
  fileName: string;
  pageCount: number;
};

export interface BatchFileUploaderDeps {
  configPort: UploadConfigPortLike;
  apiPrefix?: string;
  frontMaxBytes: number;
  frontMaxPageCount: number;
  countPdfPages?: (file: File) => Promise<number> | number;
  collectUploadFormData: (file: File) => FormData | unknown;
  submitUploadRequest: (
    url: string,
    formData: unknown,
    setProgress?: (loaded: number, total: number) => void,
  ) => Promise<UploadResponsePayload>;
}

function sizeLimitText(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return Number.isFinite(mb) && mb > 0 ? `${Math.round(mb)}MB` : "当前";
}

export function createBatchFileUploader({
  configPort,
  apiPrefix,
  frontMaxBytes,
  frontMaxPageCount,
  countPdfPages,
  collectUploadFormData,
  submitUploadRequest,
}: BatchFileUploaderDeps) {
  async function checkFile(file: File) {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      throw new Error("不是 PDF 文件");
    }
    if (file.size > frontMaxBytes) {
      throw new Error(`超过 ${sizeLimitText(frontMaxBytes)}`);
    }
    if (!frontMaxPageCount || !countPdfPages) return;
    let pages: number;
    try {
      pages = await countPdfPages(file);
    } catch {
      throw new Error("PDF 解析失败，文件可能损坏");
    }
    if (!Number.isFinite(pages) || pages <= 0) throw new Error("PDF 解析失败，文件可能损坏");
    if (pages > frontMaxPageCount) throw new Error(`超过 ${frontMaxPageCount} 页`);
  }

  async function uploadFile(
    file: File,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<BatchUploadedFile> {
    await checkFile(file);
    let payload: UploadResponsePayload;
    try {
      payload = await submitUploadRequest(configPort.buildUploadUrl(apiPrefix), collectUploadFormData(file), onProgress);
    } catch (err) {
      // 磁盘空间不够这类是那句中文原话；别的只说上传失败和原因，不给整段诊断。
      if (isRefusedSubmission(err)) throw err;
      const reason = `${(err as { message?: string } | null)?.message || ""}`.trim();
      throw new Error(reason ? `上传失败：${reason}` : "上传失败");
    }
    const pageCount = Number(payload.page_count || 0);
    if (frontMaxPageCount > 0 && pageCount > frontMaxPageCount) throw new Error(`超过 ${frontMaxPageCount} 页`);
    const uploadId = `${payload.upload_id || ""}`.trim();
    if (!uploadId) throw new Error("上传失败：后端没有返回上传编号");
    return {
      uploadId,
      documentId: `${payload.document_id || ""}`.trim(),
      fileName: `${payload.filename || file.name}`,
      pageCount,
    };
  }

  return { uploadFile };
}
