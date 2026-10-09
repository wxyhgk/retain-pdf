// StatusDetailDialog 家族的唯一装配面(蓝图 §1.2)——把 composition.js 的
// statusDetail 域(services.statusDetail:{store, dialogStore, controller})
// 折成一个 hook,组件只订阅需要的切片,不各自重复 useStoreSnapshot/
// useDialogState 样板(镜像 useCredentialsController.js 的先例)。

import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import type { DialogState } from "@/platform/store/dialog-store.js";
import { useHomeStatusDetail } from "@/ui/context/home-services-context.js";
import { useDialogState } from "@/ui/hooks/use-dialog-state.js";
import type {
  StatusDetailOverview,
  StatusDetailState,
  StatusDetailStore,
  StatusDetailTranslation,
} from "../domain/status-detail-store.js";
import type {
  StatusDetailDialogPayload,
  StatusDetailDialogStore,
} from "../domain/status-detail-dialog-store.js";
import type { StatusDetailController } from "../domain/status-detail-controller.js";

/** controller 表面（JSX 直接调用的方法）——与 createStatusDetailController 的返回值一致 */
export type StatusDetailControllerApi = StatusDetailController;

export type StatusDetailOverviewHook = {
  open: boolean;
  activeTab: string;
  overview: StatusDetailOverview;
  translation: StatusDetailTranslation;
  rerunPending: boolean;
  ocrAmbiguityPending: boolean;
  controller: StatusDetailControllerApi;
  dialogStore: StatusDetailDialogStore;
};

export function useStatusDetailOverview(): StatusDetailOverviewHook {
  const { store, dialogStore, controller } = useHomeStatusDetail() as {
    store: StatusDetailStore;
    dialogStore: StatusDetailDialogStore;
    controller: StatusDetailControllerApi;
  };
  const dialogState = useDialogState(dialogStore) as DialogState<StatusDetailDialogPayload>;
  const snapshot = useStoreSnapshot(store) as StatusDetailState;

  return {
    open: Boolean(dialogState.open),
    activeTab: dialogState.payload?.activeTab || "overview",
    overview: snapshot.overview,
    translation: snapshot.translation,
    rerunPending: Boolean(snapshot.rerunPending),
    ocrAmbiguityPending: Boolean(snapshot.ocrAmbiguityPending),
    controller,
    dialogStore,
  };
}
