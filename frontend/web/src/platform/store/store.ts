/**
 * Generic immutable store.
 *
 * Action reducers: `(state: TState, ...args) => TState`
 * Runtime always replaces state with the returned object (no deep merge,
 * no shallow merge of partials): every action must return the complete next
 * state, conventionally built with `{ ...state, ...changes }`.
 *
 * Typed call sites:
 *   createStore<State, Actions>({ initialState, actions })
 * or rely on inference from `initialState` + `actions`.
 *
 * Defaults are `any` so bare `createStore({...})` stays loose when inference
 * cannot pin a shape (and `actions` remains a string-index map).
 */

// 本文件里剩下的 any 是有意的：它们都在「任意函数 / 任意参数表」的泛型约束里。
// 函数参数是逆变的，约束写成 (...args: unknown[]) => unknown 会把所有带具体参数的
// reducer 都拒掉；这是 TypeScript 里给函数类型写上界的标准写法，不是漏掉的类型。
type IsAny<T> = 0 extends 1 & T ? true : false;

/** Action reducer result: the complete next state (whole replacement). */
export type StoreActionResult<TState> = TState;

/** Action reducer: (state, ...args) => complete next state. */
export type StoreAction<TState, TArgs extends any[] = any[]> = (
  state: TState,
  ...args: TArgs
) => StoreActionResult<TState>;

/**
 * Map action reducer map → bound action API (state arg removed; returns snapshot).
 * When TActions is `any`, expose a string-index map so existing call sites keep working.
 */
export type BoundStoreActions<TState, TActions> = IsAny<TActions> extends true
  ? Record<string, (...args: any[]) => TState>
  : {
      [K in keyof TActions]: TActions[K] extends (
        state: any,
        ...args: infer TArgs
      ) => any
        ? (...args: TArgs) => TState
        : never;
    };

export type StoreChangeMeta<TState> = {
  action: string;
  previousState: TState;
  store: string;
};

export type StoreListener<TState> = (
  snapshot: TState,
  meta: StoreChangeMeta<TState>,
) => void;

export type StoreSetState<TState> = (
  updater: TState | ((state: TState) => StoreActionResult<TState>),
  actionName?: string,
) => TState;

export type StoreBatchApi<TState, TActions> = {
  actions: BoundStoreActions<TState, TActions>;
  getSnapshot: () => TState;
  setState: StoreSetState<TState>;
};

export type Store<TState = any, TActions = any> = {
  readonly name: string;
  batch: <TResult = TState>(
    callback: (api: StoreBatchApi<TState, TActions>) => TResult,
  ) => TResult;
  getSnapshot: () => TState;
  setState: StoreSetState<TState>;
  subscribe: (listener: StoreListener<TState>) => () => void;
  reset: (nextState?: TState) => TState;
  actions: Readonly<BoundStoreActions<TState, TActions>>;
};

export type CreateStoreOptions<TState, TActions> = {
  name?: string;
  initialState?: TState;
  actions?: TActions;
};

/**
 * Structural constraint for action maps.
 * Return type is intentionally loose (`any`) so call sites can annotate
 * `state: SomeState` even when `TState` is a narrower inferred object.
 * Documented contract remains the complete next state (whole replacement,
 * conventionally `{ ...state, ...changes }`); partial returns are not merged.
 */
export type StoreActionsConstraint<TState> = Record<
  string,
  (state: TState, ...args: any[]) => any
>;

function freezeSnapshot<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeSnapshot(item))) as T;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    copy[key] = freezeSnapshot(item);
  }
  return Object.freeze(copy) as T;
}

function cloneState<T>(value: T): T {
  // 注意(载荷引用安全):structuredClone 会给 File/Blob 换新身份(内容相同但
  // Object.is 不等),遇到函数/DOM 节点则直接抛 DataCloneError;无 structuredClone
  // 的 JSON 回退更会把 File 拍扁成 {}。因此 File/DOM/函数载荷禁止进这条克隆链,
  // 必须按引用持有——dialog-store/busy-store 的读侧投影(view)即此模式,调用方
  // 原始引用原样返回;本函数行为保持不变,仅作契约说明。
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value ?? null));
}

