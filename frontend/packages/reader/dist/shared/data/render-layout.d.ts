export type RenderLayoutCover = {
    block: string;
    rect: [number, number, number, number];
    fill: [number, number, number];
};
export type RenderLayoutItem = {
    x: number;
    t: string;
    mode?: "dflt";
} | {
    x: number;
    tex: string;
    display?: boolean;
    w: number;
    h: number;
    d: number;
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
export type RenderLayoutFont = {
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
export declare function normalizeRenderLayout(raw: unknown, fonts?: readonly RenderLayoutFont[]): RenderLayoutDocument | null;
/** 开发用的清单（?render_layout=）：读清单、读 layout.json，字体地址按清单地址解析。 */
export declare function loadRenderLayoutManifest(manifestUrl: string, fetcher?: typeof fetch): Promise<RenderLayoutDocument | null>;
//# sourceMappingURL=render-layout.d.ts.map