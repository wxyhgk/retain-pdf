// 重跑类请求（retry-stage / resume / rerun）带上设置里当前的翻译密钥，而不是原任务当初的那把。
//
// 事故（2026-10-09）：用户换了新密钥、在设置里检测通过，再连点 4 次重试，4 次都 401——后端
// 重跑时照搬原任务的 translation（含 credential_ref），前端只发后端给的 body，新密钥根本没送到。
// 后端在这三个接口上都接受 overrides.translation.api_key / credential_ref，换掉旧引用。
//
// 放在接口层而不是各个入口：首页的失败卡片、书籍详情的「重新处理」和「从断点继续」、独立详情页，
// 都经过这里，不会漏。当前设置从用户保存的配置里读（和提交新任务用的是同一份）。
//
// 只在接口地址一致时才换：换成别家接口的密钥，和原任务的接口对不上。读不到原任务就不换。
import { fetchJobPayload } from "@retainpdf/api/jobs";

import { loadBrowserStoredConfig, loadDeveloperStoredConfig } from "../config/persisted-config.js";

export type CurrentTranslationSecret = {
  baseUrl?: string | null;
  modelApiKey?: string | null;
  translationCredentialRef?: string | null;
};

type Body = Record<string, unknown>;

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

function asRecord(value: unknown): Body {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Body : {};
}

export function sameTranslationEndpoint(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown) => text(value).toLowerCase().replace(/\/+$/, "");
  const left = normalize(a);
  return Boolean(left) && left === normalize(b);
}

export function withCurrentTranslationSecret(
  body: Body,
  { sourceBaseUrl, current }: { sourceBaseUrl?: string | null; current?: CurrentTranslationSecret | null },
): Body {
  const overrides = asRecord(body.overrides);
  const translation = asRecord(overrides.translation);
  // 调用方已经指定了密钥（比如「重新翻译」整段换成当前配置），不再动。
  if (text(translation.api_key) || text(translation.credential_ref)) return body;
  const targetBaseUrl = text(translation.base_url) || sourceBaseUrl;
  if (!current || !sameTranslationEndpoint(current.baseUrl, targetBaseUrl)) return body;
  const apiKey = text(current.modelApiKey);
  const credentialRef = text(current.translationCredentialRef);
  const secret = apiKey ? { api_key: apiKey } : credentialRef ? { credential_ref: credentialRef } : null;
  if (!secret) return body;
  return { ...body, overrides: { ...overrides, translation: { ...translation, ...secret } } };
}

export function readStoredTranslationSecret(): CurrentTranslationSecret {
  const credentials = asRecord(loadBrowserStoredConfig());
  const developer = asRecord(loadDeveloperStoredConfig());
  return {
    baseUrl: text(developer.baseUrl),
    modelApiKey: text(credentials.modelApiKey),
    translationCredentialRef: text(credentials.translationCredentialRef),
  };
}

export type TranslationSecretInjector = (jobId: string, apiPrefix: string | undefined, body: Body) => Promise<Body>;

/** 先查原任务的接口地址，再把当前密钥合进 overrides.translation；任何一步失败都原样返回 body。 */
export function createTranslationSecretInjector({
  readJob = (jobId, apiPrefix) => fetchJobPayload(jobId, { apiPrefix }),
  readCurrent = readStoredTranslationSecret,
}: {
  readJob?: (jobId: string, apiPrefix: string | undefined) => Promise<unknown>;
  readCurrent?: () => CurrentTranslationSecret | null;
} = {}): TranslationSecretInjector {
  return async (jobId, apiPrefix, body) => {
    try {
      const current = readCurrent();
      if (!jobId || !current || !(text(current.modelApiKey) || text(current.translationCredentialRef))) return body;
      const job = asRecord(await readJob(jobId, apiPrefix));
      const sourceBaseUrl = text(asRecord(asRecord(job.request_payload).translation).base_url);
      return withCurrentTranslationSecret(body, { sourceBaseUrl, current });
    } catch {
      return body;
    }
  };
}

/** rerun 只给动作链接（后端给的完整地址 …/api/v1/jobs/<id>/rerun）：从里面取任务号。 */
export function jobIdFromActionUrl(actionUrl: string): string {
  const match = /\/jobs\/([^/?#]+)\/[^/?#]+\/?(?:[?#].*)?$/.exec(text(actionUrl));
  return match ? decodeURIComponent(match[1]) : "";
}
