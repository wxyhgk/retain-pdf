// 文件出口的地址只在这里拼。返回从 /api/v1 开始的相对路径，要绝对地址的调用方自己用
// resolveResourceUrl 补上服务器（阅读页、桌面版各有各的补法）。出口清单见 backend/api/docs/file-responses.txt。

const API_PREFIX = "/api/v1";

/** 任务成品里前端会直接拼地址的几个文件；别的成品从 /jobs/:job_id/files 的清单里拿地址。 */
export type JobOutputFileName = "translated.pdf" | "side-by-side.pdf" | "ocr.md";

function encodeSegment(value: string): string {
  return encodeURIComponent(`${value ?? ""}`.trim());
}

/** 书的原文 PDF。给了版本就取那一版（重新提交过原文的书），不给取当前这版。 */
export function documentSourcePdfPath(documentId: string, version = ""): string {
  const path = `${API_PREFIX}/documents/${encodeSegment(documentId)}/files/source.pdf`;
  const normalizedVersion = `${version || ""}`.trim();
  return normalizedVersion ? `${path}?version=${encodeURIComponent(normalizedVersion)}` : path;
}

/** 任务的成品文件。download 让后端按附件回（浏览器直接存盘，不在页面里打开）。 */
export function jobOutputFilePath(
  jobId: string,
  name: JobOutputFileName,
  options: { download?: boolean } = {},
): string {
  const path = `${API_PREFIX}/jobs/${encodeSegment(jobId)}/files/output/${name}`;
  return options.download ? `${path}?download=1` : path;
}
