import type { LibraryCardItem } from "../types.js";

export type LibraryReadTarget = "job" | "source" | "none";

export type LibraryReadPresentation = {
  label: string;
  target: LibraryReadTarget;
  jobId: string;
  documentId: string;
};

/** OCR-only 只认后端规范 workflow，不用历史 `-ocr` job_id 猜测业务类型。 */
export function isOcrOnlyItem(item: LibraryCardItem = {}): boolean {
  const workflow = `${item.workflow || item.job_type || ""}`.trim().toLowerCase();
  return workflow === "ocr";
}

/** 网格卡和列表行共用的阅读文案与路由语义。 */
export function resolveLibraryReadPresentation(
  item: LibraryCardItem = {},
): LibraryReadPresentation {
  const documentId = `${item.document_id || ""}`.trim();
  const jobId = `${item.job_id || ""}`.trim();
  const succeeded = `${item.status || ""}`.trim().toLowerCase() === "succeeded";

  if (succeeded && jobId) {
    return {
      label: isOcrOnlyItem(item) ? "查看 OCR" : "对照阅读",
      target: "job",
      jobId,
      documentId,
    };
  }
  if (documentId) {
    return { label: "读原文", target: "source", jobId, documentId };
  }
  return { label: "读原文", target: "none", jobId, documentId };
}
