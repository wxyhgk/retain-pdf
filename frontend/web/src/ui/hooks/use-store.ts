// app-framework/store → React 的适配 hook。
//
// 雷点(实测):store.getSnapshot() 每次调用都返回全新 frozen clone(引用不稳定),
// 直接作为 useSyncExternalStore 的 getSnapshot 会造成无限重渲染。
// 解法:缓存 subscribe 通知时随参携带的快照(notify() 对所有监听器只生成一份),
// getSnapshot 只读缓存;首次读取惰性调一次 store.getSnapshot() 初始化。
//
// selector 支持:对 selector 结果做浅比较缓存,高频轮询的大快照(recent-jobs)
// 只在所选切片真正变化时才触发该组件重渲染。

import { useCallback, useRef, useSyncExternalStore } from "react";

/** 读快照 + 订阅所需的最小 store 形状；platform/store 的 Store 与 DialogStore 都满足。 */
export type SnapshotStore<TState> = {
  getSnapshot(): TState;
  // 快照参数可选：部分 store 的订阅回调不带参数，此时缓存写入的是 undefined（与原行为一致）。
  subscribe(listener: (snapshot?: TState) => void): () => void;
};

type EqualityFn<T> = (a: T, b: T) => boolean;

const snapshotCache = new WeakMap<object, unknown>();
// 每个 store 现在有几个 useStoreSnapshot 在订阅。有人订阅时，缓存由下面的监听回调随 notify 保持最新。
const liveSubscribers = new WeakMap<object, number>();

function cachedSnapshot<TState>(store: SnapshotStore<TState>): TState {
  if (!snapshotCache.has(store)) {
    snapshotCache.set(store, store.getSnapshot());
  }
  // 缓存只由同一个 store 写入（见下方 subscribe），取出的值必然是该 store 的快照类型。
  return snapshotCache.get(store) as TState;
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (!a || !b || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  // 上面已确认是对象，这里只把它当成键值记录读取。
  const recordA = a as Record<string, unknown>;
  const recordB = b as Record<string, unknown>;
  const keysA = Object.keys(recordA);
  const keysB = Object.keys(recordB);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every((key) => Object.is(recordA[key], recordB[key]));
}

export function useStoreSnapshot<TState>(store: SnapshotStore<TState>): TState;
export function useStoreSnapshot<TState, TSelected>(
  store: SnapshotStore<TState>,
  selector: (state: TState) => TSelected,
  isEqual?: EqualityFn<TSelected>,
): TSelected;
export function useStoreSnapshot<TState, TSelected>(
  store: SnapshotStore<TState>,
  selector: ((state: TState) => TSelected) | null = null,
  isEqual: EqualityFn<TSelected> = shallowEqual,
): TState | TSelected {
  const selectionRef = useRef<{ store: SnapshotStore<TState>; value: TSelected } | null>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // 订阅建立时，缓存可能是过期的：缓存唯一的写入点在下面的监听回调里，
      // 一个 store 的订阅者全部卸载后，对它的写入会走 notify() 空转（listener 集合为空），
      // 缓存停在卸载那一刻的旧快照。重新挂载时 getSnapshot() 读到过期值，首屏渲染上一次的残留
      // （实测：上传弹窗关掉后 resetUploadSession() 恰好落在这段无订阅者的空窗期，再打开时卡片还显示
      // 上一份文件名，而业务逻辑读 store 真值，两边对不上）。所以这时要对齐一次。
      //
      // 只在「没有别的订阅者」时对齐：store.getSnapshot() 每次都返回新克隆，以前每个组件订阅都换一次
      // 缓存引用，别的已挂载组件读到「快照变了」就补渲染；哪天某个组件每次 render 都重新订阅
      // （比如 store 是 render 里新建的），就成了订阅→换引用→重渲染→再订阅的死循环，即 React #185。
      // 有别的订阅者时缓存已经由监听回调保持最新，不用动。
      const count = liveSubscribers.get(store) || 0;
      if (count === 0) {
        snapshotCache.set(store, store.getSnapshot());
      }
      liveSubscribers.set(store, count + 1);
      const unsubscribe = store.subscribe((snapshot) => {
        snapshotCache.set(store, snapshot);
        onStoreChange();
      });
      return () => {
        liveSubscribers.set(store, Math.max(0, (liveSubscribers.get(store) || 1) - 1));
        unsubscribe();
      };
    },
    [store],
  );

  const getSnapshot = useCallback((): TState | TSelected => {
    const snapshot = cachedSnapshot(store);
    if (typeof selector !== "function") {
      return snapshot;
    }
    const next = selector(snapshot);
    const previous = selectionRef.current;
    // 同 hook 位换 store 实例时旧选择失效：新旧结果浅相等也不得返回旧 store 对象。
    if (previous && previous.store === store && isEqual(previous.value, next)) {
      return previous.value;
    }
    selectionRef.current = { store, value: next };
    return next;
  }, [store, selector, isEqual]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
