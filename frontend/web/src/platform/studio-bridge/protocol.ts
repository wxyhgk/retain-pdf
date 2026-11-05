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
/** 我们处理、会发的（回 ready 时报给 Studio）。reading：会告诉 Studio 眼下读到哪。 */
export type StudioFeature = "theme" | "navigate" | "quote" | "notes" | "reading";
/**
 * Studio 处理的、我们发过去的（hello.features）：quote →「摘到笔记」，open-notes →「笔记」按钮，ask-ai → 阅读页的「AI」打开
 * Studio 的 AI，open-book → 书库里点书要读时交给 Studio（在正在写的笔记旁边打开），我们不自己打开阅读页，shortcut → 阅读页有焦点时
 * 按的 Studio 快捷键（⌘K、⌘S、⌘J、⌘\）转给 Studio。
 */
export type StudioSideFeature = "quote" | "open-notes" | "ask-ai" | "open-book" | "shortcut";
const STUDIO_SIDE_FEATURES: readonly StudioSideFeature[] = ["quote", "open-notes", "ask-ai", "open-book", "shortcut"];

/** Studio 发来、我们认的消息。hello 的 features 为 null 是早先的 Studio（没发这个字段），只认 quote。 */
export type StudioIncoming =
  | { type: "hello"; theme: StudioTheme; features: StudioSideFeature[] | null }
  | { type: "theme"; theme: StudioTheme }
  | { type: "navigate"; jobId: string; pageIdx: number | null; blockId: string }
  | { type: "notes"; open: boolean; title: string | null };

/** 「笔记」按钮打开的是哪本书的笔记：任务、书编号、书名（和 quote 同一套）。 */
export type StudioBook = {
  jobId: string;
  documentId: string | null;
  title: string | null;
};

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
  if (message.type === "hello") {
    const value = theme(message.theme);
    if (!value) return null;
    const features = Array.isArray(message.features)
      ? message.features.filter((item): item is StudioSideFeature => STUDIO_SIDE_FEATURES.includes(item as StudioSideFeature))
      : null;
    return { type: "hello", theme: value, features };
  }
  if (message.type === "theme") {
    const value = theme(message.theme);
    return value ? { type: "theme", theme: value } : null;
  }
  if (message.type === "notes") {
    if (typeof message.open !== "boolean") return null;
    const title = typeof message.title === "string" && message.title.trim() ? message.title.trim() : null;
    return { type: "notes", open: message.open, title };
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

export function openNotesMessage(book: StudioBook) {
  return {
    protocol: STUDIO_BRIDGE_PROTOCOL,
    v: STUDIO_BRIDGE_VERSION,
    type: "open-notes",
    job_id: book.jobId,
    document_id: book.documentId || null,
    title: book.title || null,
  } as const;
}

/** 书库里点了一本书要读（Studio 认 open-book 时）：交给 Studio；pageIdx 为 null 时 Studio 从上次读到的地方开。 */
export function openBookMessage(book: StudioBook, pageIdx: number | null = null) {
  return {
    protocol: STUDIO_BRIDGE_PROTOCOL,
    v: STUDIO_BRIDGE_VERSION,
    type: "open-book",
    job_id: book.jobId,
    document_id: book.documentId || null,
    title: book.title || null,
    ...(typeof pageIdx === "number" && Number.isInteger(pageIdx) && pageIdx >= 0 ? { page_idx: pageIdx } : {}),
  } as const;
}

/** 阅读页有焦点时按了 Studio 的快捷键：交给 Studio 当在它那里按的。 */
export type StudioShortcut = { key: string; meta: boolean; ctrl: boolean; shift: boolean; alt: boolean };

export function shortcutMessage(keys: StudioShortcut) {
  return {
    protocol: STUDIO_BRIDGE_PROTOCOL,
    v: STUDIO_BRIDGE_VERSION,
    type: "shortcut",
    key: keys.key,
    meta: Boolean(keys.meta),
    ctrl: Boolean(keys.ctrl),
    shift: Boolean(keys.shift),
    alt: Boolean(keys.alt),
  } as const;
}

export function closeNotesMessage() {
  return { protocol: STUDIO_BRIDGE_PROTOCOL, v: STUDIO_BRIDGE_VERSION, type: "close-notes" } as const;
}

/** 阅读页的「AI」点了：Studio 打开它自己的 AI。读的哪本、第几页，发之前先把 reading 发出去。 */
export function askAiMessage() {
  return { protocol: STUDIO_BRIDGE_PROTOCOL, v: STUDIO_BRIDGE_VERSION, type: "ask-ai" } as const;
}

/** 眼下读到哪：阅读页里是哪本书、第几页（0 起）、一共几页；不在阅读页（book 为 null）五项都是 null。 */
export type StudioReading = { book: StudioBook; pageIdx: number | null; pageCount: number | null } | null;

export function readingMessage(given: StudioReading) {
  // 没有任务就当不在阅读页：契约要五项一起是 null。
  const reading = given && given.book.jobId ? given : null;
  const whole = (value: number | null | undefined, least: number) =>
    typeof value === "number" && Number.isInteger(value) && value >= least ? value : null;
  const pageCount = reading ? whole(reading.pageCount, 1) : null;
  const pageIdx = reading ? whole(reading.pageIdx, 0) : null;
  return {
    protocol: STUDIO_BRIDGE_PROTOCOL,
    v: STUDIO_BRIDGE_VERSION,
    type: "reading",
    job_id: reading ? reading.book.jobId : null,
    document_id: reading ? reading.book.documentId || null : null,
    title: reading ? reading.book.title || null : null,
    page_idx: pageIdx !== null && pageCount !== null && pageIdx >= pageCount ? null : pageIdx,
    page_count: pageCount,
  } as const;
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
