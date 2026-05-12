import { resetMissingUploadState, setSubmitBusy } from "./view.js";

export function mountAppActionsFeature({
  state,
  apiBase,
  apiPrefix,
  buildApiEndpoint,
  isMockMode,
  openSetupDialog,
  renderJob,
  setText,
  submitJobRequest,
  openDesktopOutputDirectory,
  resetUploadedFile,
  currentWorkflow,
  workflowNeedsCredentials,
  workflowNeedsUpload,
  currentRenderSourceJobId,
  collectRunPayload,
  getBrowserCredentialsFeature,
  getJobRuntimeFeature,
}) {
  function isMissingUploadError(error) {
    const message = `${error?.message || error || ""}`;
    return message.includes("upload not found");
  }

  function handleMissingUploadError() {
    resetMissingUploadState({ state, resetUploadedFile, setText });
  }

  async function submitForm(event) {
    event.preventDefault();
    const workflow = currentWorkflow();
    if (isMockMode()) {
      setSubmitBusy(true);
      setText("error-box", "-");
      try {
        const payload = await submitJobRequest(apiPrefix, { workflow, source: {}, mock: true });
        state.currentJobStartedAt = new Date().toISOString();
        state.currentJobFinishedAt = "";
        renderJob(payload);
        getJobRuntimeFeature()?.startPolling(payload.job_id);
      } catch (err) {
        setText("error-box", err.message);
      } finally {
        setSubmitBusy(false);
      }
      return;
    }
    if (state.desktopMode && !state.desktopConfigured && workflowNeedsCredentials(workflow)) {
      openSetupDialog();
      setText("error-box", "请先完成首次配置。");
      return;
    }
    if (workflowNeedsUpload(workflow) && !state.uploadId) {
      setText("error-box", "请先选择并上传 PDF 文件");
      return;
    }
    if (!workflowNeedsUpload(workflow) && !currentRenderSourceJobId()) {
      setText("error-box", "请先在开发者设置里填写 Render 源任务 ID。");
      return;
    }
    if (workflowNeedsCredentials(workflow) && !(await getBrowserCredentialsFeature()?.ensureOcrCredentialsReady({
      onMissingToken: () => {
        setText("error-box", "请先填写当前 OCR Provider 凭证。");
        if (!state.desktopMode) {
          getBrowserCredentialsFeature()?.openBrowserCredentialsDialog();
        }
      },
      onInvalidToken: (result) => {
        setText("error-box", result.summary || "OCR Provider 凭证校验未通过。");
        if (!state.desktopMode) {
          getBrowserCredentialsFeature()?.openBrowserCredentialsDialog();
        }
      },
    }))) {
      return;
    }

    setSubmitBusy(true);
    setText("error-box", "-");

    try {
      const runPayload = collectRunPayload();
      const payload = await submitJobRequest(apiPrefix, runPayload);
      state.currentJobStartedAt = new Date().toISOString();
      state.currentJobFinishedAt = "";
      renderJob(payload);
      getJobRuntimeFeature()?.startPolling(payload.job_id);
    } catch (err) {
      if (isMissingUploadError(err)) {
        handleMissingUploadError();
        return;
      }
      setText("error-box", err.message);
    } finally {
      setSubmitBusy(false);
    }
  }

  async function checkApiConnectivity() {
    try {
      const resp = await fetch(buildApiEndpoint("", "health"));
      if (!resp.ok) {
        throw new Error(`health ${resp.status}`);
      }
      return true;
    } catch (_err) {
      const message = `当前前端无法连接后端。API Base: ${apiBase()}。请确认本地服务已经启动，然后重试。`;
      setText("error-box", message);
      throw new Error(message);
    }
  }

  async function handleOpenOutputDir() {
    try {
      await openDesktopOutputDirectory();
    } catch (err) {
      setText("error-box", err.message || String(err));
    }
  }

  return {
    checkApiConnectivity,
    handleOpenOutputDir,
    submitForm,
  };
}