/**
 * File/Blob 判定工具(载荷引用安全)。
 *
 * 纯新增工具,不改动既有行为。供 dialog/busy 类小 store 在写镜像前判断载荷
 * 是否可进 structuredClone:命中则调用方只把占位写入可克隆 state,真实对象
 * 留在读侧投影里按引用持有,读回时 Object.is 稳定。
 */
export function isFileLike(value: unknown): value is Blob {
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

/**
 * Create a typed store. Defaults stay `any` so existing untyped call sites keep compiling.
 *
 * @example
 * const store = createStore<CounterState, CounterActions>({
 *   initialState: { count: 0 },
 *   actions: {
 *     inc(state, by = 1) {
 *       return { ...state, count: state.count + by };
 *     },
 *   },
 * });
 * store.actions.inc(2); // typed
 */
export function createStore<
  TState = any,
  TActions extends StoreActionsConstraint<TState> = any,
>({
  name = "store",
  initialState = {} as TState,
  actions = {} as TActions,
}: CreateStoreOptions<TState, TActions> = {} as CreateStoreOptions<
  TState,
  TActions
>): Store<TState, TActions> {
  let state = cloneState(initialState);
  const listeners = new Set<StoreListener<TState>>();
  let batchDepth = 0;
  let pendingNotification: {
    action: string;
    previousState: TState;
  } | null = null;

  // 注意(引用稳定):getSnapshot 每次返回全新 frozen clone,直接喂
  // useSyncExternalStore 会无限重渲染(见 shared/react/use-store 的缓存,或
  // dialog-store/busy-store 的稳定投影 view)。行为不变,仅契约说明。
  function getSnapshot(): TState {
    return freezeSnapshot(cloneState(state));
  }

  function notify(actionName: string, previousState: TState) {
    const snapshot = getSnapshot();
    for (const listener of listeners) {
      try {
        listener(snapshot, {
          action: actionName,
          previousState: freezeSnapshot(cloneState(previousState)),
          store: name,
        });
      } catch (error) {
        console.error(`Store "${name}" listener failed:`, error);
      }
    }
  }

  function queueNotification(actionName: string, previousState: TState) {
    if (batchDepth <= 0) {
      notify(actionName, previousState);
      return;
    }
    pendingNotification = {
      action: pendingNotification?.action || actionName,
      previousState: pendingNotification?.previousState || cloneState(previousState),
    };
  }

  function setState(
    updater: TState | ((state: TState) => StoreActionResult<TState>),
    actionName = "setState",
  ): TState {
    const previousState = state;
    const nextState = typeof updater === "function"
      ? (updater as (state: TState) => StoreActionResult<TState>)(cloneState(state))
      : updater;
    if (!nextState || typeof nextState !== "object") {
      throw new TypeError(`Store "${name}" action "${actionName}" must return an object state.`);
    }
    state = cloneState(nextState as TState);
    queueNotification(actionName, previousState);
    return getSnapshot();
  }

  const boundActions = {} as BoundStoreActions<TState, TActions>;
  for (const [actionName, action] of Object.entries(actions || {})) {
    if (typeof action !== "function") {
      continue;
    }
    (boundActions as Record<string, (...args: any[]) => TState>)[actionName] = (
      ...args: any[]
    ) => setState(
      (draft) => (action as StoreAction<TState>)(draft, ...args),
      actionName,
    );
  }

  function subscribe(listener: StoreListener<TState>) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function reset(nextState: TState = initialState) {
    return setState(cloneState(nextState), "reset");
  }

  // batch 只合并同步回调内的写入：回调返回后（finally）即结算一次通知，
  // async 回调跨 await 后的写入走出合并，各自单独通知。需要跨 await 合并
  // 请分段 batch 或接受多次通知。
  function batch<TResult = TState>(
    callback: (api: StoreBatchApi<TState, TActions>) => TResult,
  ): TResult {
    if (typeof callback !== "function") {
      return getSnapshot() as unknown as TResult;
    }
    batchDepth += 1;
    try {
      return callback({
        actions: boundActions,
        getSnapshot,
        setState,
      });
    } finally {
      batchDepth -= 1;
      if (batchDepth === 0 && pendingNotification) {
        const notification = pendingNotification;
        pendingNotification = null;
        notify(notification.action, notification.previousState);
      }
    }
  }

  return Object.freeze({
    name,
    batch,
    getSnapshot,
    setState,
    subscribe,
    reset,
    actions: Object.freeze(boundActions),
  });
}
