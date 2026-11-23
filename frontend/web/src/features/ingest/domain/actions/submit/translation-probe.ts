// 提交时顺手检测一次翻译 Key：Key 填错的人不用等 OCR 跑完、翻译失败了才知道。
//
// 起因：提交前的两道预检只查 DeepSeek 余额和 OCR Token，换成通义、智谱、自定义接口的翻译 Key 没人查。
// Key 失效的任务要先把 OCR 整个跑完，到翻译第一批请求被 401 拒掉才失败（11-09 的 5e63e8 就是这样）。
//
// 和另外两道预检一样**不挡提交**（理由见 preflight.ts）：任务照常排队，检测没过就弹一条 toast，
// 用户趁 OCR 还在跑去设置里改。只对「Key / 模型 / 余额本身有问题」这几种确定的结论报，
// 网络抖动、限流、超时不报——那些翻译时多半会自己好，报了只会吓人。
//
// 检测走后端已有的 /providers/deepseek/validate-token（名字是历史遗留，实际按 base_url、模型、协议
// 对任何服务商发一次 max_tokens=1 的请求，几个 token 的花费）。参数从这次真要提交的 payload 里取，
// 不读设置窗口的输入框：提交时设置窗口是关着的，输入框读出来是空的。
// 同一组参数测过一次就记住：通过的记 10 分钟（每次提交都测要花钱、也慢）；没通过的只记 1 分钟，
// 够把一次上传几十本合成一次检测、一条提示，过后再提交还会再提醒。

export type TranslationProbeInput = {
  apiKey: string;
  baseUrl: string;
  model: string;
  apiProtocol: string;
};

export type TranslationProbeResult = {
  ok?: boolean;
  status?: string;
  summary?: string;
} | null | undefined;

export type ValidateTranslationKey = (payload: {
  api_key: string;
  base_url: string;
  model: string;
  api_protocol: string;
}) => Promise<TranslationProbeResult>;

/** 这几种是配置本身错了，翻译时一定还会失败，值得提前说。 */
// quota_exceeded：额度或花费上限用完（2026-11-23 后端检测接口加的，以前误报成「可用（当前被限流）」）。
const CONFIG_FAILURES: readonly string[] = Object.freeze(["unauthorized", "model_unavailable", "insufficient_balance", "quota_exceeded", "invalid_input"]);

const PASSED_TTL_MS = 10 * 60 * 1000;
const FAILED_TTL_MS = 60 * 1000;

/** 从提交 payload 里取出检测要的参数；只做 OCR、没有翻译段、用旧的 credential_ref（前端拿不到 Key 原文）时返回 null。 */
export function translationProbeInputOf(runPayload: unknown): TranslationProbeInput | null {
  const translation = (runPayload as { translation?: Record<string, unknown> } | null)?.translation;
  if (!translation || typeof translation !== "object") return null;
  const apiKey = `${translation.api_key ?? ""}`.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: `${translation.base_url ?? ""}`.trim(),
    model: `${translation.model ?? ""}`.trim(),
    apiProtocol: `${translation.api_protocol ?? ""}`.trim() || "openai_responses",
  };
}

/** 检测没过时给用户看的那句；检测过了、或者结论不确定（网络、限流）时返回空串。 */
export function translationProbeWarning(result: TranslationProbeResult): string {
  if (!result || result.ok !== false) return "";
  const status = `${result.status ?? ""}`.trim();
  if (!CONFIG_FAILURES.includes(status)) return "";
  const summary = `${result.summary ?? ""}`.trim() || "翻译接口检测没通过";
  return `${summary}。任务已经提交，OCR 会照常做，但翻译会失败：请趁现在去设置里改好翻译 Key 和模型。`;
}

/** 测一次、返回要提醒的那句（没问题或已经提醒过返回空串）。 */
export type ProbeTranslationKey = (input: TranslationProbeInput | null) => Promise<string>;

/**
 * 建一个带记忆的检测器。记忆放在实例里、由主页装配时建一个（create-app-actions.ts），
 * 不放模块顶层：模块级单例会在测试之间串味，架构门禁也不许（global-singletons）。
 */
export function createTranslationProbe(
  validateTranslationKey: ValidateTranslationKey,
  { now = Date.now }: { now?: () => number } = {},
): ProbeTranslationKey {
  const cache = new Map<string, { at: number; ttl: number; result: Promise<TranslationProbeResult> }>();
  return async (input) => {
    if (!input) return "";
    const key = JSON.stringify([input.apiKey, input.baseUrl, input.model, input.apiProtocol]);
    const at = now();
    const entry = cache.get(key);
    if (entry && at - entry.at <= entry.ttl) {
      // 同一组参数接着提交的（批量上传的第 2…n 本）等同一个结果，但只有发起检测的那次去报。
      await entry.result;
      return "";
    }
    const result = Promise.resolve()
      .then(() => validateTranslationKey({
        api_key: input.apiKey,
        base_url: input.baseUrl,
        model: input.model,
        api_protocol: input.apiProtocol,
      }))
      // 检测本身失败（超时、后端不通）不算 Key 有问题；也不记，下次提交再测。
      .catch(() => {
        cache.delete(key);
        return null;
      });
    const fresh = { at, ttl: PASSED_TTL_MS, result };
    cache.set(key, fresh);
    const warning = translationProbeWarning(await result);
    if (warning) fresh.ttl = FAILED_TTL_MS;
    return warning;
  };
}
