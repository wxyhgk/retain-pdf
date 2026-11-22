// 设置里存好的翻译连接：每家服务商一套（key、地址、模型、协议、思考深度），存在本地的开发配置里
// （developerConfig.translationProfiles，设置「翻译」那一栏写）。key 只在本地（2026-09-14 定），重新翻译换模型时
// 跟着 overrides.translation 一起发给后端，后端照旧导入凭据库。
// 填了 key 和模型的才算可用；一家的默认模型和「其他模型」各算一条。
import { loadDeveloperStoredConfig } from "./persisted-config.js";
import {
  translationProtocolFor,
  getTranslationProviderDefinition,
  normalizeTranslationApiProtocol,
  normalizeTranslationThinking,
  TRANSLATION_PROVIDER_OPTIONS,
} from "./providers.js";

export type TranslationConnection = {
  /** 服务商编号（qwen、deepseek、anthropic、custom……）。 */
  provider: string;
  /** 给人看的名字：服务商名；自定义接口用地址的主机名。 */
  label: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  apiProtocol: string;
  thinking: string;
};

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

/** 从开发配置里取出可用的连接，顺序照设置里服务商的顺序。 */
export function translationConnectionsFrom(config: unknown): TranslationConnection[] {
  const root = (config && typeof config === "object" ? config : {}) as Row;
  const profiles = (root.translationProfiles && typeof root.translationProfiles === "object"
    ? root.translationProfiles
    : {}) as Record<string, Row>;
  const connections: TranslationConnection[] = [];
  for (const option of TRANSLATION_PROVIDER_OPTIONS) {
    const profile = profiles[option.id];
    if (!profile || typeof profile !== "object") continue;
    const definition = getTranslationProviderDefinition(option.id);
    const apiKey = text(profile.apiKey);
    const model = text(profile.model);
    const baseUrl = option.id === "custom" ? text(profile.baseUrl) : (text(profile.baseUrl) || `${definition.baseUrl || ""}`);
    if (!apiKey || !model || !baseUrl) continue;
    // 默认模型在前，「其他模型」（设置里填的，2026-11-19 加）跟在后面，每个模型一条。
    const extra = Array.isArray(profile.models) ? profile.models.map(text).filter(Boolean) : [];
    for (const each of [...new Set([model, ...extra])]) {
      connections.push({
        provider: option.id,
        label: option.id === "custom" ? hostOf(baseUrl) : definition.label,
        baseUrl,
        model: each,
        apiKey,
        apiProtocol: normalizeTranslationApiProtocol(text(profile.apiProtocol) || definition.protocol),
        thinking: normalizeTranslationThinking(text(profile.thinking) || "off"),
      });
    }
  }
  return connections;
}

/** 设置里现在的默认模型（新书、什么都不选的重新翻译用它）；读不到是空串。 */
export function defaultTranslationModelFrom(config: unknown): string {
  const root = (config && typeof config === "object" ? config : {}) as Row;
  return text(root.model);
}

export function savedDefaultTranslationModel(): string {
  try {
    return defaultTranslationModelFrom(loadDeveloperStoredConfig());
  } catch {
    return "";
  }
}

/** 本机存着的连接（读不到配置就是空的）。 */
export function savedTranslationConnections(): TranslationConnection[] {
  try {
    return translationConnectionsFrom(loadDeveloperStoredConfig());
  } catch {
    return [];
  }
}

/** 一条连接的编号（服务商::模型）：下拉、上传弹窗里选模型用它当值。 */
export function connectionValue(connection: TranslationConnection): string {
  return `${connection.provider}::${connection.model}`;
}

/** 选中的连接换成翻译字段（地址、模型、key、协议、思考深度）；没选是 null。重新翻译、上传弹窗选模型都用它。 */
export function connectionOverrides(connection: TranslationConnection | null | undefined): Record<string, string> | null {
  if (!connection) return null;
  return {
    base_url: connection.baseUrl,
    model: connection.model,
    api_key: connection.apiKey,
    api_protocol: translationProtocolFor(connection.baseUrl, connection.apiProtocol),
    thinking: connection.thinking,
  };
}
