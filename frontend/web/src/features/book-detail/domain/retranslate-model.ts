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

type EstimatePart = { low_cny?: number | null; high_cny?: number | null } | null | undefined;
type Estimate = { basis?: string; translation?: EstimatePart; refine?: EstimatePart } | null | undefined;

function yuan(value: number): string {
  if (value < 0.01) return "<0.01";
  return value < 100 ? value.toFixed(2) : Math.round(value).toLocaleString("en-US");
}

/**
 * 估价写在下拉选项后面：「约 ¥1.20–1.80」（翻译加精修，都按人民币）。没翻译过的书按书库每页平均估，后面注「按书库平均」。
 * 没有可参照的用量（basis none）、或者这个模型查不到价，写空串（不显示）。
 */
export function estimateText(view: Estimate): string {
  if (!view || view.basis === "none") return "";
  const parts = [view.translation, view.refine].filter((part) => part && part.low_cny != null && part.high_cny != null);
  if (!parts.length) return "";
  const low = parts.reduce((sum, part) => sum + Number(part?.low_cny || 0), 0);
  const high = parts.reduce((sum, part) => sum + Number(part?.high_cny || 0), 0);
  const range = yuan(low) === yuan(high) ? `约 ¥${yuan(low)}` : `约 ¥${yuan(low)}–${yuan(high)}`;
  return view.basis === "library_average" ? `${range}（按书库平均）` : range;
}
