// 3b 回调桥：job-runtime / idle-reset / upload 共用的窄接口。
// statusDetail 在后续域才创建，通过 holder 惰性读。
// 启动顺序中的位置：composition 内建好（state/view 就绪后、各域之前），
// 被 lifecycle.initializeIdleView 与各域经端口消费；自身无 initialize/dispose。

import { buildJobWarningViewModel } from "@retainpdf/domain/job";
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
