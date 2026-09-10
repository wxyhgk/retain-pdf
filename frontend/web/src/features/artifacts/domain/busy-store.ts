// artifact-downloads busy 态 store(dialogs 蓝图 §7.5 方案二)。
//
// 背景(蓝图 §0.5):artifact-downloads 是 document 级委托点击 + 命令式
// setLinkBusy(旧世界直改 DOM 文本/class)。按钮宿主分布在 recent-jobs 的
// ResultActions.jsx 与本域 StatusDetailDialog.jsx——两者的祖先(StatusCard/
// StatusDetailDialog 本身)都挂在高频轮询/store 更新链路上,若下载中途父组件
// 因无关字段变化重渲染,虚拟 DOM diff 会把命令式写入的"下载中.../37%"文案
// 吃掉、打回按钮原始 label。方案二:setLinkBusy 不再直改 DOM,只写这个 store;
// 按钮组件各自订阅自己的 actionId 分片(ui/use-artifact-download-busy.js),
// label 完全来自 React state,重渲染不会覆盖(因为 state 本身就是最新值)。
//
// 与旧世界 src/features/artifacts/（旧 download-view-port.js 已随 cutover 删除） 的关系:
// 旧文件保持不动(仍供尚未 cutover 的 dist/app.bundle.js 使用,默认 DOM 版
// setLinkBusy 直改真实 <a> 文本)——composition.js 给 React 世界另挂一份
// viewPort 实例,字面量直接实现 3 个方法(不 import 旧 view-port.js/view.js:
// 两者文件名分别匹配 architecture-boundaries.test.mjs 的防回弹正则,
// src/pages/** 禁止导入),setLinkBusy 落这个 store。
//
// 实现 = createStore 引擎 + 读侧稳定投影(view):
// - 可克隆 state 形状 Record<actionId, { busy, label }>,转移逻辑收敛在
//   actions.setBusy/clearBusy 两个 reducer;不含某 actionId 表示当前非 busy;
// - view 只在真正变化时换顶层引用,且 setBusy 对无关 actionId 是纯粹浅 spread,
//   其他键的分片引用原样复用——getActionState 命中未变化的 actionId 时返回同一
//   对象引用,配合 ui/use-artifact-download-busy.js 做到按钮级精确重渲染;
// - 分片全是 { busy, label } 纯数据(无 File),天然不进 structuredClone 雷区;
//   getSnapshot 返回稳定投影(区别于通用 createStore 每次克隆的语义),可直接喂
//   useSyncExternalStore 而不会触发无限重渲染。

import { createStore } from "@/platform/store/store.js";

export type ArtifactBusySlice = {
  busy: boolean;
  label: string;
};

export type ArtifactDownloadBusyState = Record<string, ArtifactBusySlice>;

export type ArtifactDownloadBusyActions = {
  setBusy(
    state: ArtifactDownloadBusyState,
    actionId: string,
    busy: boolean,
    label?: string,
  ): ArtifactDownloadBusyState;
  clearBusy(
    state: ArtifactDownloadBusyState,
    actionId: string,
  ): ArtifactDownloadBusyState;
};

export type ArtifactDownloadBusyStore = {
  subscribe: (listener: (state: ArtifactDownloadBusyState) => void) => () => void;
  getState: () => ArtifactDownloadBusyState;
  getSnapshot: () => ArtifactDownloadBusyState;
  getActionState: (actionId: string) => ArtifactBusySlice;
  setBusy: (actionId: string, busy: boolean, label?: string) => void;
  clearBusy: (actionId: string) => void;
  isBusy: (actionId: string) => boolean;
  actions: {
    setBusy: (actionId: string, busy: boolean, label?: string) => void;
    clearBusy: (actionId: string) => void;
  };
};

const IDLE: ArtifactBusySlice = Object.freeze({ busy: false, label: "" });

function normalizeId(actionId: string): string {
  return `${actionId || ""}`.trim();
}

function omitId(
  state: ArtifactDownloadBusyState,
  id: string,
): ArtifactDownloadBusyState {
  const next = { ...state };
  delete next[id];
  return next;
}

export function createArtifactDownloadBusyStore(): ArtifactDownloadBusyStore {
  // 转移逻辑的唯一真相:空 id 直接返回原引用;clear 缺键时幂等。
  const engine = createStore<
    ArtifactDownloadBusyState,
    ArtifactDownloadBusyActions
  >({
    name: "artifactDownloadBusy",
    initialState: {},
    actions: {
      setBusy(state, actionId, busy, label = "") {
        const id = normalizeId(actionId);
        if (!id) {
          return state;
        }
        if (!busy) {
          if (!(id in state)) {
            return state;
          }
          return omitId(state, id);
        }
        return { ...state, [id]: { busy: true, label: `${label || ""}` } };
      },
      clearBusy(state, actionId) {
        const id = normalizeId(actionId);
        if (!id || !(id in state)) {
          return state;
        }
        return omitId(state, id);
      },
    },
  });

  let view: ArtifactDownloadBusyState = {};
  const listeners = new Set<(state: ArtifactDownloadBusyState) => void>();

  function notify() {
    listeners.forEach((listener) => listener(view));
  }

  function setBusy(actionId: string, busy: boolean, label = ""): void {
    const id = normalizeId(actionId);
    if (!id) {
      return;
    }
    // engine 为 best-effort 镜像;真相源是下面按引用复用分片的 view。
    try {
      engine.actions.setBusy(actionId, busy, label);
    } catch {
      /* 镜像同步失败不影响 view 真相源 */
    }
    if (!busy) {
      if (!(id in view)) {
        return;
      }
      view = omitId(view, id);
      notify();
      return;
    }
    view = { ...view, [id]: { busy: true, label: `${label || ""}` } };
    notify();
  }

  function clearBusy(actionId: string): void {
    const id = normalizeId(actionId);
    if (!id) {
      return;
    }
    try {
      engine.actions.clearBusy(actionId);
    } catch {
      /* 镜像同步失败不影响 view 真相源 */
    }
    if (!(id in view)) {
      return;
    }
    view = omitId(view, id);
    notify();
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
    // 稳定投影:与 getState 同一引用;未变化 actionId 的分片引用同样稳定。
    getSnapshot: () => view,
    // 按 actionId 取一个分片;命中同一 actionId 且未变化时返回同一个对象
    // 引用(setBusy 对不相关的 actionId 是纯粹的浅 spread,不触碰其他键的
    // 值引用)——配合 ui/use-artifact-download-busy.js 做到按钮级精确重渲染。
    getActionState(actionId) {
      return view[normalizeId(actionId)] || IDLE;
    },
    setBusy,
    clearBusy,
    isBusy(actionId) {
      return Boolean(view[normalizeId(actionId)]?.busy);
    },
    actions: {
      setBusy: (actionId, busy, label = "") => setBusy(actionId, busy, label),
      clearBusy: (actionId) => clearBusy(actionId),
    },
  };
}

export const ARTIFACT_DOWNLOAD_BUSY_IDLE = IDLE;
