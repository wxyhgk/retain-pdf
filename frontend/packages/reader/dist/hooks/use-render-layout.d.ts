import { type RenderLayoutFont, type RenderLayoutGenerate, type RenderLayoutSource } from "../shared/data/render-layout.js";
/** 字体栈：清单里的字族按顺序（第一个是主字体，后面是后备），最后落到系统衬线。 */
export declare function renderLayoutFontFamily(fonts: readonly RenderLayoutFont[]): string;
/**
 * 装清单里的字体；主字体（清单里第一个字族）的每个字重都装上了才返回 true，清单是空的也是 false。
 * 主字体缺一个字重，浏览器会拿别的字重顶上（常规变粗）。后备字体装不上不要紧（浏览器逐字落到下一个）。
 */
export declare function installRenderLayoutFonts(fonts: readonly RenderLayoutFont[], load: (font: RenderLayoutFont) => Promise<ArrayBuffer>): Promise<boolean>;
export type RenderLayoutState = {
    status: "idle" | "loading";
} | {
    status: "ready";
    source: RenderLayoutSource;
    fontFamily: string;
}
/** 没有版面：reason 是后端给的原因，或 no_fonts（清单里没有字体 / 主字体没装上）、failed（清单没要到）。 */
 | {
    status: "unavailable";
    reason: string;
    generate: RenderLayoutGenerate | null;
} | {
    status: "generating";
};
type DataPort = {
    apiPrefix: string;
    fetchProtected: typeof fetch;
};
/**
 * 宿主没给数据端口（单测、纯本地 PDF）时是 null。
 * 接口给的地址是 /api/v1/… 这种相对的：先按宿主的后端地址补全（resolveResourceUrl），不然请求落到前端的静态服务器上
 * （2026-11-28 实测开发栈：前端 40001、后端 41000，清单 404）。
 */
export declare function readRenderLayoutPort(): DataPort | null;
/** jobId：要哪本书的版面；enabled：开了 HTML 页才去要（开发参数不管开没开都读）。 */
export declare function useRenderLayout(jobId: string, enabled: boolean): RenderLayoutState & {
    generateNow: () => void;
};
export {};
//# sourceMappingURL=use-render-layout.d.ts.map