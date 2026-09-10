// GlossariesDialog 家族(GlossariesDialog/GlossaryList/GlossaryEditor/
// GlossaryImportPanel)的唯一装配面(镜像 useCredentialsController.js)。
//
// 视图依赖由调用方注入，而不是从页面的服务上下文里自取：
// 功能不应反向依赖某个具体页面的装配层(app/home)。
// 主页在 HomeApp 的挂载点把 services.glossaries 拆开传进来
// （见 HomeApp 的 GlossariesDialogSlot，镜像 AppUpdateBannerSlot）。
//
// 打开触发:SettingsHubDialog"词表"tab 的 #glossary-btn 直接调
// services.glossaries.dialogStore.open()(蓝图 §0.4 占位调用点,composition
// 就位后即生效),不经 APP_EVENTS——页面侧的 Slot 把 dialogStore 的 open 状态
// 读成 open prop 传进来，本 hook 用一个 open 状态迁移 effect 把"对话框被打开"
// 这件事接回 controller.js 的 open()(内部会 openDialog() + reloadGlossaries()),
// 语义等价旧世界"点击词表按钮 → open()"的单一入口,不需要改
// SettingsHubDialog.jsx 的既有占位调用。
//
// 旧 refreshGlossaries 事件已删（0 生产派发）：外部刷新直接调 handlers.reload()。

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import type { GlossariesFeature } from "../domain/controller.js";
import type { GlossariesViewFeature } from "../domain/glossaries-store.js";
const EMPTY_EDITOR_SNAPSHOT = Object.freeze({
  draft: Object.freeze({ name: "", entries: Object.freeze([]) }),
  csvText: "",
});

/** 调用方（页面侧 Slot）注入的 glossaries 域装配：feature 控制器、view 端口与 open。 */
export type GlossariesControllerDeps = {
  feature?: GlossariesFeature | null;
  view: GlossariesViewFeature;
  open: boolean;
};

export function useGlossariesController({ feature, view, open }: GlossariesControllerDeps) {
  const viewState = useStoreSnapshot(view.store);
  const handlers = view.handlersRef.current;

  // draft/csvText 已移出 store(ref + editor 订阅,见 glossaries-store.js):
  // 这里订阅 editor 并把 draft/csvText 合并回 view,调用方(GlossariesDialog)
  // 的 view.draft / view.csvText / store.actions.* 契约保持不变。
  const editorPort = view.editor;
  const editorState = useSyncExternalStore(
    (onChange) => (editorPort ? editorPort.subscribe(() => onChange()) : () => {}),
    () => (editorPort ? editorPort.getSnapshot() : EMPTY_EDITOR_SNAPSHOT) as {
      draft: unknown;
      csvText: string;
    },
  );
  const mergedView = { ...viewState, draft: editorState.draft, csvText: editorState.csvText };
  const storeActions = (view.store as unknown as { actions?: Record<string, unknown> }).actions ?? {};
  const mergedStore = editorPort
    ? { ...view.store, actions: { ...storeActions, ...editorPort.actions } }
    : view.store;

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // controller.js 的 open() = openDialog()(dialogStore.open() 幂等) +
      // "正在读取术语表..." 状态 + reloadGlossaries() + 清空/错误状态,一次性
      // 复用,不在这里重新拼一遍等价逻辑。
      void feature?.open?.();
    }
    wasOpenRef.current = open;
  }, [open, feature]);

  return {
    view: mergedView,
    store: mergedStore,
    handlers,
  };
}
