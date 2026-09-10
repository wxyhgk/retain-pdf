// domain/busy-store.js → React 订阅 hook,按 actionId 取切片
// (蓝图 §7.5 方案二核心机制)。getSnapshot 用 useCallback 缓存,只在
// store/actionId 变化时换函数身份;store.getActionState(actionId) 在该
// actionId 未变化时返回同一个对象引用(IDLE 常量或未改动的 busy 分片),
// 配合 useSyncExternalStore 做到"只有自己的 actionId 变化才重渲染"，
// 不随祖先(StatusCard/StatusDetailDialog)高频轮询重渲染而被覆盖或抖动。

import { useCallback, useSyncExternalStore } from "react";
import type { ArtifactBusySlice, ArtifactDownloadBusyStore } from "../domain/busy-store.js";

export function useArtifactDownloadBusy(
  store: ArtifactDownloadBusyStore,
  actionId: string,
): ArtifactBusySlice {
  const getSnapshot = useCallback(() => store.getActionState(actionId), [store, actionId]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
