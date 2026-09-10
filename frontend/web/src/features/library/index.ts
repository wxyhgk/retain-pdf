// library —— 书架：书卡网格与列表、封面、筛选/排序/批量、搜索岛，
// 以及最近任务的运行时同步与文档书目资源。
//
// 这是本功能对外的唯一出口。
// ui/     page/ 书架页与工具栏  shell/ 书卡与列表行  display/ 封面与徽标
//         island/ 搜索自定义元素
// domain/ controller 与动作、卡片语义与徽标模型、recent-jobs 运行时（31 文件）、
//         documents 书目资源，全部与 React 无关
//
// 出口按外部实际需要逐条列举，不用 export * 整体转出内部模块——
// 那会把 recent-jobs 等子域的模块级副作用全部提前触发，改变初始化时序
// （曾因此让 mock 书库刷新与测试写入竞争，书架渲染成内置馆藏卡）。

export {
  isLibraryCardProcessing,
} from "./domain/card/library-card-badge.js";
export {
  isOcrOnlyItem,
  resolveLibraryReadPresentation,
} from "./domain/card/library-card-semantics.js";
export {
  createLibraryController,
} from "./domain/controller.js";
export {
  shapeDocumentsWithBooks,
} from "./domain/documents/shape-documents-with-books.js";
export {
  createRecentJobsReactViewPort,
} from "./domain/recent-jobs-react-port.js";
export {
  inclusivePageNumbers,
  reusableOcrJobId,
  selectDocumentOcrStatusJob,
  selectReusableOcrJob,
  translationUsesReusedOcr,
} from "./domain/translation-ocr-reuse.js";
export type {
  DeleteCardTarget,
  DeleteDocumentsResult,
  DocumentJobSummary,
  JobSubmissionView,
  LibraryCardItem,
  LibraryController,
  LibraryJobItem,
  RecentJobsReactViewPort,
  ReloadRecentJobsOptions,
  TranslateDocumentPayload,
  UpdateDocumentPayload,
} from "./domain/types.js";
export {
  BookCardProcessingOverlay,
} from "./ui/display/BookCardProcessingOverlay.jsx";
export {
  useRecentJobCover,
} from "./ui/display/useRecentJobCover.js";
export {
  RecentJobsLibrary,
} from "./ui/page/RecentJobsLibrary.jsx";
export {
  readInitialLibraryTabFromReturn,
  useHomeReturnRestore,
} from "./ui/page/useHomeReturnRestore.js";
// 搜索绑定 hook：app-shell 的 AppBottomBar 跨功能消费，只能走本出口，
// 不再直连 app/home/features/shared（该共享叶子已随 B4 撤销）。
export {
  useLibrarySearchBinding,
} from "./ui/page/use-library-search-binding.js";
export {
  BookCard,
  buildDefaultBookCardActions,
} from "./ui/shell/BookCard.jsx";

// 经 composition/external 网关转出的 recent-jobs 端口（随批次 5 网关解散后可收窄）。
export {
  isRecentJobActive,
  recentJobProgressPercent,
  recentJobRawImageUrls,
  recentJobStageLabel,
  recentJobStatusLabel,
  recentJobTitle,
  stageKeyForRecentJobLabel,
} from "./domain/card/recent-job-card-presenter.js";
export {
  createDocumentAutoNaming,
} from "./domain/documents/document-auto-naming.js";
export {
  isLibraryOnlyItem,
} from "./domain/documents/document-card-item.js";
export {
  createDocumentLibraryResource,
} from "./domain/documents/document-library-resource.js";
export {
  createRecentJobActions,
} from "./domain/recent-jobs/actions.js";
export {
  mountRecentJobsFeature,
} from "./domain/recent-jobs/controller.js";
export {
  createRecentJobsRuntimePort,
} from "./domain/recent-jobs/job-runtime-port.js";
export {
  libraryCardIdentity,
} from "./domain/recent-jobs/library-card-identity.js";
export {
  createRecentJobsLibraryRefreshPort,
} from "./domain/recent-jobs/library-refresh-port.js";
export {
  createRecentJobsNavigationPort,
} from "./domain/recent-jobs/navigation-port.js";
export {
  createRecentJobsReaderPort,
} from "./domain/recent-jobs/reader-port.js";
export {
  createRecentJobsStatePort,
} from "./domain/recent-jobs/state.js";
export {
  buildRecentJobsSummaryViewModel,
} from "./domain/recent-jobs/summary-view-model.js";
export { loadFirstRecentJobImage } from "./domain/card/recent-job-card-image-loader.js";

// 卡片渲染计数：供 recent-jobs-library-component 测试验证渲染隔离，
// 原经已删除的 RecentJobCard 兼容层转出。
export {
  getCardRenderCountForTests,
  resetCardRenderCountsForTests,
} from "./ui/shell/BookCard.jsx";
