// 排版引擎的版面（shared/data/render-layout.ts）读进来，字体装上（FontFace，和引擎同一份文件）。
// 后端接口还在做；现在只有开发时阅读页地址上带 ?render_layout=<清单地址> 才读，没有就是 null（HTML 页退回按 OCR 的框塞字）。
import { useEffect, useState } from "react";

import { loadRenderLayoutManifest, type RenderLayoutDocument, type RenderLayoutFont } from "../shared/data/render-layout.js";

/** 字体栈：清单里的字体按顺序（第一个是主字体，后面是后备），最后落到系统衬线。 */
export function renderLayoutFontFamily(fonts: readonly RenderLayoutFont[]): string {
  const families = [...new Set(fonts.map((font) => font.family))];
  return [...families.map((family) => `"${family.replace(/"/g, "")}"`), "serif"].join(", ");
}

const loadedFonts = new Set<string>();

/** 装一个字体，失败重试一次（大字体文件偶尔读断，2026-11-28 实测思源宋体常规 24 MB 读断时浏览器拿粗体顶上，整页字变粗）。 */
async function installFont(font: RenderLayoutFont): Promise<boolean> {
  const key = `${font.family}|${font.weight}|${font.url}`;
  if (loadedFonts.has(key)) return true;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const face = new FontFace(font.family, `url(${JSON.stringify(font.url)})`, { weight: `${font.weight}` });
      document.fonts.add(await face.load());
      loadedFonts.add(key);
      return true;
    } catch (error) {
      if (attempt === 1) console.warn("[render-layout] 字体没装上：", font.family, font.url, error);
    }
  }
  return false;
}

/**
 * 装清单里的字体；主字体（清单里第一个字族）的每个字重都装上了才返回 true。
 * 主字体缺一个字重，浏览器会拿别的字重顶上（常规变粗），这时不照版面画，退回按 OCR 的框塞字。
 * 后备字体装不上不要紧（浏览器逐字落到下一个）：NewCM10 的 otf 在 Chrome 里一直装不上（字体检查拒了），等后端给 woff2。
 */
export async function installRenderLayoutFonts(fonts: readonly RenderLayoutFont[]): Promise<boolean> {
  if (typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts) return false;
  const primary = fonts[0]?.family;
  const results = await Promise.all(fonts.map(async (font) => ({ font, ok: await installFont(font) })));
  return Boolean(primary) && results.every(({ font, ok }) => ok || font.family !== primary);
}

function manifestUrlFromLocation(): string {
  try {
    return new URLSearchParams(globalThis.location?.search || "").get("render_layout") || "";
  } catch {
    return "";
  }
}

export function useRenderLayout(): RenderLayoutDocument | null {
  const [layout, setLayout] = useState<RenderLayoutDocument | null>(null);
  useEffect(() => {
    const url = manifestUrlFromLocation();
    if (!url) return undefined;
    let alive = true;
    void loadRenderLayoutManifest(url)
      .then(async (loaded) => {
        if (!loaded) return;
        // 字体装好再画，不然先按系统字体画一遍、字宽不对；主字体没装全就不照版面画。
        const ok = await installRenderLayoutFonts(loaded.fonts);
        if (!ok) {
          console.warn("[render-layout] 主字体没装全，HTML 页退回按 OCR 的框塞字");
          return;
        }
        if (alive) setLayout(loaded);
      })
      .catch((error) => console.warn("[render-layout] 版面没读到：", url, error));
    return () => {
      alive = false;
    };
  }, []);
  return layout;
}
