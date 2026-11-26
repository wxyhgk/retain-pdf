/**
 * 读书（只用 Node 自带的东西，不依赖 pi）：经后端的接口读正在读的那本书。照搬 Python 自带 agent 的
 * `backend/ask-agent/retainpdf_ask_agent/tools.py`——接口、页码换算、截断上限、给模型的字都一样，两边改要一起改。
 *
 * - 书的块全来自 `GET /api/v1/jobs/{job_id}/reader/regions`（阅读页用的同一份，页码和阅读页一致），第一次用到时取一次、留在进程里；
 *   页图来自 `GET /api/v1/documents/{id}/files/pages/{page}.jpg`（原文）、`GET /api/v1/jobs/{job_id}/files/pages/{page}.jpg`（译文）。
 * - 材料先给：`carriesText` 判断这一问带没带字；带字的 `background` 补所在的节、同页前后各一块，不带字的 `prefetch` 取那一页
 *   （没有文字层附页图）；`overview` 是页数和目录。
 * - 工具：`read_pages` / `search_book` / `view_page`，都只读。出错不抛：回一段说明给模型（`isError`）。
 *
 * 写法只用 Node 能直接去掉类型跑的 TypeScript（没有 enum、参数属性），pi 用 jiti 加载、node --test 直接跑测试。
 */

export const SKIP_SUB_TYPES = new Set(["header", "footer", "page_header", "page_footer", "page_number"]);
const HEADING_SUB_TYPES = new Set(["title", "heading"]);
// 一次工具结果最多多少字（太长的截断，告诉模型）
export const MAX_PAGE_CHARS = 12_000;
export const MAX_READ_CHARS = 24_000;
export const MAX_READ_PAGES = 5;
export const MAX_SEARCH_CHARS = 12_000;
export const DEFAULT_SEARCH_LIMIT = 6;
export const MAX_SEARCH_LIMIT = 12;
const HIT_SOURCE_CHARS = 600;
const HIT_TRANSLATED_CHARS = 500;
// 系统提示词里的目录
const MAX_OVERVIEW_CHARS = 3_000;
const MAX_OVERVIEW_ENTRIES = 60;
// 每问之前自动取的上下文
const NEIGHBOR_BLOCKS = 3;
const MAX_NEIGHBOR_CHARS = 1_200;
const MAX_ANCHOR_CHARS = 4_000;
const MAX_PREFETCH_PAGE_CHARS = 6_000;
const MAX_MENTIONED_PAGES = 2;
// 带字的问题的背景：前后各一块，每块最多多少字；书还没取到时最多等多久
const BACKGROUND_NEIGHBORS = 1;
const MAX_BACKGROUND_BLOCK_CHARS = 500;
const MAX_BACKGROUND_PAGE_CHARS = 4_000;
export const BACKGROUND_WAIT_MS = 1_500;
// 前端附在问题前面的字（frontend/packages/reader/src/ask/acp-adapter.ts 的 anchorPromptBlocks）
const TEXT_MARKERS = ["我选中的这段：", "这一块的原文：", "这一块的译文："];
export const PAGE_IMAGE_WIDTH = 1000;
// 一张图最多多大（Anthropic 一张图 5 MB 封顶，base64 再大三分之一）
export const MAX_IMAGE_BYTES = 3_500_000;
const REGIONS_TIMEOUT_MS = 60_000;
const IMAGE_TIMEOUT_MS = 90_000;
export const ID_RE = /^[A-Za-z0-9_.:-]{1,200}$/;
// 前端在第一问前面写的出处，最后一行是「（RetainPDF 任务 <任务>，块 <块>，第 <页> 页）」
const ANCHOR_MARKER_RE = /（RetainPDF 任务 ([A-Za-z0-9_.:-]+)(?:，块 ([A-Za-z0-9_.:-]+))?，第 (\d{1,5}) 页）/;
const PAGE_MENTION_RE = /第\s*(\d{1,5})\s*页|\bpages?\s*(\d{1,5})\b|\bp\.\s*(\d{1,5})\b/gi;

