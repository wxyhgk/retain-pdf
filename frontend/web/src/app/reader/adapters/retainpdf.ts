// RetainPDF 宿主对 @retainpdf/reader 的适配实现 — 将 frontend/web 的 external 真值注入 frontend/packages/reader 的 adapters
import * as ext from "../external.js";
import { setReaderAdapters } from "@retainpdf/reader/adapters";
import type { ReaderAdapters, ReaderDownloadAdapters } from "@retainpdf/reader/adapters";

// external.ts 是 MPA 宿主能力的单一出口。这里只显式列出 ReaderAdapters
// 声明的字段：过去的 `...ext` 会把未声明的导出静默带入运行时对象，
// 一旦包契约增删字段无法在类型层暴露。逐字段映射可让漏接/错配立即报错。
const adapters: ReaderAdapters = {
  // —— session ——
  isMockMode: ext.isMockMode,
  resolveResourceUrl: ext.resolveResourceUrl,
  // 宿主 fetchProtected 只接收字符串 URL（包内调用方也只传字符串），类型上比 typeof fetch 窄，
  // 这里按原样断言，运行时就是同一个函数。
  fetchProtected: ext.fetchProtected as typeof fetch,
  resolvePdfjsVendorUrl: ext.resolvePdfjsVendorUrl,
  defaultReaderDataPort: ext.defaultReaderDataPort,
  liveTranslation: ext.liveTranslationPort,
  pdf: ext.pdfPort,
  sessionData: ext.sessionDataPort,
  defaultReaderPageConfigPort: ext.defaultReaderPageConfigPort,
  resolveReaderAnchor: ext.resolveReaderAnchor,
  resolveReaderDocumentId: ext.resolveReaderDocumentId,
  resolveReaderJobId: ext.resolveReaderJobId,
  resolveReaderArtifactUrl: ext.resolveReaderArtifactUrl,
  resolveReaderSourcePdf: ext.resolveReaderSourcePdf,
  resolveReaderTranslatedPdfUrl: ext.resolveReaderTranslatedPdfUrl,
  // —— markdown ——
  resolveMarkdownAssetUrl: ext.resolveMarkdownAssetUrl,
  // —— downloads ——
  resolveReaderDownloadUrls: ext.resolveReaderDownloadUrls,
  // 宿主实现的 jobId 声明为必填，包内类型里是可选的；宿主对缺省 jobId 本来就按 "" 处理
  // （见 readerDownloadNameState），这里只断言类型、不包一层，保持注入的函数同一引用。
  resolveReaderDownloadName: ext.resolveReaderDownloadName as ReaderDownloadAdapters["resolveReaderDownloadName"],
  // 宿主侧 onStatus/onBusy 的默认值 null 把参数类型推成了 null，实际接收的是回调，按包契约断言。
  downloadProtectedResource: ext.downloadProtectedResource as ReaderDownloadAdapters["downloadProtectedResource"],
  failDownloadToast: ext.failDownloadToast,
  apiPrefix: ext.API_PREFIX,
  fetchDocumentByJobId: ext.fetchDocumentByJobId,
  // —— credentials ——
  credentialsPort: ext.defaultCredentialsStatePort,
  // —— AI（阅读页唯一的一扇门：终端里的 agent）——
  renderReaderTerminal: ext.renderReaderTerminal,
  renderReaderBoard: ext.renderReaderBoard,
};
setReaderAdapters(adapters);
export { adapters as retainPdfReaderAdapters };
export { ext as retainPdfExternal };
