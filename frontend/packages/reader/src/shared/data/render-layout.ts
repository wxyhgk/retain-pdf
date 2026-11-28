// 排版引擎的版面（rpr_layout_v1，backend/rendering-engine 的 src/output/pdf/layout.js）：译文 PDF 就是照这份画的。
// HTML 页照它画（pdf/LayoutPageLayer.tsx，2026-11-28 用户：「为什么这里的 html 渲染和我们自己的 html 排版不一样？能不能一样？」），
// 画出来就是译文 PDF 本身，只是每个字都是能动的元素。
//
// 坐标：pt，原点在页左上，y 向下（和 OCR 的框一样）。page.index 是原文页号（从 0 起）；没有译文条目的页（整页图、不翻的参考文献）
// 不在 pages 里，按原页画。公式查不过、改回原文的块也不在里面（PDF 那块盖回了原件）。表格不在里面（rpr-table 另一遍叠上去的）。
// 后端（2026-11-28 回话）：块 id 就是 /reader/regions 的 item_id；跨页、跨栏续段每一截各是一块；covers 的填色是估的原页底色。
//
// 数据从哪来（RenderLayoutSource，按页取）：
// - 正式接口（2026-11-28 后端 #241 / #242，docs/api/12-阅读/01-阅读接口.md「排版引擎的版面」）：
//   清单 GET /jobs/:id/reader/layout（有没有、为什么没有、补排的请求、底图、字体），一页 GET …/reader/layout/pages/:idx，
//   公式 SVG GET …/reader/layout/math/<哈希>.svg，字体 …/reader/layout/fonts/<key>.woff2。都要带授权，走 fetchProtected。
// - 开发用：阅读页地址上加 ?render_layout=<清单地址>，清单 { "layout": "layout.json", "fonts": [{ family, weight, url }] }（地址相对清单）。

export type RenderLayoutCover = { block: string; rect: [number, number, number, number]; fill: [number, number, number] };

/** 字簇：font 是清单 fonts[].key（2026-11-28 以后排的版面才有）；公式：svg 是后端存的那份 MathJax 输出（同上）。 */
export type RenderLayoutItem =
  | { x: number; t: string; mode?: "dflt"; font?: string }
  | { x: number; tex: string; display?: boolean; w: number; h: number; d: number; svg?: string };

export type RenderLayoutLine = { text: string; x: number; baseline: number; width: number; justified?: boolean; items: RenderLayoutItem[] };

export type RenderLayoutBlock = {
  id: string;
  fontSize: number;
  weight: "regular" | "bold";
  color: [number, number, number];
  lines: RenderLayoutLine[];
};

export type RenderLayoutPage = { index: number; width: number; height: number; covers: RenderLayoutCover[]; blocks: RenderLayoutBlock[] };

/** 字体：key 对应字簇的 font；family 是装到浏览器里的名字（加 RPR 前缀，不和本机装的同名字体混）。 */
export type RenderLayoutFont = { key?: string; family: string; weight: number; url: string };

export type RenderLayoutDocument = {
  schema: string;
  /** 按原文页号（从 1 起，和阅读页的页码一样）。 */
  pages: ReadonlyMap<number, RenderLayoutPage>;
  fonts: readonly RenderLayoutFont[];
};

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const triple = (value: unknown): [number, number, number] => {
  const list = Array.isArray(value) ? value : [];
  return [num(list[0]), num(list[1]), num(list[2])];
};

/** 引擎的颜色是 0–1；保险起见 >1 的当 0–255。 */
export function layoutColor([r, g, b]: readonly [number, number, number]): string {
  const scale = Math.max(r, g, b) > 1 ? 1 : 255;
  const channel = (value: number) => Math.round(Math.min(255, Math.max(0, value * scale)));
  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
}

