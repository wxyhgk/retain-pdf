// 检测 Key / Token 没通过时，按厂商 + 厂商的码（或唯一对得上的 HTTP 状态码）查服务商错误码目录
// （GET /providers/error-codes），把「这家服务商说的是什么、该怎么办」接在检测结果后面。翻译接口和 OCR 的检测共用。

import { fetchProviderErrorHint } from "@/platform/api/index.js";

/** 查一条提示；查不到 null。测试里换成假的。 */
export type ProviderErrorHintLookup = (target: { vendor: string; code?: string | null; httpStatus?: number | null }) => Promise<string | null>;

export const defaultErrorHintLookup: ProviderErrorHintLookup = async ({ vendor, code, httpStatus }) => {
  const hint = await fetchProviderErrorHint(undefined, { vendor, code: code || "", httpStatus: httpStatus ?? null });
  return hint?.hint || null;
};

/**
 * 检测结果里有厂商的码或 HTTP 状态码时，查目录，返回「原来那句。服务商的说法」；查不到、查失败、已经说过了都返回 null，
 * 调用方就保持原来那句。vendor 是错误码目录的厂商编号（自定义接口认不出是哪家，调用方别传）。
 */
export async function withProviderHint(
  message: string,
  vendor: string,
  result: { provider_code?: unknown; http_status?: unknown },
  lookup: ProviderErrorHintLookup = defaultErrorHintLookup,
): Promise<string | null> {
  const code = `${result.provider_code ?? ""}`.trim();
  const httpStatus = Number(result.http_status) || null;
  if (!vendor || (!code && !httpStatus)) return null;
  const hint = await lookup({ vendor, code, httpStatus }).catch(() => null);
  if (!hint || message.includes(hint)) return null;
  return `${message.replace(/[。.]$/, "")}。${hint}`;
}
