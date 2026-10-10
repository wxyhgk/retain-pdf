// 首页所有 retry-stage 入口（失败卡片、书籍详情清单、从断点继续、重复风险确认后的翻译重跑、
// 进度卡上的阶段重试）都经这一层，把设置里当前的翻译密钥带上。规则见
// features/credentials/domain/retry-translation-secret.ts。
import { fetchJobPayload, retryJobStage } from "@/platform/api/index.js";
import { createRetryWithCurrentTranslationSecret } from "@/features/credentials/index.js";
import { mountedFeature } from "./feature-registry.js";
import type { HomeFeatures } from "./types.js";

export function createRetryJobStageWithCurrentKey(features: HomeFeatures) {
  return createRetryWithCurrentTranslationSecret({
    retryJobStage,
    fetchJobPayload: (jobId, options) => fetchJobPayload(jobId, options),
    readCurrent: () => {
      const { translation } = mountedFeature(features, "workflowFeature").buildTranslateJobConfig("");
      return {
        baseUrl: translation.base_url,
        modelApiKey: translation.api_key,
        translationCredentialRef: translation.credential_ref,
      };
    },
  });
}
