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

const snapshotCache = new WeakMap();

function cachedSnapshot(store) {
  if (!snapshotCache.has(store)) {
    snapshotCache.set(store, store.getSnapshot());
  }
  return snapshotCache.get(store);
}

export function shallowEqual(a, b) {
  if (Object.is(a, b)) {
    return true;
  }
  if (!a || !b || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every((key) => Object.is(a[key], b[key]));
}

export function useStoreSnapshot(store, selector = null, isEqual = shallowEqual) {
  const selectionRef = useRef({ hasValue: false, value: null });

  const subscribe = useCallback(
    (onStoreChange) => store.subscribe((snapshot) => {
      snapshotCache.set(store, snapshot);
      onStoreChange();
    }),
    [store],
  );

  const getSnapshot = useCallback(() => {
    const snapshot = cachedSnapshot(store);
    if (typeof selector !== "function") {
      return snapshot;
    }
    const next = selector(snapshot);
    const previous = selectionRef.current;
    if (previous.hasValue && isEqual(previous.value, next)) {
      return previous.value;
    }
    selectionRef.current = { hasValue: true, value: next };
    return next;
  }, [store, selector, isEqual]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
