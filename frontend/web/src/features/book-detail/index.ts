// book-detail —— 书籍详情弹窗：打开一本书后的总览、处理（OCR/翻译）、
// 产物中心、合集与元数据管理五个 tab。
//
// 这是本功能对外的唯一出口。
// ui/     弹窗容器、shell/tabs/panels/artifacts 四层视图，以及各 tab 的数据 hook
// domain/ 产物中心的分组/链接模型（纯类型与逻辑，无 React）

export { BookDetailDialog } from "./ui/BookDetailDialog.jsx";
export { BookDetailShell } from "./ui/shell/BookDetailShell.jsx";
export {
  BOOK_DETAIL_TABS,
  BookDetailArtifactsTab,
  BookDetailManageTab,
  BookDetailOverviewTab,
  BookDetailProcessingTab,
  BookDetailRightTabs,
} from "./ui/tabs/index.js";
export type {
  ArtifactCenterGroupId,
  ArtifactCenterItem,
  ArtifactCenterSection,
  ArtifactLinks,
  ArtifactManifest,
  ArtifactManifestItem,
  ArtifactResourceLink,
} from "./domain/artifact-center-model.js";