/** layout.json（整份）→ 按页码（从 1 起）的版面；看不懂的项丢掉，不让一项坏的拖垮整页。 */
/** 一页（rpr_layout_v1 里的一页，或接口 /reader/layout/pages/:idx 的 data）→ 规范的一页；看不懂是 null。 */
export function normalizeRenderLayoutPage(raw: unknown): RenderLayoutPage | null {
  const page = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!page) return null;
  const index = Math.floor(num(page.index));
  if (index < 0 || !(num(page.width) > 0) || !(num(page.height) > 0)) return null;
  const covers: RenderLayoutCover[] = (Array.isArray(page.covers) ? page.covers : []).flatMap((rawCover) => {
    const cover = rawCover as Record<string, unknown>;
    const rect = Array.isArray(cover.rect) ? cover.rect.map(num) : [];
    return rect.length === 4 && rect[2] > rect[0] && rect[3] > rect[1]
      ? [{ block: `${cover.block || ""}`, rect: rect as [number, number, number, number], fill: triple(cover.fill) }]
      : [];
  });
  const blocks: RenderLayoutBlock[] = (Array.isArray(page.blocks) ? page.blocks : []).flatMap((rawBlock) => {
    const block = rawBlock as Record<string, unknown>;
    const fontSize = num(block.fontSize);
    if (!(fontSize > 0)) return [];
    const lines: RenderLayoutLine[] = (Array.isArray(block.lines) ? block.lines : []).map((rawLine) => {
      const line = rawLine as Record<string, unknown>;
      const items: RenderLayoutItem[] = (Array.isArray(line.items) ? line.items : []).flatMap((rawItem): RenderLayoutItem[] => {
        const item = rawItem as Record<string, unknown>;
        if (typeof item.tex === "string") {
          return [{
            x: num(item.x), tex: item.tex, display: Boolean(item.display), w: num(item.w), h: num(item.h), d: num(item.d),
            ...(typeof item.svg === "string" && item.svg ? { svg: item.svg } : {}),
          }];
        }
        if (typeof item.t === "string" && item.t) {
          return [{
            x: num(item.x), t: item.t,
            ...(item.mode === "dflt" ? { mode: "dflt" as const } : {}),
            ...(typeof item.font === "string" && item.font ? { font: item.font } : {}),
          }];
        }
        return [];
      });
      return { text: `${line.text || ""}`, x: num(line.x), baseline: num(line.baseline), width: num(line.width), justified: Boolean(line.justified), items };
    });
    return [{ id: `${block.id || ""}`, fontSize, weight: block.weight === "bold" ? "bold" : "regular", color: triple(block.color), lines }];
  });
  return { index, width: num(page.width), height: num(page.height), covers, blocks };
}

/** layout.json（整份）→ 按页码（从 1 起）的版面；看不懂的项丢掉，不让一项坏的拖垮整页。 */
export function normalizeRenderLayout(raw: unknown, fonts: readonly RenderLayoutFont[] = []): RenderLayoutDocument | null {
  const object = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!object || !`${object.schema || ""}`.startsWith("rpr_layout_")) return null;
  const pages = new Map<number, RenderLayoutPage>();
  for (const rawPage of Array.isArray(object.pages) ? object.pages : []) {
    const page = normalizeRenderLayoutPage(rawPage);
    if (page) pages.set(page.index + 1, page);
  }
  return { schema: `${object.schema}`, pages, fonts };
}

/** 开发用的清单（?render_layout=）：读清单、读 layout.json，字体地址按清单地址解析。 */
export async function loadRenderLayoutManifest(manifestUrl: string, fetcher: typeof fetch = fetch): Promise<RenderLayoutDocument | null> {
  const base = new URL(manifestUrl, globalThis.location?.href);
  const manifest = await (await fetcher(base.href)).json() as { layout?: string; fonts?: { family?: string; weight?: number; url?: string }[] };
  const fonts: RenderLayoutFont[] = (manifest.fonts || []).flatMap((font) => (font.family && font.url
    ? [{ family: font.family, weight: num(font.weight) || 400, url: new URL(font.url, base).href }]
    : []));
  const layout = await (await fetcher(new URL(manifest.layout || "layout.json", base).href)).json();
  return normalizeRenderLayout(layout, fonts);
}

// —— 版面来源（按页取）：正式接口和开发用的清单都给成这个样子，HTML 页只认它 ——

/** 补排的请求（清单 generate，照原样发）：原地重新渲染，不调模型、不花钱。 */
export type RenderLayoutGenerate = { method: string; url: string; body: unknown };

export type RenderLayoutSource = {
  schema: string;
  /** 有版面的页（阅读页的页码，从 1 起）。 */
  pages: ReadonlySet<number>;
  fonts: readonly RenderLayoutFont[];
  loadPage(page: number): Promise<RenderLayoutPage | null>;
  /** 后端存的那份公式 SVG（字簇的 svg 字段）；取不到是 null（前端自己画）。 */
  loadMath(svg: string): Promise<string | null>;
  /** 取字体文件（要带授权的走 fetchProtected）。 */
  loadFont(font: RenderLayoutFont): Promise<ArrayBuffer>;
  /** 底图（去掉原字的原文页，译文 PDF 的底）：地址，和阅读页第 page 页在底图里是第几页（从 1 起）；没有是 null，用原文页做底。 */
  background: { url: string; pageFor(page: number): number | null } | null;
};

/** 清单（GET /jobs/:id/reader/layout）里阅读页用到的。没有版面时 source 是 null，reason / generate 说为什么、能不能补。 */
export type RenderLayoutManifest = {
  available: boolean;
  reason: string | null;
  generate: RenderLayoutGenerate | null;
  source: RenderLayoutSource | null;
};

/**
 * 认得的「没有版面」原因；认不得的当 not_kept（后端约定以后可能加值）。
 * backfill_queued / job_active（后端 #245，2026-11-28）：旧书没留版面时后端自己在后台原地补排，排上了 / 正在跑，跑完清单就是 available。
 */
const KNOWN_REASONS = new Set(["no_translated_pdf", "not_engine_route", "unsupported_render", "merged_reading", "not_kept", "backfill_queued", "job_active"]);

