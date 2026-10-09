// 开发者设置对话框的三个动作：从状态同步、保存、重置。
//
// 读取弹窗值经 viewPort.readDeveloperDialog，组装交回纯函数
// buildDeveloperConfigFromDialog / defaultDeveloperDialogReadOptions；
// 持久化与模式刷新通过注入的回调完成。

import {
  buildDeveloperConfigFromDialog,
  defaultDeveloperDialogReadOptions,
} from "./developer-dialog.js";
import type { WorkflowViewPortLike } from "./contracts.js";
import type { WorkflowConfigDefaults } from "./developer-config.js";
import type { WorkflowDeveloperConfig } from "./payload.js";

export interface GlossaryOptionsLoaderLike {
  applyOptions: (selectedId?: string) => void;
}

export interface CreateDeveloperDialogControllerOptions {
  getDeveloperConfig: () => WorkflowDeveloperConfig | Record<string, unknown> | null | undefined;
  developerConfigWithDefaults: () => WorkflowDeveloperConfig;
  defaults: WorkflowConfigDefaults;
  defaultModelName: () => string;
  defaultModelBaseUrl: () => string;
  normalizeWorkflow: (value?: unknown) => string;
  viewPort: WorkflowViewPortLike;
  glossaryOptionsLoader: GlossaryOptionsLoaderLike;
  loadGlossaryOptions: () => void;
  setDeveloperConfig: (config: Record<string, unknown>) => void;
  resetDeveloperConfig: () => void;
  saveDeveloperStoredConfig: (config?: Record<string, unknown>) => unknown;
  updateDeveloperWorkflowFormState: () => void;
  applyWorkflowMode: () => void;
}

export function createDeveloperDialogController({
  getDeveloperConfig,
  developerConfigWithDefaults,
  defaults,
  defaultModelName,
  defaultModelBaseUrl,
  normalizeWorkflow,
  viewPort,
  glossaryOptionsLoader,
  loadGlossaryOptions,
  setDeveloperConfig,
  resetDeveloperConfig,
  saveDeveloperStoredConfig,
  updateDeveloperWorkflowFormState,
  applyWorkflowMode,
}: CreateDeveloperDialogControllerOptions) {
  function syncDeveloperDialogFromState() {
    const config = developerConfigWithDefaults();
    glossaryOptionsLoader.applyOptions(config.glossaryId);
    viewPort.setDeveloperDialog(config);
    updateDeveloperWorkflowFormState();
    void loadGlossaryOptions();
  }

  function saveDeveloperDialog() {
    const currentConfig = developerConfigWithDefaults();
    const values = viewPort.readDeveloperDialog(defaultDeveloperDialogReadOptions({
      defaultModelName,
      defaultModelBaseUrl,
      defaults,
    }));
    setDeveloperConfig(buildDeveloperConfigFromDialog({
      currentConfig,
      values,
      normalizeWorkflow,
    }));
    viewPort.setDeveloperDialog(developerConfigWithDefaults());
    void saveDeveloperStoredConfig(getDeveloperConfig() ?? undefined);
    applyWorkflowMode();
    viewPort.closeDeveloperDialog();
  }

  function resetDeveloperDialog() {
    resetDeveloperConfig();
    void saveDeveloperStoredConfig({});
    syncDeveloperDialogFromState();
    applyWorkflowMode();
  }

  return {
    syncDeveloperDialogFromState,
    saveDeveloperDialog,
    resetDeveloperDialog,
  };
}
