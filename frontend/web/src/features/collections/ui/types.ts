// CollectionsView 的对外依赖契约：与视图渲染分离，子组件只依赖这里，
// 避免通过主文件回引形成耦合。
import type { DialogStore } from "@/platform/store/dialog-store.js";
import type { LibraryActions } from "@/features/library/index.js";
import type { CollectionRecord } from "../domain/controller.js";

/** 版本信号的快照：只有一个 version 字段，每次保存/删除后 bump。 */
export type CollectionsReloadSnapshot = { version: number };

/** 由页面注入：合集域的三件依赖 + 图书馆的跳转动作。 */
export type CollectionsController = ReturnType<
  typeof import("../domain/controller.js").createCollectionsController
>;

// TODO(feature-layout 批次 5): dialog-store / use-dialog-state 是通用状态工具，
// 随批次 5 迁入 platform 后改指。
export type CollectionsDialogStore = DialogStore<CollectionRecord | null>;

export type CollectionsReloadSignal = {
  actions: Record<string, (...args: unknown[]) => unknown>;
  getSnapshot: () => CollectionsReloadSnapshot;
  subscribe: (listener: (snapshot: CollectionsReloadSnapshot) => void) => () => void;
};

/** 合集视图借用的书架动作（就是书架那几个，签名一致）。 */
export type CollectionsLibraryActions = Pick<
  LibraryActions,
  "openBookDetail" | "openJobReader" | "openSourceReader" | "selectJob"
>;

export type CollectionsViewProps = {
  controller: CollectionsController;
  dialogStore: CollectionsDialogStore;
  reloadSignal: CollectionsReloadSignal;
  libraryActions: CollectionsLibraryActions;
};
