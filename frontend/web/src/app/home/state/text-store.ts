// home 页文本注册表(id → 文案)store。
//
// 旧世界 ui/text.js 的 setText(id, value) 是全局 DOM 写入口;React 世界改为
// 写入本 store,由订阅了对应 id 的组件自行渲染。3a 阶段只有 error-box
// (inline-error-box)消费;status-detail/job-runtime 等 3b 域的 id 先落在
// store 里等占位组件接管——setText 回调接口因此对 3b 保持稳定。
//
// 特例口径(镜像 ui/text.js):"error-box" 的 value 允许是 error-diagnostic
// 对象,展示层用 messageForErrorBox 提取摘要;这里原样存储,由组件解读。

import { createStore, type Store } from "@/platform/store/store.js";
/** error-diagnostics.buildErrorDiagnostic 的返回形状 */
export type ErrorDiagnosticText = {
  kind: "error-diagnostic";
  summary?: string;
  diagnostic?: string;
  [key: string]: unknown;
};

/**
 * 文本槽位值：普通字符串、error-box 诊断对象，或其它展示载荷。
 * 用 unknown 收口，避免 any；ErrorDiagnosticText 供展示层窄化。
 */
export type HomeTextValue = unknown;

export type HomeTextState = {
  texts: Record<string, HomeTextValue>;
};

export type HomeTextActions = {
  set(
    currentState: HomeTextState,
    payload?: { id?: string; value?: HomeTextValue },
  ): HomeTextState;
};

export type HomeTextStore = Store<HomeTextState, HomeTextActions>;

export function createHomeTextStore() {
  const store = createStore<HomeTextState, HomeTextActions>({
    name: "homeTextRegistry",
    initialState: { texts: {} },
    actions: {
      set(currentState, { id, value } = {}) {
        if (!id) {
          return currentState;
        }
        return {
          ...currentState,
          texts: {
            ...currentState.texts,
            [id]: value,
          },
        };
      },
    },
  });

  function setText(id: string, value: HomeTextValue = undefined) {
    if (!id) {
      return;
    }
    store.actions.set({ id, value });
  }

  // selector 帮助函数:配合 useStoreSnapshot(store, selector) 使用
  function textOf(
    snapshot: HomeTextState | null | undefined,
    id: string,
    fallback: HomeTextValue = "",
  ): HomeTextValue {
    const value = snapshot?.texts?.[id];
    return value === undefined ? fallback : value;
  }

  return {
    setText,
    store,
    textOf,
  };
}