export type HttpReply = { status: number; contentType: string; body: Uint8Array };
/** 取一个后端地址（`/api/v1/...`）；连不上就抛错。 */
export type HttpGet = (path: string, timeoutMs: number) => Promise<HttpReply>;
export type ImagePart = { mimeType: string; data: string };

/** 一次工具调用的结果：`text` 给模型，`images` 跟着给模型看，`summary` 是给用户看的一句。 */
export type ToolResult = { text: string; images: ImagePart[]; isError: boolean; summary: string };
/** 每问之前自动取的上下文：`text` 放在问题前面，`images` 是没有文字层的页的图，`info` 是取了哪些。 */
export type Prefetch = { text: string; images: ImagePart[]; info: Record<string, unknown> };

type Item = Record<string, any>;
type Anchor = { page: number; itemId: string | null };

export class ToolInputError extends Error {}

function toolError(text: string): ToolResult {
  return { text, images: [], isError: true, summary: chars(text).slice(0, 200).join("") };
}

function ok(text: string, summary: string, images: ImagePart[] = []): ToolResult {
  return { text, images, isError: false, summary };
}

/** 按字（码位）算长度，和 Python 的 len 一样。 */
function chars(text: string): string[] {
  return Array.from(text);
}

function clip(text: unknown, limit: number): string {
  const flat = String(text ?? "").split(/\s+/u).filter(Boolean).join(" ");
  const all = chars(flat);
  return all.length <= limit ? flat : all.slice(0, limit - 1).join("") + "…";
}

export const TOOL_KINDS: Record<string, string> = { read_pages: "read", search_book: "search", view_page: "fetch" };

/** 给用户看的工具卡片标题（pi-acp 现在用工具名，自己的入口以后可以用这个）。 */
export function toolTitle(name: string, args: Record<string, any>): string {
  if (name === "read_pages") {
    const pages = Array.isArray(args.pages) ? args.pages : [args.page];
    return `读第 ${pages.slice(0, MAX_READ_PAGES).map(String).join("、")} 页`;
  }
  if (name === "search_book") return `在书里找「${chars(String(args.query ?? "")).slice(0, 40).join("")}」`;
  if (name === "view_page") return `看第 ${args.page} 页的${args.side === "translated" ? "译文" : "原文"}图`;
  return name;
}

