// Hook đăng ký React cho drawer store. active của store là chuỗi gốc (tham chiếu ổn định),
// nạp thẳng vào useSyncExternalStore (không có bãi cạn clone snapshot của app-framework/store).

import { useSyncExternalStore } from "react";

export function useDrawerActive(drawerStore) {
  return useSyncExternalStore(
    drawerStore.subscribe,
    drawerStore.getActive,
    drawerStore.getActive,
  );
}
