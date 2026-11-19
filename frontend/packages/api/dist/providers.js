// providers — pure
import { buildApiEndpoint, submitJson } from "./http.js";
// 凭据检测都是"用户点了按钮在等结果"的前台请求，必须有上限：后端探针自身
// 超时 20s（RUST_API_DEEPSEEK_PROBE_TIMEOUT_SECS），这里留 10s 余量兜住
// 后端处理与网络往返。没有它，对端挂起就会让面板的检测按钮永久停在"检测中"。
const PROVIDER_PROBE_TIMEOUT_MS = 30_000;
const PROBE_TIMEOUT_MESSAGE = "检测超时（30s），请检查 API URL 与网络后重试。";
const probeOptions = {
    timeoutMs: PROVIDER_PROBE_TIMEOUT_MS,
    timeoutMessage: PROBE_TIMEOUT_MESSAGE,
};
export async function validateMineruToken(apiPrefix, payload) {
    return submitJson(buildApiEndpoint(apiPrefix, "providers/mineru/validate-token"), payload, probeOptions);
}
export async function validatePaddleToken(apiPrefix, payload) {
    return submitJson(buildApiEndpoint(apiPrefix, "providers/paddle/validate-token"), payload, probeOptions);
}
export async function validateDeepSeekToken(apiPrefix, payload) {
    return submitJson(buildApiEndpoint(apiPrefix, "providers/deepseek/validate-token"), payload, probeOptions);
}
export async function queryDeepSeekBalance(apiPrefix, payload) {
    return submitJson(buildApiEndpoint(apiPrefix, "providers/deepseek/balance"), payload, probeOptions);
}
/**
 * 从翻译接口拉模型列表（POST /providers/translation/models，后端代调服务商的 /models，key 用完不存）。
 * 服务商那边出错也是 200，看 status；没 key、地址不合规是 400。
 */
export async function fetchTranslationProviderModels(apiPrefix, payload) {
    return submitJson(buildApiEndpoint(apiPrefix, "providers/translation/models"), payload, {
        timeoutMs: PROVIDER_PROBE_TIMEOUT_MS,
        timeoutMessage: "拉取模型超时（30s），请检查 API URL 与网络后重试。",
    });
}
