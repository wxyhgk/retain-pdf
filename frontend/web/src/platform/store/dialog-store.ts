// 通用对话框开合状态工厂(蓝图 §0.3)——CredentialsDialog/GlossariesDialog/
// AppUpdate 详情/SettingsHubDialog 等常驻挂载的 AppDialog 共用同一套语义。
//
// 实现 = createStore 引擎 + 读侧稳定投影(view):
// - 可克隆 state 形状 { open, payload },转移逻辑收敛在
//   actions.openDialog/openDialog·closeDialog/closeDialog 两个 reducer;
// - view 持有调用方 payload 原始引用(不经 structuredClone,File/DOM/函数载荷
//   身份稳定,见 app-framework/store 的 isFileLike 契约),顶层引用只在真实变化
//   时更换,可直接喂 useSyncExternalStore(use-dialog-state/useStoreSnapshot)。
//
// 对话框不是"多选一互斥",而是"单个开合 + 可选负载"(setupMode、初始 tab 等),
// 所以状态形状是 { open, payload } 而不是 drawer 的单一 active 字符串。

import { createStore } from "./store.js";

export type DialogState<T = unknown> = {
  open: boolean;
  payload: T;
};

export type DialogStoreActions<T = unknown> = {
  openDialog(state: DialogState<T>, payload?: T | null): DialogState<T>;
  closeDialog(state: DialogState<T>): DialogState<T>;
};

export type DialogStore<T = unknown> = {
  subscribe: (listener: (state: DialogState<T>) => void) => () => void;
  getState: () => DialogState<T>;
  getSnapshot: () => DialogState<T>;
  open: (payload?: T | null) => DialogState<T>;
  close: () => DialogState<T>;
  actions: {
    openDialog: (payload?: T | null) => DialogState<T>;
    closeDialog: () => DialogState<T>;
  };
};

// File/Blob 顶层载荷禁止进 engine 的 structuredClone 链(会换新身份);
// engine 只留可克隆镜像,真相源永远是按引用持有的 view。
function isFileLikePayload(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return true;
  }
  const candidate = value as {
    arrayBuffer?: unknown;
    slice?: unknown;
    name?: unknown;
    size?: unknown;
  };
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.slice === "function" &&
    (typeof candidate.name === "string" || typeof candidate.size === "number")
  );
}

export function createDialogStore<T = unknown>(initialPayload: T | null = null): DialogStore<T> {
  const initial: DialogState<T> = { open: false, payload: initialPayload as T };
  // 转移逻辑的唯一真相:open(null/undefined) 保持旧 payload;close 已关时幂等。
  const engine = createStore<DialogState<T>, DialogStoreActions<T>>({
    name: "dialog",
    initialState: {
      open: false,
      payload: (isFileLikePayload(initialPayload) ? null : initialPayload) as T,
    },
    actions: {
      openDialog(state, payload = null) {
        if (payload === null || payload === undefined) {
          return state.open ? state : { ...state, open: true };
        }
        return { open: true, payload: payload as T };
      },
      closeDialog(state) {
        if (!state.open) {
          return state;
        }
        return { ...state, open: false };
      },
    },
  });

  let view: DialogState<T> = initial;
  const listeners = new Set<(state: DialogState<T>) => void>();

  function notify() {
    listeners.forEach((listener) => listener(view));
  }

  // engine 为 best-effort 镜像(不可克隆载荷落占位,抛错也不影响真相源 view)。
  function mirrorOpen(payload: T | null) {
    try {
      engine.actions.openDialog(
        isFileLikePayload(payload) ? null : payload,
      );
    } catch {
      /* 镜像同步失败不影响 view 真相源 */
    }
  }

  function mirrorClose() {
    try {
      engine.actions.closeDialog();
    } catch {
      /* 镜像同步失败不影响 view 真相源 */
    }
  }

  function open(payload: T | null = null): DialogState<T> {
    mirrorOpen(payload);
    // 语义与原来一致:open 恒换新引用 + 通知;null/undefined 保持旧 payload 引用。
    view =
      payload === null || payload === undefined
        ? { open: true, payload: view.payload }
        : { open: true, payload: payload as T };
    notify();
    return view;
  }

  function close(): DialogState<T> {
    // 语义与原来一致:已关时同引用返回且不通知。
    if (!view.open) {
      return view;
    }
    mirrorClose();
    view = { open: false, payload: view.payload };
    notify();
    return view;
  }

  return {
    // useSyncExternalStore 兼容:subscribe 返回退订函数
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => view,
    // 稳定投影:与 getState 同一引用(区别于通用 createStore 每次克隆的语义),
    // payload 按调用方引用原样返回。
    getSnapshot: () => view,
    open,
    close,
    actions: {
      openDialog: (payload = null) => open(payload),
      closeDialog: () => close(),
    },
  };
}
