// 产物分组、标签与预览能力判定：把后端 manifest item 映射成人话。
// 仅依赖 types/values，不涉及 URL 解析与 section 组装。

import type { DocumentJobSummary } from "@/platform/contracts/library-payloads.js";
import type { ArtifactCenterGroupId, ArtifactManifestItem } from "./artifact-center-types.js";
import { artifactKey, text, workflowOf } from "./artifact-values.js";

export const GROUP_META: Record<ArtifactCenterGroupId, { label: string; description: string }> = {
  source: { label: "原始文件", description: "入库时保存的 PDF" },
  ocr: { label: "OCR 与结构化", description: "识别正文、Markdown、表格与结构化数据" },
  translation: { label: "翻译与阅读", description: "译文、对照文件与任务包" },
  diagnostics: { label: "诊断与报告", description: "后端实际生成的处理报告" },
  agent: { label: "Agent 版本", description: "候选文件与已应用版本" },
};

export function isDiagnosticArtifact(item: ArtifactManifestItem): boolean {
  const key = `${artifactKey(item)} ${text(item.artifact_group)}`;
  return /(diagnostic|report|summary|failure|error|log|trace)/.test(key);
}

// 后端 manifest 的 artifact_group：debug / provider 两组是流水线中间产物和 OCR 供应商的原始返回，
// 只有排查问题时才用得上。
const DEBUG_ARTIFACT_GROUP = /^(debug|provider|typst)$/;
// 老后端不一定给 artifact_group，按键名兜底：事件流、请求日志、断点、渲染配置、OCR 原始数据。
const DEBUG_ARTIFACT_KEY = /(events|journal|checkpoint|render.config|translation.manifest|layout.json|provider|paddle|mineru|typst|pipeline)/;

/** 排查用的文件：文件页不和 PDF / Markdown / 任务包摆在一起，收进「调试文件」。 */
export function isDebugArtifact(item: ArtifactManifestItem): boolean {
  if (DEBUG_ARTIFACT_GROUP.test(text(item.artifact_group).toLowerCase())) return true;
  if (isDiagnosticArtifact(item)) return true;
  // 只看键名不看文件名：译文 PDF 的文件名来自用户的书名，书名里带 events / pipeline 不该被当成调试文件。
  return DEBUG_ARTIFACT_KEY.test(artifactKey(item));
}

export function groupFor(job: DocumentJobSummary, item: ArtifactManifestItem): ArtifactCenterGroupId {
  if (isDiagnosticArtifact(item)) return "diagnostics";
  const workflow = workflowOf(job);
  return workflow === "ocr" ? "ocr" : "translation";
}

export function labelFor(item: ArtifactManifestItem): string {
  const key = `${artifactKey(item)} ${text(item.file_name || item.filename).toLowerCase()}`;
  if (/layout.docx|\.docx$/.test(key)) return "Word 排版稿";
  if (/side.by.side|comparison|bilingual/.test(key)) return "对照 PDF";
  if (/translated.pdf|output.pdf|result.pdf|^pdf$/.test(key)) return "译文 PDF";
  // 识别报告的文件名是 document.v1.report.json，必须先于「结构化文档」判断，否则会被 document.v1 吃掉。
  if (/normalization.report|document\.v1\.report/.test(key)) return "识别报告";
  if (/normalized.document|document\.v1/.test(key)) return "结构化文档";
  // OCR 服务商的原始返回（/files 里叫 ocr-provider/result.json、raw.zip），要先于「任务包」判断，否则 zip 会被当成完整任务包。
  if (/provider.result|provider.bundle|ocr-provider\//.test(key)) return "识别原始数据";
  if (/markdown.*bundle|bundle.*markdown/.test(key)) return "Markdown 任务包";
  if (/bundle|archive|zip/.test(key)) return "完整任务包";
  if (/translation.manifest/.test(key)) return "翻译清单";
  if (/layout\.json/.test(key)) return "版式数据";
  if (/events\.json/.test(key)) return "事件记录";
  if (/paddle_result|paddle_raw|mineru_result|mineru_raw/.test(key)) return "识别原始数据";
  if (/request.journal/.test(key)) return "翻译请求记录";
  if (/translation.checkpoint/.test(key)) return "翻译断点";
  if (/render.config/.test(key)) return "渲染配置";
  if (/markdown/.test(key)) return "Markdown";
  if (/diagnostic/.test(key)) return "诊断报告";
  if (/report/.test(key)) return "处理报告";
  if (/summary/.test(key)) return "处理摘要";
  return text(item.file_name || item.filename) || text(item.artifact_key) || "任务产物";
}

export function kindFor(item: ArtifactManifestItem): string {
  const explicit = text(item.artifact_kind).toUpperCase();
  if (explicit && explicit !== "FILE") return explicit;
  const name = text(item.file_name || item.filename || item.artifact_key);
  const extension = name.match(/\.([a-z0-9]+)$/i)?.[1];
  if (extension) return extension.toUpperCase();
  const contentType = text(item.content_type);
  if (contentType.includes("pdf")) return "PDF";
  if (contentType.includes("json")) return "JSON";
  if (contentType.includes("markdown")) return "MD";
  return explicit || "FILE";
}

export function previewable(item: ArtifactManifestItem): boolean {
  const key = artifactKey(item);
  return /(pdf|markdown|normalized.document)/.test(key);
}
