// collections —— 合集：把书归入自定义分组，并在合集 tab 内浏览。
//
// 这是本功能对外的唯一出口。
// ui/     合集 tab 视图、新建/编辑合集弹窗
// domain/ 合集的增删改查与书目拉取编排

export { CollectionsView } from "./ui/CollectionsView.jsx";
export type { CollectionsViewProps } from "./ui/CollectionsView.jsx";
export { CollectionManageDialog } from "./ui/CollectionManageDialog.jsx";
export type { CollectionManageDialogProps } from "./ui/CollectionManageDialog.jsx";
export { createCollectionsController } from "./domain/controller.js";
export type { CollectionRecord } from "./domain/controller.js";
export type {
  CollectionsController,
  CollectionsDialogStore,
  CollectionsLibraryActions,
  CollectionsReloadSignal,
} from "./ui/CollectionsView.jsx";