/** 这几种是后端正在补，前端只要隔几秒再问清单。 */
export const RENDER_LAYOUT_PENDING_REASONS: ReadonlySet<string> = new Set(["backfill_queued", "job_active"]);

export function renderLayoutReason(value: unknown): string {
  const reason = `${value || ""}`.trim();
  return KNOWN_REASONS.has(reason) ? reason : "not_kept";
}

const unwrap = (payload: unknown): Record<string, unknown> | null => {
  const object = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const data = object && object.data && typeof object.data === "object" ? (object.data as Record<string, unknown>) : null;
  return data ?? object;
};

/** 字体在浏览器里的名字：加 RPR 前缀，不和本机装的同名字体（思源宋体……）混。 */
export const layoutFontFamily = (family: string) => `RPR ${family}`;

/** 正式接口的清单 → 版面来源。apiPrefix 是 /api/v1 这种；fetcher 要带授权（fetchProtected）。 */
export async function loadRenderLayoutFromApi(
  jobId: string,
  { apiPrefix = "/api/v1", fetcher }: { apiPrefix?: string; fetcher: typeof fetch },
): Promise<RenderLayoutManifest> {
  const base = `${apiPrefix.replace(/\/$/, "")}/jobs/${encodeURIComponent(jobId)}/reader/layout`;
  const response = await fetcher(base);
  if (!response.ok) throw new Error(`版面清单 HTTP ${response.status}`);
  const view = unwrap(await response.json()) ?? {};
  const generateRaw = view.generate && typeof view.generate === "object" ? (view.generate as Record<string, unknown>) : null;
  const generate = generateRaw && generateRaw.url ? { method: `${generateRaw.method || "POST"}`, url: `${generateRaw.url}`, body: generateRaw.body ?? null } : null;
  if (!view.available) return { available: false, reason: renderLayoutReason(view.reason), generate, source: null };

  const pageUrls = new Map<number, string>();
  for (const rawPage of Array.isArray(view.pages) ? view.pages : []) {
    const page = rawPage as Record<string, unknown>;
    const index = Math.floor(num(page.index));
    if (index >= 0) pageUrls.set(index + 1, `${page.url || `${base}/pages/${index}`}`);
  }
  const fonts: RenderLayoutFont[] = (Array.isArray(view.fonts) ? view.fonts : []).flatMap((rawFont) => {
    const font = rawFont as Record<string, unknown>;
    return font.family && font.url
      ? [{ key: `${font.key || ""}` || undefined, family: layoutFontFamily(`${font.family}`), weight: num(font.weight) || 400, url: `${font.url}` }]
      : [];
  });
  const bg = view.background && typeof view.background === "object" ? (view.background as Record<string, unknown>) : null;
  const bgPages = Array.isArray(bg?.pages) ? (bg!.pages as unknown[]).map((value) => Math.floor(num(value))) : [];
  const background = bg?.url
    ? {
      url: `${bg.url}`,
      pageFor(page: number) {
        const at = bgPages.indexOf(page - 1);
        return at >= 0 ? at + 1 : null;
      },
    }
    : null;
  const pageCache = new Map<number, Promise<RenderLayoutPage | null>>();
  const mathCache = new Map<string, Promise<string | null>>();
  const source: RenderLayoutSource = {
    schema: `${view.schema || "rpr_layout_v1"}`,
    pages: new Set(pageUrls.keys()),
    fonts,
    background,
    loadPage(page) {
      const url = pageUrls.get(page);
      if (!url) return Promise.resolve(null);
      let entry = pageCache.get(page);
      if (!entry) {
        entry = fetcher(url)
          .then(async (res) => (res.ok ? normalizeRenderLayoutPage(unwrap(await res.json())) : null))
          .catch(() => null);
        pageCache.set(page, entry);
      }
      return entry;
    },
    loadMath(svg) {
      let entry = mathCache.get(svg);
      if (!entry) {
        entry = fetcher(`${base}/${svg.replace(/^\/+/, "")}`)
          .then(async (res) => (res.ok ? res.text() : null))
          .catch(() => null);
        mathCache.set(svg, entry);
      }
      return entry;
    },
    async loadFont(font) {
      const res = await fetcher(font.url);
      if (!res.ok) throw new Error(`字体 HTTP ${res.status}`);
      return res.arrayBuffer();
    },
  };
  return { available: true, reason: null, generate, source };
}

/** 开发用的整份版面（?render_layout=）→ 版面来源：页都在手里，公式前端自己画，字体直接按地址取。 */
export function renderLayoutSourceFromDocument(doc: RenderLayoutDocument, fetcher: typeof fetch = fetch): RenderLayoutSource {
  return {
    schema: doc.schema,
    pages: new Set(doc.pages.keys()),
    fonts: doc.fonts,
    background: null,
    loadPage: (page) => Promise.resolve(doc.pages.get(page) ?? null),
    loadMath: () => Promise.resolve(null),
    async loadFont(font) {
      const res = await fetcher(font.url);
      if (!res.ok) throw new Error(`字体 HTTP ${res.status}`);
      return res.arrayBuffer();
    },
  };
}
