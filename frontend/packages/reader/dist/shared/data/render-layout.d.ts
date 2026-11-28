export type RenderLayoutCover = {
    block: string;
    rect: [number, number, number, number];
    fill: [number, number, number];
};
/** 字簇：font 是清单 fonts[].key（2026-11-28 以后排的版面才有）；公式：svg 是后端存的那份 MathJax 输出（同上）。 */
export type RenderLayoutItem = {
    x: number;
    t: string;
    mode?: "dflt";
    font?: string;
} | {
    x: number;
    tex: string;
    display?: boolean;
    w: number;
    h: number;
    d: number;
    svg?: string;
};
export type RenderLayoutLine = {
    text: string;
    x: number;
    baseline: number;
    width: number;
    justified?: boolean;
    items: RenderLayoutItem[];
};
export type RenderLayoutBlock = {
    id: string;
    fontSize: number;
    weight: "regular" | "bold";
    color: [number, number, number];
    lines: RenderLayoutLine[];
};
export type RenderLayoutPage = {
    index: number;
    width: number;
    height: number;
    covers: RenderLayoutCover[];
    blocks: RenderLayoutBlock[];
};
/** 字体：key 对应字簇的 font；family 是装到浏览器里的名字（加 RPR 前缀，不和本机装的同名字体混）。 */
export type RenderLayoutFont = {
    key?: string;
    family: string;
    weight: number;
    url: string;
};
export type RenderLayoutDocument = {
    schema: string;
    /** 按原文页号（从 1 起，和阅读页的页码一样）。 */
    pages: ReadonlyMap<number, RenderLayoutPage>;
    fonts: readonly RenderLayoutFont[];
};
/** 引擎的颜色是 0–1；保险起见 >1 的当 0–255。 */
export declare function layoutColor([r, g, b]: readonly [number, number, number]): string;
/** layout.json（整份）→ 按页码（从 1 起）的版面；看不懂的项丢掉，不让一项坏的拖垮整页。 */
/** 一页（rpr_layout_v1 里的一页，或接口 /reader/layout/pages/:idx 的 data）→ 规范的一页；看不懂是 null。 */
export declare function normalizeRenderLayoutPage(raw: unknown): RenderLayoutPage | null;
/** layout.json（整份）→ 按页码（从 1 起）的版面；看不懂的项丢掉，不让一项坏的拖垮整页。 */
export declare function normalizeRenderLayout(raw: unknown, fonts?: readonly RenderLayoutFont[]): RenderLayoutDocument | null;
/** 开发用的清单（?render_layout=）：读清单、读 layout.json，字体地址按清单地址解析。 */
export declare function loadRenderLayoutManifest(manifestUrl: string, fetcher?: typeof fetch): Promise<RenderLayoutDocument | null>;
/** 补排的请求（清单 generate，照原样发）：原地重新渲染，不调模型、不花钱。 */
export type RenderLayoutGenerate = {
    method: string;
    url: string;
    body: unknown;
};
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
    background: {
        url: string;
        pageFor(page: number): number | null;
    } | null;
};
/** 清单（GET /jobs/:id/reader/layout）里阅读页用到的。没有版面时 source 是 null，reason / generate 说为什么、能不能补。 */
export type RenderLayoutManifest = {
    available: boolean;
    reason: string | null;
    generate: RenderLayoutGenerate | null;
    source: RenderLayoutSource | null;
};
/** 这几种是后端正在补，前端只要隔几秒再问清单。 */
export declare const RENDER_LAYOUT_PENDING_REASONS: ReadonlySet<string>;
export declare function renderLayoutReason(value: unknown): string;
/** 字体在浏览器里的名字：加 RPR 前缀，不和本机装的同名字体（思源宋体……）混。 */
export declare const layoutFontFamily: (family: string) => string;
/** 正式接口的清单 → 版面来源。apiPrefix 是 /api/v1 这种；fetcher 要带授权（fetchProtected）。 */
export declare function loadRenderLayoutFromApi(jobId: string, { apiPrefix, fetcher }: {
    apiPrefix?: string;
    fetcher: typeof fetch;
}): Promise<RenderLayoutManifest>;
/** 开发用的整份版面（?render_layout=）→ 版面来源：页都在手里，公式前端自己画，字体直接按地址取。 */
export declare function renderLayoutSourceFromDocument(doc: RenderLayoutDocument, fetcher?: typeof fetch): RenderLayoutSource;
//# sourceMappingURL=render-layout.d.ts.map