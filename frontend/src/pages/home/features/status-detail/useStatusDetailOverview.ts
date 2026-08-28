// Mặt lắp ráp duy nhất của họ StatusDetailDialog (bản thiết kế §1.2) — gấp miền
// statusDetail của composition.js (services.statusDetail:{store, dialogStore, controller})
// thành một hook, component chỉ đăng ký lát cắt cần, không lặp lại khuôn
// useStoreSnapshot/useDialogState (giống tiền lệ useCredentialsController.js).

import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogState } from "../../state/use-dialog-state.js";
import type {
  StatusDetailOverview,
  StatusDetailState,
  StatusDetailStore,
  StatusDetailTranslation,
} from "./status-detail-store.js";
import type {
  StatusDetailDialogPayload,
  StatusDetailDialogStore,
} from "./status-detail-dialog-store.js";
import type { DialogState } from "../../state/dialog-store.js";

/** Bề mặt controller (phương thức JSX gọi trực tiếp) */
export type StatusDetailControllerApi = {
  openStatusDetailDialog: (tabName?: string) => void;
  activateDetailTab: (tabName?: string) => void;
  applyTranslationFilter?: (...args: unknown[]) => unknown;
  changeTranslationPage?: (...args: unknown[]) => unknown;
  loadTranslationItem?: (...args: unknown[]) => unknown;
  selectTranslationItem?: (...args: unknown[]) => unknown;
  replayTranslationItem?: (...args: unknown[]) => unknown;
  replayCurrentItem?: (...args: unknown[]) => unknown;
  rerunCurrentJob?: () => Promise<unknown> | unknown;
  ensureOverviewData?: (options?: { force?: boolean }) => Promise<unknown> | unknown;
  ensureTranslationData?: (options?: { force?: boolean }) => Promise<unknown> | unknown;
  syncRerunAction?: (statusText?: string) => unknown;
  buildDetailPageUrl?: (jobId: string) => string;
  [key: string]: unknown;
};

export type StatusDetailOverviewHook = {
  open: boolean;
  activeTab: string;
  overview: StatusDetailOverview;
  translation: StatusDetailTranslation;
  rerunPending: boolean;
  controller: StatusDetailControllerApi;
  dialogStore: StatusDetailDialogStore;
};

export function useStatusDetailOverview(): StatusDetailOverviewHook {
  const services = useHomeServices();
  const { store, dialogStore, controller } = services.statusDetail as {
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
    controller,
    dialogStore,
  };
}
