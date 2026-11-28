// 排版引擎的版面（rpr_layout_v1，backend/rendering-engine 的 src/output/pdf/layout.js）：译文 PDF 就是照这份画的。
// HTML 页照它画（pdf/LayoutPageLayer.tsx，2026-11-28 用户：「为什么这里的 html 渲染和我们自己的 html 排版不一样？能不能一样？」），
// 画出来就是译文 PDF 本身，只是每个字都是能动的元素。
//
// 坐标：pt，原点在页左上，y 向下（和 OCR 的框一样）。page.index 是原文页号（从 0 起）；没有译文条目的页（整页图、不翻的参考文献）
// 不在 pages 里，按原页画。公式查不过、改回原文的块也不在里面（PDF 那块盖回了原件）。表格不在里面（rpr-table 另一遍叠上去的）。
// 后端（2026-11-28 回话）：块 id 就是 /reader/regions 的 item_id；跨页、跨栏续段每一截各是一块；covers 的填色是估的原页底色。
//
// 数据从哪来：后端把它存成任务产物、按页给接口还在做（docs/ops/planning/reader-redesign/20261128-HTML页照排版结果画-后端需求.md）；
// 接口出来之前，开发时在阅读页地址上加 ?render_layout=<清单地址>，清单是
//   { "layout": "layout.json", "fonts": [{ "family": "…", "weight": 400, "url": "…" }] }（地址相对清单）。

export type RenderLayoutCover = { block: string; rect: [number, number, number, number]; fill: [number, number, number] };

export type RenderLayoutItem =
  | { x: number; t: string; mode?: "dflt" }
  | { x: number; tex: string; display?: boolean; w: number; h: number; d: number };

export type RenderLayoutLine = { text: string; x: number; baseline: number; width: number; justified?: boolean; items: RenderLayoutItem[] };

export type RenderLayoutBlock = {
  id: string;
  fontSize: number;
  weight: "regular" | "bold";
  color: [number, number, number];
  lines: RenderLayoutLine[];
};

export type RenderLayoutPage = { index: number; width: number; height: number; covers: RenderLayoutCover[]; blocks: RenderLayoutBlock[] };

export type RenderLayoutFont = { family: string; weight: number; url: string };

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
export function normalizeRenderLayout(raw: unknown, fonts: readonly RenderLayoutFont[] = []): RenderLayoutDocument | null {
  const object = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!object || !`${object.schema || ""}`.startsWith("rpr_layout_")) return null;
  const pages = new Map<number, RenderLayoutPage>();
  for (const rawPage of Array.isArray(object.pages) ? object.pages : []) {
    const page = rawPage as Record<string, unknown>;
    const index = Math.floor(num(page.index));
    if (index < 0 || !(num(page.width) > 0) || !(num(page.height) > 0)) continue;
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
            return [{ x: num(item.x), tex: item.tex, display: Boolean(item.display), w: num(item.w), h: num(item.h), d: num(item.d) }];
          }
          if (typeof item.t === "string" && item.t) {
            return [item.mode === "dflt" ? { x: num(item.x), t: item.t, mode: "dflt" as const } : { x: num(item.x), t: item.t }];
          }
          return [];
        });
        return { text: `${line.text || ""}`, x: num(line.x), baseline: num(line.baseline), width: num(line.width), justified: Boolean(line.justified), items };
      });
      return [{ id: `${block.id || ""}`, fontSize, weight: block.weight === "bold" ? "bold" : "regular", color: triple(block.color), lines }];
    });
    pages.set(index + 1, { index, width: num(page.width), height: num(page.height), covers, blocks });
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
