// 和笔记（Studio）用 postMessage 说话的消息格式：契约 contracts/studio-bridge.v1.schema.json。
// 纯函数，不碰 window；收发和握手在 app/bootstrap/studio-embed.ts。
//
// 认不出的消息（protocol 不对、v 不认识、type 不认识、必填项缺）一律当没收到（返回 null），不报错。
// 多出来的字段不管：契约说以后只加新 type 和可选字段。

export const STUDIO_BRIDGE_PROTOCOL = "retainpdf-studio-bridge";
export const STUDIO_BRIDGE_VERSION = 1;
/** 地址上的 ?embed= 值：Studio 加载 RetainPDF 时带它。 */
export const STUDIO_EMBED = "studio";

export type StudioTheme = "light" | "dark";
export type StudioFeature = "theme" | "navigate" | "quote";

/** Studio 发来、我们认的消息。 */
export type StudioIncoming =
  | { type: "hello"; theme: StudioTheme }
  | { type: "theme"; theme: StudioTheme }
  | { type: "navigate"; jobId: string; pageIdx: number | null; blockId: string };

export type StudioQuote = {
  jobId: string;
  documentId: string | null;
  title: string | null;
  itemId: string;
  pageIdx: number;
  sourceText: string | null;
  translatedText: string | null;
};

const LOOPBACK_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

/** 只认本机回环地址上的 http 页面（任意端口）：别的网页把 RetainPDF 放进 iframe 拿不到书里的内容。 */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(`${origin || ""}`);
    return url.protocol === "http:" && LOOPBACK_HOSTS.includes(url.hostname) && url.origin === origin;
  } catch {
    return false;
  }
}

function theme(value: unknown): StudioTheme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function parseStudioMessage(data: unknown): StudioIncoming | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const message = data as Record<string, unknown>;
  if (message.protocol !== STUDIO_BRIDGE_PROTOCOL || message.v !== STUDIO_BRIDGE_VERSION) return null;
  if (message.type === "hello" || message.type === "theme") {
    const value = theme(message.theme);
    return value ? { type: message.type, theme: value } : null;
  }
  if (message.type === "navigate") {
    const jobId = typeof message.job_id === "string" ? message.job_id.trim() : "";
    if (!jobId) return null;
    const page = message.page_idx;
    const pageIdx = typeof page === "number" && Number.isInteger(page) && page >= 0 ? page : null;
    const blockId = typeof message.block_id === "string" ? message.block_id.trim() : "";
    return { type: "navigate", jobId, pageIdx, blockId };
  }
  return null;
}

export function readyMessage(features: readonly StudioFeature[]) {
  return { protocol: STUDIO_BRIDGE_PROTOCOL, v: STUDIO_BRIDGE_VERSION, type: "ready", features: [...features] } as const;
}

export function quoteMessage(quote: StudioQuote) {
  return {
    protocol: STUDIO_BRIDGE_PROTOCOL,
    v: STUDIO_BRIDGE_VERSION,
    type: "quote",
    job_id: quote.jobId,
    document_id: quote.documentId || null,
    title: quote.title || null,
    item_id: quote.itemId,
    page_idx: Math.max(0, Math.floor(quote.pageIdx)),
    source_text: quote.sourceText,
    translated_text: quote.translatedText,
  } as const;
}
