// statusCard / statusDetail / artifact-download busy。

import { API_PREFIX } from "@/platform/config/api-constants.js";
import { PROTECTED_ARTIFACT_SELECTOR } from "@/platform/contracts/download-action-contract.js";
import {
  fetchJobPayload,
  fetchJobEvents,
  fetchJobDiagnostics,
  fetchJobStageActions,
  fetchResumePlan,
  rerunJob,
  fetchTranslationDiagnostics,
  fetchTranslationItems,
  fetchTranslationItem,
  replayTranslationItem,
  resolveOcrAmbiguity,
  retryJobStage,
} from "@/platform/api/index.js";
import { copyText } from "@/platform/utils/clipboard.js";
import {
  currentJobStoreFor,
  secondaryResourceStoreFor,
} from "@/features/jobs/index.js";
import { createArtifactDownloadBusyStore } from "@/features/artifacts/index.js";
import { createStatusCardStore, createStatusCardPresenter } from "@/features/jobs/index.js";
import { createStatusDetailStore } from "@/features/job-detail/index.js";
import { createStatusDetailDialogStore } from "@/features/job-detail/index.js";
import { createStatusDetailRuntimePort } from "@/features/job-detail/index.js";
import { createStatusDetailController } from "@/features/job-detail/index.js";
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
      options?: { apiPrefix?: string } | string,
    ) => Promise<import("@retainpdf/domain/job").JobLike | import("@retainpdf/domain/job").JobPayload | null | undefined>,
    fetchJobEvents: fetchJobEvents as (
      jobId: string,
      apiPrefix?: string,
      limit?: number,
      offset?: number,
    ) => Promise<import("@retainpdf/domain/job-status").EventsPayload | null | undefined>,
    fetchJobDiagnostics,
    fetchResumePlan,
    fetchJobStageActions,
    fetchTranslationDiagnostics,
    fetchTranslationItems,
    fetchTranslationItem,
    replayTranslationItem,
    resolveOcrAmbiguity,
    retryJobStage,
    copyText,
    rerunJob,
    renderJob: statusCardPresenter.renderMain,
    startPolling: (jobId: string) => features.jobRuntimeFeature?.startPolling(jobId),
    setText,
    store: statusDetailStore,
    dialogStore: statusDetailDialogStore,
  });

  // 阅读已改为跳转独立 reader.html，主页不再挂 iframe 对话框；
  // isReaderOpen 恒为 false，job-runtime 的 sync/close 钩子成为 no-op。
  const jobRuntimeShellViewPort = {
    closeDialogs: () => statusDetailDialogStore.close(),
    isReaderOpen: () => false,
    resetEvents: () => bridge.resetEventsList(),
    setCancelDisabled: (disabled: boolean) => statusCardStore.actions.setCancelDisabled(disabled),
  };

  // 取消当前任务的业务内聚到 status 域，不再由 build-home-services 拼闭包
  const statusCardController = {
    cancelCurrentJob: () => (features.jobRuntimeFeature as { cancelCurrentJob?: () => unknown } | undefined)?.cancelCurrentJob?.(),
  };

  const artifactDownloadBusyStore = createArtifactDownloadBusyStore();
  const artifactDownloadsViewPort = {
    bindProtectedLinks(handler: (event: Event, link: Element) => void) {
      const onProtectedLinkClick = (event: Event) => {
        const target = event.target as Element | null;
        const link = target?.closest?.(PROTECTED_ARTIFACT_SELECTOR);
        if (!link) return;
        handler(event, link);
      };
      documentRef.addEventListener("click", onProtectedLinkClick);
      return () => documentRef.removeEventListener("click", onProtectedLinkClick);
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
    currentJobStore,
    secondaryResourceStore,
    statusCardStore,
    statusCardPresenter,
    statusCardController,
    statusDetailStore,
    statusDetailDialogStore,
    statusDetailController,
    jobRuntimeShellViewPort,
    artifactDownloadBusyStore,
    artifactDownloadsViewPort,
  };
}
