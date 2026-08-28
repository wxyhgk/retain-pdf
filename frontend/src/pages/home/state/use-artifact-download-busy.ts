// artifact-download-busy-store.js → hook đăng ký React, lấy lát cắt theo actionId
// (cơ chế cốt lõi phương án hai trong bản thiết kế §7.5). getSnapshot được cache
// bằng useCallback và chỉ đổi identity khi store/actionId thay đổi;
// store.getActionState(actionId) trả cùng tham chiếu object (hằng IDLE hoặc lát
// busy chưa đổi) khi actionId không đổi. Kết hợp useSyncExternalStore để chỉ
// re-render khi actionId của chính nó đổi, không bị polling tần suất cao của
// ancestor (StatusCard/StatusDetailDialog) ghi đè hoặc rung.

import { useCallback, useSyncExternalStore } from "react";
import type { ArtifactBusySlice, ArtifactDownloadBusyStore } from "./artifact-download-busy-store.js";

export function useArtifactDownloadBusy(
  store: ArtifactDownloadBusyStore,
  actionId: string,
): ArtifactBusySlice {
  const getSnapshot = useCallback(() => store.getActionState(actionId), [store, actionId]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
