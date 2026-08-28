// statusCard / statusDetail / artifact-download busy。

import {
  API_PREFIX,
  currentJobStoreFor,
  secondaryResourceStoreFor,
  fetchJobPayload,
  fetchJobEvents,
  fetchJobDiagnostics,
  fetchResumePlan,
  rerunJob,
  fetchTranslationDiagnostics,
  fetchTranslationItems,
  fetchTranslationItem,
  replayTranslationItem,
  PROTECTED_ARTIFACT_SELECTOR,
} from "./external.js";
import { createArtifactDownloadBusyStore } from "../state/artifact-download-busy-store.js";
import { createStatusCardStore, createStatusCardPresenter } from "../features/status/status-card-store.js";
import { createStatusDetailStore } from "../features/status-detail/status-detail-store.js";
import { createStatusDetailDialogStore } from "../features/status-detail/status-detail-dialog-store.js";
import { createStatusDetailRuntimePort } from "../features/status-detail/status-detail-runtime-port.js";
import { createStatusDetailController } from "../features/status-detail/status-detail-controller.js";
import type { HomeFeatures, StatusDetailHolder } from "./types.js";

type CreateStatusDomainArgs = {
  features: HomeFeatures;
  documentRef: Document;
  bridge: { resetEventsList: () => void };
  setText: (id: string, value?: string) => void;
  statusDetailHolder: StatusDetailHolder;
};

export function createStatusDomain({
  features,
  documentRef,
  bridge,
  setText,
  statusDetailHolder,
}: CreateStatusDomainArgs) {
  const jobRuntimeState: Record<string, unknown> = {};
  const currentJobStore = currentJobStoreFor(jobRuntimeState);
  const secondaryResourceStore = secondaryResourceStoreFor(jobRuntimeState);
  const statusCardStore = createStatusCardStore();
  const statusCardPresenter = createStatusCardPresenter({
    state: jobRuntimeState,
    currentJobStore,
    secondaryResourceStore,
    statusCardStore,
  });

  const statusDetailStore = createStatusDetailStore();
  const statusDetailDialogStore = createStatusDetailDialogStore();
  statusDetailHolder.store = statusDetailStore;
  statusDetailHolder.dialogStore = statusDetailDialogStore;

  const statusDetailController = createStatusDetailController({
    runtimePort: createStatusDetailRuntimePort(jobRuntimeState),
    apiPrefix: API_PREFIX,
    fetchJobPayload: fetchJobPayload as (
      jobId: string,
      apiPrefix?: string,
    ) => Promise<import("../../../js/job/types.js").JobLike | import("../../../js/job/types.js").JobPayload | null | undefined>,
    fetchJobEvents: fetchJobEvents as (
      jobId: string,
      apiPrefix?: string,
      limit?: number,
      offset?: number,
    ) => Promise<import("../../../js/job-status/types.js").EventsPayload | null | undefined>,
    fetchJobDiagnostics,
    fetchResumePlan,
    fetchTranslationDiagnostics,
    fetchTranslationItems,
    fetchTranslationItem,
    replayTranslationItem,
    rerunJob,
    renderJob: statusCardPresenter.renderMain,
    startPolling: (jobId: string) => features.jobRuntimeFeature?.startPolling(jobId),
    setText,
    store: statusDetailStore,
    dialogStore: statusDetailDialogStore,
  });

  // Khả năng đọc đã thay đổi thành nhảy độc lập reader.html，Trang chủ không còn bị treo iframe Hộp thoại；
  // isReaderOpen Liên tục false，job-runtime của sync/close Móc trở thành no-op。
  const jobRuntimeShellViewPort = {
    closeDialogs: () => statusDetailDialogStore.close(),
    isReaderOpen: () => false,
    resetEvents: () => bridge.resetEventsList(),
    setCancelDisabled: (disabled: boolean) => statusCardStore.actions.setCancelDisabled(disabled),
  };

  const artifactDownloadBusyStore = createArtifactDownloadBusyStore();
  const artifactDownloadsViewPort = {
    bindProtectedLinks(handler: (event: Event, link: Element) => void) {
      documentRef.addEventListener("click", (event) => {
        const target = event.target as Element | null;
        const link = target?.closest?.(PROTECTED_ARTIFACT_SELECTOR);
        if (!link) return;
        handler(event, link);
      });
    },
    isLinkDisabled(link: Element) {
      const domDisabled = link.getAttribute("aria-disabled") === "true"
        || link.classList.contains("disabled");
      return domDisabled || artifactDownloadBusyStore.isBusy(link.id || "");
    },
    setLinkBusy(link: Element, busy: boolean, text = "") {
      artifactDownloadBusyStore.setBusy(link.id || "", busy, text);
    },
  };

  return {
    jobRuntimeState,
    statusCardStore,
    statusCardPresenter,
    statusDetailStore,
    statusDetailDialogStore,
    statusDetailController,
    jobRuntimeShellViewPort,
    artifactDownloadBusyStore,
    artifactDownloadsViewPort,
  };
}
