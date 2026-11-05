// RetainPDF 宿主对 @retainpdf/reader 的适配实现 — 将 frontend/web 的 external 真值注入 frontend/packages/reader 的 adapters
import * as ext from "../external.js";
import { setReaderAdapters } from "@retainpdf/reader/adapters";
import type { ReaderAdapters, ReaderDownloadAdapters } from "@retainpdf/reader/adapters";
import { studioEmbed, studioReaderAdapters } from "@/app/bootstrap/studio-embed.js";
import { parseReaderParams } from "@/platform/navigation/pages.js";

// external.ts 是 MPA 宿主能力的单一出口。这里只显式列出 ReaderAdapters
// 声明的字段：过去的 `...ext` 会把未声明的导出静默带入运行时对象，
// 一旦包契约增删字段无法在类型层暴露。逐字段映射可让漏接/错配立即报错。
// 放在笔记（Studio）里（?embed=studio）时才有：「摘到笔记」和「笔记」按钮，握过手、Studio 认才显示；翻页告诉 Studio 读到哪。
const studio = studioEmbed
  ? studioReaderAdapters(studioEmbed, parseReaderParams().jobId, (jobId) => ext.fetchDocumentByJobId(ext.API_PREFIX, jobId))
  : null;

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
  // —— 笔记（Studio）：「摘到笔记」、「笔记」按钮 ——
  notesQuote: studio?.notesQuote,
  notesPanel: studio?.notesPanel,
  readingPosition: studio?.readingPosition,
  // —— 放在 Studio 里、它有自己的 AI：阅读页的「AI」打开它的，不开上面的终端 ——
  hostAi: studio?.hostAi,
  // —— Studio 让翻到某一段：同一本书原地翻过去，不整页重开 ——
  hostNavigation: studio?.hostNavigation,
  // Studio 摘录栏说的这本书摘过的段落：阅读页在这些块左边画细线。
  quotedBlocks: studio?.quotedBlocks,
};
setReaderAdapters(adapters);

export { adapters as retainPdfReaderAdapters };
export { ext as retainPdfExternal };
