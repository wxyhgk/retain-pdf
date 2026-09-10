// glossaries —— 术语表管理对话框（列表/编辑器/CSV 导入）。
//
// 这是本功能对外的唯一出口：其他功能与页面装配层只能从这里导入，
// 不得深入 ui/ 或 domain/ 内部（架构门禁会拦截）。
//
// ui/     GlossariesDialog 对话框与列表/编辑器/导入面板、打开控制器 hook、DOM id 契约
// domain/ 术语表编排控制器（mountGlossariesFeature）、视图 store 与编辑器端口、
//         CSV 读取 payload（含 preserve 回填语义），全部与 React 无关

export { GlossariesDialog } from "./ui/GlossariesDialog.jsx";
export type { GlossariesDialogProps } from "./ui/GlossariesDialog.jsx";
export { useGlossariesController } from "./ui/useGlossariesController.js";
export type { GlossariesControllerDeps } from "./ui/useGlossariesController.js";
export { GLOSSARY_DOM_IDS } from "./ui/glossaries-dom-ids.js";

export { mountGlossariesFeature } from "./domain/controller.js";
export type { GlossariesFeature } from "./domain/controller.js";
export { createGlossariesViewFeature } from "./domain/glossaries-store.js";
export type {
  GlossariesDialogStorePort,
  GlossariesEditorActions,
  GlossariesEditorPort,
  GlossariesEditorState,
  GlossariesViewActions,
  GlossariesViewFeature,
  GlossariesViewPort,
  GlossariesViewState,
  GlossariesViewStore,
  GlossaryDraft,
  GlossaryEditorPayload,
  GlossaryEntryRow,
  GlossaryListItem,
  HandlersBag,
} from "./domain/glossaries-store.js";
export {
  readEditorPayload,
  readEditorPayloadFromDraft,
} from "./domain/glossaries-store.js";
