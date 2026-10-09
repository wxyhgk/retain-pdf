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
      // 订阅建立时先把缓存对齐一次:缓存唯一的写入点在下面的监听回调里,
      // 所以一个 store 的订阅者全部卸载后,对它的写入会走 notify() 空转
      // (listener 集合为空),缓存停在卸载那一刻的旧快照。重新挂载时
      // getSnapshot() 读到过期值,首屏渲染上一次的残留(实测:上传弹窗关掉后
      // resetUploadSession() 恰好落在这段无订阅者的空窗期,再打开时卡片还显示
      // 上一份文件名,而业务逻辑读 store 真值,两边对不上)。
      // 这次刷新发生在挂载的 layout effect 里(两次 render 之间,不是同一次
      // render 内),不破坏 getSnapshot 在单次 render 内的引用稳定性;
      // useSyncExternalStore 订阅后会自查 getSnapshot 是否变化,变了就在 paint
      // 之前补一次渲染,所以用户看不到闪帧。
      snapshotCache.set(store, store.getSnapshot());
      return store.subscribe((snapshot) => {
        snapshotCache.set(store, snapshot);
        onStoreChange();
      });
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
