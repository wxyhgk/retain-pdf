import { type RenderLayoutDocument, type RenderLayoutFont } from "../shared/data/render-layout.js";
/** 字体栈：清单里的字体按顺序（第一个是主字体，后面是后备），最后落到系统衬线。 */
export declare function renderLayoutFontFamily(fonts: readonly RenderLayoutFont[]): string;
/**
 * 装清单里的字体；主字体（清单里第一个字族）的每个字重都装上了才返回 true。
 * 主字体缺一个字重，浏览器会拿别的字重顶上（常规变粗），这时不照版面画，退回按 OCR 的框塞字。
 * 后备字体装不上不要紧（浏览器逐字落到下一个）：NewCM10 的 otf 在 Chrome 里一直装不上（字体检查拒了），等后端给 woff2。
 */
export declare function installRenderLayoutFonts(fonts: readonly RenderLayoutFont[]): Promise<boolean>;
export declare function useRenderLayout(): RenderLayoutDocument | null;
//# sourceMappingURL=use-render-layout.d.ts.map