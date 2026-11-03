// RetainPDF Web 宿主能力出口（host capability exit）：方向是 Web → 包。
// 这里汇总宿主提供给 @retainpdf/reader 的 API、配置、下载能力，
// 由 src/app/reader/adapters/retainpdf.ts 显式注册进包的 ReaderAdapters。
//
// 不要与包内 frontend/packages/reader/src/external.ts 混淆：那个是包内
// 「运行时访问层」（读取本出口注册的能力），方向相反。缺少宿主符号时，
// 只扩展本文件和 adapters/retainpdf.ts，不要把包内访问层搬到这里。

// —— config / mock / messaging ——
export { isMockMode } from "@/platform/config/runtime.js";
export { MOCK_DOCUMENT_SOURCE_PDF_URL } from "@/platform/mock/documents.js";
export { READER_DIALOG_MESSAGES } from "@/features/reader/domain.js";

// —— job / http / vendor ——
export { resolveResourceUrl } from "@retainpdf/domain/job";
export { fetchProtected } from "@/features/reader/domain.js";
export {
  resolvePdfjsVendorUrl,
  resolveMarkedVendorUrl,
} from "@/platform/runtime/vendor-url.js";

// —— Reader 宿主 ports：直连 shared/*，不经历史中转层 ——
export { defaultReaderDataPort, liveTranslationPort, pdfPort, sessionDataPort } from "@/features/reader/domain.js";
export {
  defaultReaderPageConfigPort,
  resolveReaderAnchor,
  resolveReaderDocumentId,
  resolveReaderJobId,
} from "@/features/reader/domain.js";
export { resolveReaderArtifactUrl } from "@/features/reader/domain.js";
export {
  resolveReaderSourcePdf,
  resolveReaderTranslatedPdfUrl,
} from "@/features/reader/domain.js";
export { READER_PROGRESS_COPY } from "@/features/reader/domain.js";

// —— 下载解析 / 受保护下载 ——
export {
  READER_DOWNLOAD_ACTIONS,
  disabledReason as readerDownloadDisabledReason,
  resolveReaderDownloadName,
  resolveReaderDownloadUrls,
  trimString as trimReaderDownloadString,
} from "@/features/reader/domain.js";
export { downloadProtectedResource } from "@/features/reader/domain.js";
export { failDownloadToast } from "@/platform/utils/download-feedback.js";

// —— markdown 面板 ——
export { resolveMarkdownAssetUrl } from "@retainpdf/domain/job";
export { parseMarkdownWithMath } from "@/features/reader/domain.js";

// —— 文档身份（按 jobId 反查）——
export { API_PREFIX } from "@/platform/config/api-constants.js";
export { fetchDocumentByJobId } from "@/platform/api/index.js";
