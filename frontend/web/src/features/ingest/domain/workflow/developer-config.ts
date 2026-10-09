// 开发者配置的归一化解析：把持久化配置叠到运行时默认值上。
//
// 纯读取、无副作用；供模式门禁、对话框保存、载荷组装共用同一份
// developerConfigWithDefaults，避免各处各自拼默认值而漂移。

import { buildDeveloperConfigWithDefaults } from "./rules.js";
import type { WorkflowConstants } from "./contracts.js";
import type { WorkflowDeveloperConfig } from "./payload.js";

export interface WorkflowConfigDefaults {
  workers: number;
  batchSize: number;
  classifyBatchSize: number;
  compileWorkers: number;
  timeoutSeconds: number;
}

export function resolveWorkflowDefaults(
  constants: WorkflowConstants,
): WorkflowConfigDefaults {
  return {
    workers: constants.DEFAULT_WORKERS,
    batchSize: constants.DEFAULT_BATCH_SIZE,
    classifyBatchSize: constants.DEFAULT_CLASSIFY_BATCH_SIZE,
    compileWorkers: constants.DEFAULT_COMPILE_WORKERS,
    timeoutSeconds: constants.DEFAULT_TIMEOUT_SECONDS,
  };
}

export interface CreateDeveloperConfigResolverOptions {
  getDeveloperConfig: () => WorkflowDeveloperConfig | Record<string, unknown> | null | undefined;
  normalizeWorkflow: (value?: unknown) => string;
  normalizeMathMode: (value?: unknown) => string;
  defaults: WorkflowConfigDefaults;
  defaultModelName: () => string;
  defaultModelBaseUrl: () => string;
}

export function createDeveloperConfigResolver({
  getDeveloperConfig,
  normalizeWorkflow,
  normalizeMathMode,
  defaults,
  defaultModelName,
  defaultModelBaseUrl,
}: CreateDeveloperConfigResolverOptions) {
  function developerConfigWithDefaults(): WorkflowDeveloperConfig & { workflow: string } {
    return buildDeveloperConfigWithDefaults({
      saved: getDeveloperConfig(),
      normalizeWorkflow,
      normalizeMathMode,
      defaults,
      defaultModelName,
      defaultModelBaseUrl,
    });
  }

  return { developerConfigWithDefaults };
}
