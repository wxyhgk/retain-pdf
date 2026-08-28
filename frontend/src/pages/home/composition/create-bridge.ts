// 3b Cầu gọi lại：job-runtime / idle-reset / upload Giao diện hẹp dùng chung。
// statusDetail Được tạo trên các miền tiếp theo，thông qua holder Lazy Reading。

import { buildJobWarningViewModel } from "./external.js";
import type { HomeBridge, HomeFeatures, StatusDetailHolder } from "./types.js";

export function createBridge({
  textStore,
  statusArea,
  workflowView,
  uploadView,
  uploadStatePort,
  features,
  statusDetail,
}: {
  textStore: { setText: HomeBridge["setText"] };
  statusArea: { setWorkflowSections: (job?: unknown) => void };
  workflowView: {
    setJobWarningVisible: (v: boolean) => void;
    setSubmitBusy: (busy: boolean) => void;
    setSubmitDisabled: (disabled: boolean) => void;
  };
  uploadView: {
    resetUploadProgress: () => void;
    resetUploadedFileView: () => void;
  };
  uploadStatePort: { reset: () => void };
  features: HomeFeatures;
  statusDetail: StatusDetailHolder;
}): HomeBridge {
  const setText = textStore.setText;

  return {
    setText,
    setWorkflowSections: (job = null) => statusArea.setWorkflowSections(job),
    updateJobWarning: (status) => workflowView.setJobWarningVisible(
      buildJobWarningViewModel(status).active,
    ),
    resetUploadProgress: () => uploadView.resetUploadProgress(),
    resetUploadedFile: () => {
      uploadStatePort.reset();
      workflowView.setSubmitDisabled(true);
      uploadView.resetUploadedFileView();
    },
    applyWorkflowMode: () => features.workflowFeature.applyWorkflowMode(),
    renderPageRangeSummary: () => features.uploadFeature.renderPageRangeSummary(),
    setSubmitBusy: (busy) => workflowView.setSubmitBusy(busy),
    setLinearProgress: () => {},
    updateActionButtons: () => {},
    resetEventsList: () => {},
    activateDetailTab: (name = "overview") => {
      statusDetail.store.actions.resetOverview();
      statusDetail.store.actions.resetTranslation();
      if (statusDetail.dialogStore.getState().open) {
        statusDetail.dialogStore.open({ activeTab: name || "overview" });
      }
    },
    submitForm: (event) => {
      event?.preventDefault?.();
      return features.appActionsFeature.submitForm(event);
    },
  };
}
