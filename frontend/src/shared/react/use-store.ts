// Hook thích ứng cho app-framework/store → React.
//
// Lưu ý (thực tế): store.getSnapshot() trả về một frozen clone mới mỗi khi gọi (tham chiếu không ổn định),
// nếu dùng trực tiếp làm getSnapshot của useSyncExternalStore sẽ gây re-render vô hạn.
// Giải pháp: Cache snapshot đi kèm với thông báo subscribe (notify() chỉ tạo một bản cho tất cả listener),
// getSnapshot chỉ đọc cache; lần đầu đọc sẽ gọi store.getSnapshot() để khởi tạo.
//
// Hỗ trợ selector: Cache kết quả selector bằng so sánh nông (shallow compare), với các snapshot lớn
// bị polling tần suất cao (recent-jobs), component chỉ re-render khi slice được chọn thực sự thay đổi.

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