/** Node 自带的 fetch：带 `X-API-Key`。后端在本机回环地址上，Node 的 fetch 默认不走系统代理。 */
export function defaultHttpGet(baseUrl: string, apiKey: string): HttpGet {
  const base = baseUrl.replace(/\/+$/, "");
  return async (path, timeoutMs) => {
    const response = await fetch(base + path, {
      headers: { "X-API-Key": apiKey, Accept: "*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, contentType: response.headers.get("content-type") ?? "", body };
  };
}

function decode(body: Uint8Array): string {
  return new TextDecoder("utf-8").decode(body);
}

function errorMessage(status: number, body: Uint8Array): string {
  let payload: any;
  try {
    payload = JSON.parse(decode(body));
  } catch {
    return `HTTP ${status}`;
  }
  const message = payload && typeof payload === "object" ? payload.message : undefined;
  const reason = payload && typeof payload === "object" ? payload.error?.details?.reason : undefined;
  return `HTTP ${status}：${message || ""}${reason ? `（${reason}）` : ""}`;
}

function sourcePage(item: Item | null | undefined): number {
  const page = item?.source?.page;
  return Number.isInteger(page) ? page : 0;
}

function sourceText(item: Item | null | undefined): string {
  return String(item?.source?.text ?? "").trim();
}

function isHeading(item: Item): boolean {
  return HEADING_SUB_TYPES.has(item.sub_type) || Number.isInteger(item.heading_level);
}

function level(item: Item): number {
  const value = item.heading_level;
  if (Number.isInteger(value) && value >= 1) return Math.min(value, 6);
  return item.sub_type === "title" ? 1 : 2;
}

const KIND_NAMES: Record<string, string> = {
  formula: "公式", display_formula: "公式", table: "表格", table_html: "表格", image: "图", image_body: "图",
  figure: "图", caption: "图注", figure_caption: "图注", table_caption: "表注", footnote: "脚注", list: "列表",
  reference_entry: "参考文献", code_block: "代码", metadata: "书目信息",
};

function kind(item: Item): string {
  const subType = String(item.sub_type ?? "");
  const region = String(item.region_type ?? "");
  if (HEADING_SUB_TYPES.has(subType)) return `标题（${level(item)} 级）`;
  return KIND_NAMES[subType] || KIND_NAMES[region] || "正文";
}

/** 一块的译文。跨块的段落（`continuation_group_id`）有本块那份就用本块的；没有就整段只在第一块给一次。 */
function translatedText(item: Item, seenGroups: Set<string>): string {
  const own = item.translated_block_text;
  if (typeof own === "string" && own.trim()) return own.trim();
  const text = String(item.translated?.text ?? "").trim();
  const group = item.continuation_group_id;
  if (text && typeof group === "string" && group) {
    if (seenGroups.has(group)) return "（和上一块是同一段，译文见上）";
    seenGroups.add(group);
  }
  return text;
}

function blockLines(item: Item, side: string, seenGroups: Set<string>, limit: number, marker = ""): string[] {
  const lines = [`${marker}[${item.item_id}] ${kind(item)}`];
  if (side === "both" || side === "source") lines.push(`原文：${clip(sourceText(item), limit) || "（无文字）"}`);
  if (side === "both" || side === "translated") lines.push(`译文：${clip(translatedText(item, seenGroups), limit) || "（没有译文）"}`);
  return lines;
}

/** 整块不长就给整块；长的取命中处前后共 `size` 字。 */
function windowAround(text: string, terms: string[], size: number): string {
  const flat = chars(text.split(/\s+/u).filter(Boolean).join(" "));
  if (flat.length <= size) return flat.join("");
  const lowered = flat.join("").toLowerCase();
  const positions = terms.map((term) => lowered.indexOf(term)).filter((at) => at >= 0);
  // indexOf 是 UTF-16 下标，换成码位下标
  const at = positions.length ? chars(lowered.slice(0, Math.min(...positions))).length : 0;
  const start = Math.max(0, Math.min(at - Math.floor(size / 3), flat.length - size));
  const end = Math.min(flat.length, start + size);
  return `${start ? "…" : ""}${flat.slice(start, end).join("")}${end < flat.length ? "…" : ""}`;
}

function toPage(value: unknown): number {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) value = Number(value.trim());
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new ToolInputError("页码要是从 1 开始的整数");
  return value;
}

export function toPages(args: Record<string, any>): number[] {
  let raw: unknown = args.pages;
  if (raw === undefined && "page" in args) raw = [args.page];
  if (typeof raw === "number" || typeof raw === "string") raw = [raw];
  if (!Array.isArray(raw) || raw.length === 0) throw new ToolInputError("pages 要是页码列表，比如 [5] 或 [5, 6]");
  const pages: number[] = [];
  for (const value of raw) {
    const page = toPage(value);
    if (!pages.includes(page)) pages.push(page);
  }
  if (pages.length > MAX_READ_PAGES) throw new ToolInputError(`一次最多读 ${MAX_READ_PAGES} 页`);
  return pages;
}

/** 问题里的出处（前端写的「（RetainPDF 任务 …，第 N 页）」）。别的书的出处块号不认，页码照用。 */
export function anchorFromTexts(texts: string[], jobId: string): Anchor | null {
  for (const text of texts) {
    const match = ANCHOR_MARKER_RE.exec(text || "");
    if (match) return { page: Number(match[3]), itemId: match[1] === jobId ? match[2] ?? null : null };
  }
  return null;
}

/** 问题（最后一段字，去掉前端的出处行）里写的「第 N 页」，不算提问的那一页，最多两页。 */
export function mentionedPages(texts: string[], anchor: Anchor | null): number[] {
  const question = (texts.length ? texts[texts.length - 1] : "").replace(new RegExp(ANCHOR_MARKER_RE.source, "g"), "");
  const pages: number[] = [];
  for (const match of question.matchAll(PAGE_MENTION_RE)) {
    const page = Number(match[1] ?? match[2] ?? match[3]);
    if (page >= 1 && !pages.includes(page) && page !== anchor?.page) pages.push(page);
  }
  return pages.slice(0, MAX_MENTIONED_PAGES);
}

/**
 * pi-acp 把一问的几段文字直接接成一串（不加分隔），这里按前端出处行拆回「出处」和「问题」两段：
 * 出处行（含）之前是前端附的那一块，之后是问题（重连时前端附的「之前聊过的」也在这段里）。没有出处行就整段是问题。
 */
export function splitPrompt(prompt: string): string[] {
  const match = new RegExp(ANCHOR_MARKER_RE.source, "g");
  let last: RegExpExecArray | null = null;
  for (let found = match.exec(prompt); found; found = match.exec(prompt)) last = found;
  if (!last) return [prompt];
  const cut = last.index + last[0].length;
  return [prompt.slice(0, cut), prompt.slice(cut)];
}

function sleep(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => setTimeout(() => resolve("timeout"), ms).unref?.());
}

/** 读一本书。`httpGet` 可以换成假的（测试）。 */
export class BookTools {
  readonly jobId: string;
  readonly documentId: string;
  private readonly httpGet: HttpGet;
  private itemsPromise: Promise<Item[]> | null = null;
  private loaded: Item[] | null = null;
  private index = new Map<string, number>();
  private overviewText: string | null = null;

  constructor(options: { jobId: string; documentId?: string; httpGet: HttpGet }) {
    if (!ID_RE.test(options.jobId || "")) throw new Error("job_id is not a valid id");
    this.jobId = options.jobId;
    this.documentId = ID_RE.test(options.documentId || "") ? options.documentId! : "";
    this.httpGet = options.httpGet;
  }

  // 书的块 ----------------------------------------------------------------

  items(): Promise<Item[]> {
    if (!this.itemsPromise) {
      this.itemsPromise = (async () => {
        const reply = await this.httpGet(`/api/v1/jobs/${this.jobId}/reader/regions`, REGIONS_TIMEOUT_MS);
        if (reply.status !== 200) throw new ToolInputError(`读不到这本书的内容（${errorMessage(reply.status, reply.body)}）`);
        const payload = JSON.parse(decode(reply.body));
        const items = payload && typeof payload === "object" ? payload.data?.items : null;
        const list: Item[] = (Array.isArray(items) ? items : []).filter((item: unknown) => item && typeof item === "object");
        this.index = new Map(list.map((item, position) => [String(item.item_id), position]));
        this.loaded = list;
        return list;
      })();
      // 取失败了下次重取（后端刚好重启这种）
      this.itemsPromise.catch(() => {
        this.itemsPromise = null;
      });
    }
    return this.itemsPromise;
  }

  /** 会话一开就在后台把书的块取好，第一问不用等（取不到就算了，用到时再报）。 */
  warm(): void {
    this.items().catch(() => {});
  }

  private pageCount(items: Item[]): number {
    return items.reduce((max, item) => Math.max(max, sourcePage(item)), 0);
  }

  private headingBefore(items: Item[], position: number): Item | null {
    for (let at = position; at >= 0; at -= 1) if (isHeading(items[at])) return items[at];
    return null;
  }

  // 材料 ------------------------------------------------------------------

  /** 这一问带没带字：前端在问题前面附了选中的字或那一块的原文译文。 */
  carriesText(texts: string[]): boolean {
    return texts.some((text) => TEXT_MARKERS.some((marker) => (text || "").includes(marker)));
  }

  /** 带字的问题的一点背景：所在的节、同页前后各一块；问题里写了「第 N 页」就取那一页。书还没取到最多等 1.5 秒。 */
  async background(texts: string[]): Promise<Prefetch | null> {
    let items = this.loaded;
    if (!items) {
      const fetched = await Promise.race([this.items().catch(() => null), sleep(BACKGROUND_WAIT_MS)]);
      if (!fetched || fetched === "timeout") return null;
      items = fetched;
    }
    const anchor = anchorFromTexts(texts, this.jobId);
    const sections: string[] = [];
    const info: { pages: number[]; blocks: number; item_id?: unknown } = { pages: [], blocks: 0 };
    const position = this.index.get(String(anchor?.itemId ?? ""));
    if (position !== undefined) {
      sections.push(this.around(items, position, info, BACKGROUND_NEIGHBORS, MAX_BACKGROUND_BLOCK_CHARS, false));
    }
    for (const page of mentionedPages(texts, anchor)) {
      const [text, count] = this.pageText(items, page, "both", MAX_BACKGROUND_PAGE_CHARS);
      if (count) {
        sections.push(`第 ${page} 页（问题里说到的）：\n${text}`);
        info.pages.push(page);
        info.blocks += count;
      }
    }
    const body = sections.filter(Boolean).join("\n\n");
    if (!body) return null;
    return { text: `【RetainPDF 从书里取的背景（自动附上，页码是原文页码）】\n${body}\n【背景到此为止】`, images: [], info };
  }

  /** 不带字的问题先取好的上下文：提问的那一页（没有文字层附页图）、问题里写的页。认不出位置、也没写页码就是 null。 */
  async prefetch(texts: string[]): Promise<Prefetch | null> {
    const anchor = anchorFromTexts(texts, this.jobId);
    const mentioned = mentionedPages(texts, anchor);
    if (!anchor && !mentioned.length) return null;
    let items: Item[];
    try {
      items = await this.items();
    } catch {
      return null;
    }
    const sections: string[] = [];
    const images: ImagePart[] = [];
    const info: { pages: number[]; blocks: number; images?: number[]; item_id?: unknown } = { pages: [], blocks: 0 };
    const emptyPages: number[] = [];
    if (anchor) {
      const position = this.index.get(String(anchor.itemId ?? ""));
      if (position !== undefined) {
        sections.push(this.around(items, position, info));
      } else {
        const [text, count] = this.pageText(items, anchor.page, "both", MAX_PREFETCH_PAGE_CHARS);
        sections.push(count ? `第 ${anchor.page} 页（提问的那一页）：\n${text}` : "");
        info.pages.push(anchor.page);
        info.blocks += count;
        if (!count) emptyPages.push(anchor.page);
      }
    }
    const pageCount = this.pageCount(items);
    for (const page of mentioned) {
      const [text, count] = this.pageText(items, page, "both", MAX_PREFETCH_PAGE_CHARS);
      info.pages.push(page);
      info.blocks += count;
      if (count) sections.push(`第 ${page} 页（问题里说到的）：\n${text}`);
      else if (page <= pageCount || !pageCount) emptyPages.push(page);
    }
    for (const page of emptyPages.slice(0, 1)) {
      const result = await this.viewPage(page, "source");
      if (!result.isError) {
        images.push(...result.images);
        sections.push(`第 ${page} 页没有文字层（扫描页、整页图），附上这一页的原文图。`);
        info.images = [page];
      }
    }
    const body = sections.filter(Boolean).join("\n\n");
    if (!body) return null;
    return { text: `【RetainPDF 从书里取的上下文（自动附上，页码是原文页码）】\n${body}\n【上下文到此为止】`, images, info };
  }

  /** 系统提示词里的「这本书」：页数和两级以内的目录。取不到书就是空串。 */
  async overview(): Promise<string> {
    if (this.overviewText === null) {
      let items: Item[];
      try {
        items = await this.items();
      } catch {
        return "";
      }
      this.overviewText = this.buildOverview(items);
    }
    return this.overviewText;
  }

  private buildOverview(items: Item[]): string {
    if (!items.length) return "";
    const count = this.pageCount(items);
    let headings = items.filter((item) => isHeading(item) && sourceText(item));
    if (headings.length > MAX_OVERVIEW_ENTRIES) headings = headings.filter((item) => level(item) <= 2);
    if (headings.length > MAX_OVERVIEW_ENTRIES) {
      const top = headings.filter((item) => level(item) <= 1);
      headings = top.length ? top : headings;
    }
    const lines = [`用户正在读的书共 ${count} 页（页码是原文 PDF 的页码）。`];
    if (headings.length) {
      lines.push("目录（标题 ｜ 译文 —— 第几页）：");
      for (const item of headings) {
        const source = clip(sourceText(item), 90);
        const translated = clip(translatedText(item, new Set()), 60);
        const indent = "  ".repeat(Math.min(level(item), 3) - 1);
        lines.push(`${indent}- ${source}${translated && translated !== source ? ` ｜ ${translated}` : ""} —— 第 ${sourcePage(item)} 页`);
      }
    }
    let text = lines.join("\n");
    if (chars(text).length > MAX_OVERVIEW_CHARS) text = chars(text).slice(0, MAX_OVERVIEW_CHARS).join("") + "\n……（目录太长，后面略）";
    return text;
  }

  /** 提问的那一块和同页前后几块，加所在的节。`includeAnchor=false`：那一块前端已经附了，只给前后。 */
  private around(items: Item[], position: number, info: { pages: number[]; blocks: number; item_id?: unknown },
    neighbors = NEIGHBOR_BLOCKS, blockChars = MAX_NEIGHBOR_CHARS, includeAnchor = true): string {
    const anchor = items[position];
    const page = sourcePage(anchor);
    const samePage: number[] = [];
    items.forEach((item, at) => {
      if (sourcePage(item) === page && !SKIP_SUB_TYPES.has(item.sub_type)) samePage.push(at);
    });
    const where = samePage.includes(position) ? samePage.indexOf(position) : 0;
    let window = samePage.slice(Math.max(0, where - neighbors), where + neighbors + 1);
    if (!window.length) window = [position];
    if (!includeAnchor) window = window.filter((at) => at !== position);
    const heading = this.headingBefore(items, position);
    const title = heading ? clip(sourceText(heading), 120) : "";
    const whereText = `第 ${page} 页${heading ? `，所在的节：${title}（第 ${sourcePage(heading)} 页）` : ""}`;
    let lines: string[];
    if (!includeAnchor) {
      if (!window.length) return heading ? `${whereText}。` : "";
      lines = [`${whereText}。提问那一块的前后（同一页）：`];
    } else {
      lines = [`${whereText}。▶ 是提问的那一块，前后是同一页的块：`];
    }
    const seen = new Set<string>();
    for (const at of window) {
      const limit = at === position ? MAX_ANCHOR_CHARS : blockChars;
      lines.push("");
      lines.push(...blockLines(items[at], "both", seen, limit, at === position ? "▶ " : ""));
    }
    info.pages.push(page);
    info.blocks += window.length;
    info.item_id = anchor.item_id;
    return lines.join("\n");
  }

  private pageText(items: Item[], page: number, side: string, budget: number): [string, number] {
    const blocks = items.filter((item) => sourcePage(item) === page && !SKIP_SUB_TYPES.has(item.sub_type));
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const item of blocks) {
      lines.push("");
      lines.push(...blockLines(item, side, seen, MAX_ANCHOR_CHARS));
    }
    let text = lines.join("\n").trim();
    if (chars(text).length > budget) text = chars(text).slice(0, budget).join("") + "\n……（这一页后面截掉了）";
    return [text, blocks.length];
  }

  // 工具 ----------------------------------------------------------------

  async run(name: string, args: Record<string, any>): Promise<ToolResult> {
    try {
      if (name === "read_pages" || name === "read_page") return await this.readPages(toPages(args), String(args.side || "both"));
      if (name === "search_book") return await this.searchBook(String(args.query ?? ""), args.limit);
      if (name === "view_page") return await this.viewPage(toPage(args.page), String(args.side || "source"));
      return toolError(`没有工具 ${name}；能用的是 read_pages、search_book、view_page。`);
    } catch (error) {
      if (error instanceof ToolInputError) return toolError(error.message);
      if (error instanceof SyntaxError) return toolError(`后端回的数据读不懂：${error.message}`);
      return toolError(`连不上 RetainPDF 后端：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private checkPage(items: Item[], page: number): void {
    const count = this.pageCount(items);
    if (count === 0) throw new ToolInputError("这本书还没有识别出文字（没有可读的块），可以用 view_page 看图。");
    if (page > count) throw new ToolInputError(`没有第 ${page} 页：这本书有文字的页是 1–${count}。`);
  }

  async readPages(pages: number[], side: string): Promise<ToolResult> {
    if (!["both", "source", "translated"].includes(side)) throw new ToolInputError("side 要是 both、source 或 translated");
    const items = await this.items();
    for (const page of pages) this.checkPage(items, page);
    const budget = Math.min(MAX_PAGE_CHARS, Math.floor(MAX_READ_CHARS / pages.length));
    const parts: string[] = [];
    const counts: string[] = [];
    for (const page of pages) {
      const [text, count] = this.pageText(items, page, side, budget);
      parts.push(`=== 第 ${page} 页（${count} 块）===\n${text || "没有文字块（可能是整页图片或空白页），要看可以用 view_page。"}`);
      counts.push(`第 ${page} 页 ${count} 块`);
    }
    return ok(parts.join("\n\n"), counts.join("，"));
  }

  async searchBook(query: string, limitValue?: unknown): Promise<ToolResult> {
    const terms = query.split(/\s+/u).filter((term) => term.trim()).map((term) => term.toLowerCase());
    if (!terms.length) throw new ToolInputError("query 不能是空的");
    let limit = DEFAULT_SEARCH_LIMIT;
    if (limitValue !== undefined && limitValue !== null) {
      const parsed = Math.trunc(Number(limitValue));
      if (Number.isFinite(parsed)) limit = Math.max(1, Math.min(MAX_SEARCH_LIMIT, parsed));
    }
    const items = await this.items();
    const hits: Array<[number, Item, string, string]> = [];
    items.forEach((item, at) => {
      if (SKIP_SUB_TYPES.has(item.sub_type)) return;
      const source = sourceText(item);
      const own = translatedText(item, new Set());
      // 跨块的段落也按整段的译文找（词可能落在同段的别的块里）
      const whole = String(item.translated?.text ?? "").trim();
      const translated = terms.every((term) => own.toLowerCase().includes(term)) || !whole ? own : whole;
      const haystack = `${source}\n${own}\n${whole}`.toLowerCase();
      if (terms.every((term) => haystack.includes(term))) hits.push([at, item, source, translated]);
    });
    if (!hits.length) {
      return ok(`没找到「${query}」。可以换原文或译文的说法再找一次，或者照目录读那几页。`, `「${clip(query, 40)}」没找到`);
    }
    const pages = [...new Set(hits.map(([, item]) => sourcePage(item)))].sort((a, b) => a - b);
    const lines = [`「${query}」找到 ${hits.length} 处（${pages.length} 页）${hits.length > limit ? `，列前 ${limit} 处` : ""}：`];
    let size = chars(lines[0]).length;
    let shown = 0;
    for (const [at, item, source, translated] of hits.slice(0, limit)) {
      const heading = this.headingBefore(items, at);
      const section = heading && heading !== item ? `，${clip(sourceText(heading), 80)}` : "";
      const entry = [`\n第 ${sourcePage(item)} 页${section} [${item.item_id}] ${kind(item)}`];
      if (source) entry.push(`原文：${windowAround(source, terms, HIT_SOURCE_CHARS)}`);
      if (translated) entry.push(`译文：${windowAround(translated, terms, HIT_TRANSLATED_CHARS)}`);
      const block = entry.join("\n");
      if (size + chars(block).length > MAX_SEARCH_CHARS && shown) break;
      lines.push(block);
      size += chars(block).length;
      shown += 1;
    }
    if (hits.length > shown) {
      lines.push(`\n全部命中的页：${pages.slice(0, 80).join(", ")}${pages.length > 80 ? " ……" : ""}`);
    }
    return ok(lines.join("\n"), `「${clip(query, 40)}」${hits.length} 处，${pages.length} 页`);
  }

  async viewPage(page: number, side: string): Promise<ToolResult> {
    if (side !== "source" && side !== "translated") throw new ToolInputError("side 要是 source（原文页）或 translated（译文页）");
    let label = `第 ${page} 页${side === "translated" ? "译文" : "原文"}`;
    let path: string;
    if (side === "source" && this.documentId) {
      path = `/api/v1/documents/${this.documentId}/files/pages/${page}.jpg?width=${PAGE_IMAGE_WIDTH}`;
    } else {
      // 译文页按任务自己的页号取（只翻了部分页的任务和原文页码不一样）。不知道书编号时原文页取不到，给译文页
      if (side === "source") label = `第 ${page} 页译文（这本书的原文页图取不到）`;
      path = `/api/v1/jobs/${this.jobId}/files/pages/${await this.translatedPage(page)}.jpg?width=${PAGE_IMAGE_WIDTH}`;
    }
    const reply = await this.httpGet(path, IMAGE_TIMEOUT_MS);
    if (reply.status !== 200) {
      const hint = decode(reply.body).includes("not_ready") ? "（这一页还没排好，或这个任务没有译文 PDF）" : "";
      return toolError(`取不到${label}的图：${errorMessage(reply.status, reply.body)}${hint}`);
    }
    const mime = (reply.contentType.split(";")[0] || "").trim().toLowerCase() || "image/jpeg";
    if (!mime.startsWith("image/")) return toolError(`取不到${label}的图：后端回的不是图片（${mime}）`);
    if (reply.body.length > MAX_IMAGE_BYTES) {
      return toolError(`${label}的图太大（${Math.floor(reply.body.length / 1024)} KB），没有给你看；用 read_pages 读文字。`);
    }
    return ok(`${label}的图（宽 ${PAGE_IMAGE_WIDTH} 像素）。`, `${label}的图，${Math.floor(reply.body.length / 1024)} KB`,
      [{ mimeType: mime, data: Buffer.from(reply.body).toString("base64") }]);
  }

  private async translatedPage(page: number): Promise<number> {
    let items: Item[];
    try {
      items = await this.items();
    } catch {
      return page;
    }
    for (const item of items) {
      if (sourcePage(item) === page) {
        const translated = item.translated?.page;
        if (Number.isInteger(translated) && translated >= 1) return translated;
      }
    }
    return page;
  }
}

/** 按桥给的环境变量建工具；缺书或缺后端地址就不给工具（只靠问题里附的上下文）。 */
export function makeBookTools(env: { jobId?: string; documentId?: string; baseUrl?: string; apiKey?: string },
  httpGet?: HttpGet): BookTools | null {
  const jobId = (env.jobId || "").trim();
  const baseUrl = (env.baseUrl || "").trim();
  if (!jobId || !baseUrl || !ID_RE.test(jobId)) return null;
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.host) return null;
  return new BookTools({ jobId, documentId: (env.documentId || "").trim(), httpGet: httpGet ?? defaultHttpGet(baseUrl, (env.apiKey || "").trim()) });
}
