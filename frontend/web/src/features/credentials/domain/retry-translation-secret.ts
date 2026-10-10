// 重试时用当前设置里的翻译密钥，而不是原任务当初的那把。
//
// 事故（2026-10-09）：用户换了新密钥、在设置里检测通过，再连点 4 次重试，4 次都 401——后端
// 重试把原任务的 translation 整段照搬（含 credential_ref），前端只发后端给的 action.body，
// 新密钥根本没送到。后端支持在 retry-stage 的 overrides.translation 里带 api_key /
// credential_ref 换掉旧引用（stage_retry_overrides.rs）。
//
// 只在接口地址一致时才换：换成别家接口的密钥，和原任务的接口对不上。拿不到原任务地址就不换。
// 原地精修（refine）不收明文 key（后端 400），只能带凭据库引用；只有明文时不注入。

export type CurrentTranslationSecret = {
  baseUrl?: string | null;
  modelApiKey?: string | null;
  translationCredentialRef?: string | null;
};

type RetryJobStageFn = (
  jobId: string,
  apiPrefix: string | undefined,
  stage: string,
  payload?: Record<string, unknown>,
) => Promise<any>;

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function sameTranslationEndpoint(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown) => text(value).toLowerCase().replace(/\/+$/, "");
  const left = normalize(a);
  return Boolean(left) && left === normalize(b);
}

export function withCurrentTranslationSecret(
  stage: string,
  body: Record<string, unknown>,
  { sourceBaseUrl, current }: { sourceBaseUrl?: string | null; current?: CurrentTranslationSecret | null },
): Record<string, unknown> {
  const overrides = asRecord(body.overrides);
  const translation = asRecord(overrides.translation);
  // 调用方已经指定了密钥（比如「重新翻译」整段换成当前配置），不再动。
  if (text(translation.api_key) || text(translation.credential_ref)) return body;
  const targetBaseUrl = text(translation.base_url) || sourceBaseUrl;
  if (!current || !sameTranslationEndpoint(current.baseUrl, targetBaseUrl)) return body;
  const apiKey = text(current.modelApiKey);
  const credentialRef = text(current.translationCredentialRef);
  const secret = stage === "refine"
    ? (credentialRef ? { credential_ref: credentialRef } : null)
    : apiKey
      ? { api_key: apiKey }
      : credentialRef ? { credential_ref: credentialRef } : null;
  if (!secret) return body;
  return { ...body, overrides: { ...overrides, translation: { ...translation, ...secret } } };
}

/** 包一层 retry-stage：先查原任务的接口地址，再把当前密钥合进 overrides.translation。 */
export function createRetryWithCurrentTranslationSecret({
  retryJobStage,
  fetchJobPayload,
  readCurrent,
}: {
  retryJobStage: RetryJobStageFn;
  fetchJobPayload: (jobId: string, options: { apiPrefix?: string }) => Promise<unknown>;
  readCurrent: () => CurrentTranslationSecret | null;
}): RetryJobStageFn {
  return async (jobId, apiPrefix, stage, payload = {}) => {
    let next = payload;
    try {
      const current = readCurrent();
      if (current && (text(current.modelApiKey) || text(current.translationCredentialRef))) {
        const job = asRecord(await fetchJobPayload(jobId, { apiPrefix }));
        const sourceBaseUrl = text(asRecord(asRecord(job.request_payload).translation).base_url);
        next = withCurrentTranslationSecret(stage, payload, { sourceBaseUrl, current });
      }
    } catch {
      // 读不到当前设置或原任务时照原样重试，和以前一样。
    }
    return retryJobStage(jobId, apiPrefix, stage, next);
  };
}
