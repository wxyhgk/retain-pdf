// 重新翻译时换模型：从设置里存好的连接（每家服务商一套 key、地址、模型）里挑一个。
// 选了就把这条连接整套（地址、模型、key、协议、思考深度）放进 retry-stage 的 overrides.translation，
// 后端用新的一套，不和原任务的拼（2026-11-19 后端确认）；不选 = 沿用原任务的。纯函数，单测直接覆盖。
import type { TranslationConnection } from "@/platform/config/translation-connections.js";

export type RetranslateModelOption = { value: string; label: string; connection: TranslationConnection | null };

/** 下拉里「沿用原来的」那一项的值。 */
export const KEEP_MODEL = "";

export function connectionValue(connection: TranslationConnection): string {
  return `${connection.provider}::${connection.model}`;
}

/** 下拉：第一项「沿用原来的」，后面每条连接一项（服务商 · 模型）。原任务正在用的那条标出来。 */
export function retranslateModelOptions(
  connections: readonly TranslationConnection[],
  current: { baseUrl?: string; model?: string } = {},
): RetranslateModelOption[] {
  const sameEndpoint = (a = "", b = "") => a.trim().replace(/\/+$/, "").toLowerCase() === b.trim().replace(/\/+$/, "").toLowerCase();
  return [
    { value: KEEP_MODEL, label: "模型：沿用原来的", connection: null },
    ...connections.map((connection) => {
      const inUse = Boolean(current.model) && connection.model === current.model && sameEndpoint(connection.baseUrl, current.baseUrl);
      return {
        value: connectionValue(connection),
        label: `模型：${connection.label} · ${connection.model}${inUse ? "（原来用的）" : ""}`,
        connection,
      };
    }),
  ];
}

/** 选中的连接换成 overrides.translation 里的字段；没选是 null。 */
export function connectionOverrides(connection: TranslationConnection | null | undefined): Record<string, string> | null {
  if (!connection) return null;
  return {
    base_url: connection.baseUrl,
    model: connection.model,
    api_key: connection.apiKey,
    api_protocol: connection.apiProtocol,
    thinking: connection.thinking,
  };
}
