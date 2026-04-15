import { $ } from "../../dom.js";

export function mountAppActionsFeature({
  state,
  apiBase,
  apiPrefix,
  isMockMode,
  openSetupDialog,
  renderJob,
  setText,
  submitJson,
  saveDesktopConfig,
  setDesktopBusy,
  desktopInvoke,
  currentWorkflow,
  workflowNeedsCredentials,
  workflowNeedsUpload,
  currentRenderSourceJobId,
  collectRunPayload,
  getBrowserCredentialsFeature,
  getJobRuntimeFeature,
  onDesktopConfigSaved,
}) {
  async function submitForm(event) {
    event.preventDefault();
    const workflow = currentWorkflow();
    if (isMockMode()) {
      $("submit-btn").disabled = true;
      setText("error-box", "-");
      try {
        const payload = await submitJson(`${apiBase()}${apiPrefix}/jobs`, { workflow, mock: true });
        state.currentJobStartedAt = new Date().toISOString();
        state.currentJobFinishedAt = "";
        renderJob(payload);
        getJobRuntimeFeature()?.startPolling(payload.job_id);
      } catch (err) {
        setText("error-box", err.message);
      } finally {
        $("submit-btn").disabled = false;
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
    if (workflowNeedsCredentials(workflow) && !(await getBrowserCredentialsFeature()?.ensureMineruTokenReady({
      onMissingToken: () => {
        setText("error-box", "请先填写 MinerU Token。");
        if (!state.desktopMode) {
          getBrowserCredentialsFeature()?.openBrowserCredentialsDialog();
        }
      },
      onInvalidToken: (result) => {
        setText("error-box", result.summary || "MinerU Token 校验未通过。");
        if (!state.desktopMode) {
          getBrowserCredentialsFeature()?.openBrowserCredentialsDialog();
        }
      },
    }))) {
      return;
    }

    $("submit-btn").disabled = true;
    setText("error-box", "-");

    try {
      const runPayload = collectRunPayload();
      const payload = await submitJson(`${apiBase()}${apiPrefix}/jobs`, runPayload);
      state.currentJobStartedAt = new Date().toISOString();
      state.currentJobFinishedAt = "";
      renderJob(payload);
      getJobRuntimeFeature()?.startPolling(payload.job_id);
    } catch (err) {
      setText("error-box", err.message);
    } finally {
      $("submit-btn").disabled = false;
    }
  }

  async function checkApiConnectivity() {
    try {
      const resp = await fetch(`${apiBase()}/health`);
      if (!resp.ok) {
        throw new Error(`health ${resp.status}`);
      }
    } catch (_err) {
      setText("error-box", `当前前端无法连接后端。API Base: ${apiBase()}。请确认本地服务已经启动，然后重试。`);
    }
  }

  async function handleDesktopSetupSave() {
    const mineruToken = $("setup-mineru-token").value.trim();
    const modelApiKey = $("setup-model-api-key").value.trim();
    if (!mineruToken || !modelApiKey) {
      setDesktopBusy("请先填写 MinerU Token 和 Model API Key。");
      return;
    }
    setDesktopBusy("正在保存配置并启动服务…");
    try {
      await saveDesktopConfig(mineruToken, modelApiKey, checkApiConnectivity);
      onDesktopConfigSaved?.();
      setDesktopBusy("");
    } catch (err) {
      setDesktopBusy(err.message || String(err));
    }
  }

  async function handleOpenOutputDir() {
    try {
      await desktopInvoke("open_output_directory");
    } catch (err) {
      setText("error-box", err.message || String(err));
    }
  }

  return {
    checkApiConnectivity,
    handleDesktopSetupSave,
    handleOpenOutputDir,
    submitForm,
  };
}
