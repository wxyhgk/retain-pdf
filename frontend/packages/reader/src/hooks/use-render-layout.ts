// 排版引擎的版面（shared/data/render-layout.ts）读进来，字体装上（FontFace，和引擎同一份文件）。
// 从哪读：开发时阅读页地址上带 ?render_layout=<清单地址> 就读那份；不然开了 HTML 页才去要正式接口的清单（不开不多发请求）。
// 字体：要带授权，先取回字节再交给 FontFace（FontFace 直接给地址不带授权头）。主字体（第一个字族）每个字重都装上才照版面画，
// 清单里没有字体（2026-11-28 以前排的、后端没装 fontTools）也不照版面画——用本机字体画出来和译文 PDF 对不上，退回按 OCR 的框塞字。
// 没有版面时给出原因和补排的请求（照原样发，原地重新渲染，不花钱）；发了以后每 5 秒再要一次清单，排好就照版面画。
import { useCallback, useEffect, useRef, useState } from "react";

import { defaultReaderDataPort } from "../external.js";
import {
  loadRenderLayoutFromApi,
  loadRenderLayoutManifest,
  renderLayoutSourceFromDocument,
  type RenderLayoutFont,
  type RenderLayoutGenerate,
  type RenderLayoutSource,
} from "../shared/data/render-layout.js";

/** 字体栈：清单里的字族按顺序（第一个是主字体，后面是后备），最后落到系统衬线。 */
export function renderLayoutFontFamily(fonts: readonly RenderLayoutFont[]): string {
  const families = [...new Set(fonts.map((font) => font.family))];
  return [...families.map((family) => `"${family.replace(/"/g, "")}"`), "serif"].join(", ");
}

const loadedFonts = new Set<string>();

/** 装一个字体，失败重试一次（大字体文件偶尔读断，2026-11-28 实测思源宋体常规 24 MB 读断时浏览器拿粗体顶上，整页字变粗）。 */
async function installFont(font: RenderLayoutFont, load: (font: RenderLayoutFont) => Promise<ArrayBuffer>): Promise<boolean> {
  const key = `${font.family}|${font.weight}|${font.url}`;
  if (loadedFonts.has(key)) return true;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const face = new FontFace(font.family, await load(font), { weight: `${font.weight}` });
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
 * 装清单里的字体；主字体（清单里第一个字族）的每个字重都装上了才返回 true，清单是空的也是 false。
 * 主字体缺一个字重，浏览器会拿别的字重顶上（常规变粗）。后备字体装不上不要紧（浏览器逐字落到下一个）。
 */
export async function installRenderLayoutFonts(
  fonts: readonly RenderLayoutFont[],
  load: (font: RenderLayoutFont) => Promise<ArrayBuffer>,
): Promise<boolean> {
  if (typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts) return false;
  const primary = fonts[0]?.family;
  const results = await Promise.all(fonts.map(async (font) => ({ font, ok: await installFont(font, load) })));
  return Boolean(primary) && results.every(({ font, ok }) => ok || font.family !== primary);
}

function manifestUrlFromLocation(): string {
  try {
    return new URLSearchParams(globalThis.location?.search || "").get("render_layout") || "";
  } catch {
    return "";
  }
}

export type RenderLayoutState =
  | { status: "idle" | "loading" }
  | { status: "ready"; source: RenderLayoutSource; fontFamily: string }
  /** 没有版面：reason 是后端给的原因，或 no_fonts（清单里没有字体 / 主字体没装上）、failed（清单没要到）。 */
  | { status: "unavailable"; reason: string; generate: RenderLayoutGenerate | null }
  | { status: "generating" };

const POLL_MS = 5000;
const POLL_LIMIT = 120;

type DataPort = { apiPrefix: string; fetchProtected: typeof fetch };

/** 宿主没给数据端口（单测、纯本地 PDF）时是 null。 */
function readDataPort(): DataPort | null {
  try {
    return { apiPrefix: defaultReaderDataPort.apiPrefix, fetchProtected: defaultReaderDataPort.fetchProtected };
  } catch {
    return null;
  }
}

/** jobId：要哪本书的版面；enabled：开了 HTML 页才去要（开发参数不管开没开都读）。 */
export function useRenderLayout(jobId: string, enabled: boolean): RenderLayoutState & { generateNow: () => void } {
  const [state, setState] = useState<RenderLayoutState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const devUrl = useRef(manifestUrlFromLocation()).current;
  const port = useRef(readDataPort()).current;

  useEffect(() => {
    if (!devUrl && (!enabled || !jobId || !port)) return undefined;
    let alive = true;
    setState((current) => (current.status === "generating" ? current : { status: "loading" }));
    (async () => {
      let source: RenderLayoutSource | null = null;
      if (devUrl) {
        const doc = await loadRenderLayoutManifest(devUrl);
        source = doc ? renderLayoutSourceFromDocument(doc) : null;
      } else {
        const manifest = await loadRenderLayoutFromApi(jobId, { apiPrefix: port!.apiPrefix || "/api/v1", fetcher: port!.fetchProtected });
        if (!manifest.source) {
          if (alive) {
            setState((current) => (current.status === "generating"
              ? current
              : { status: "unavailable", reason: manifest.reason || "not_kept", generate: manifest.generate }));
          }
          return;
        }
        source = manifest.source;
      }
      if (!source) {
        if (alive) setState({ status: "unavailable", reason: "failed", generate: null });
        return;
      }
      // 字体装好再画，不然先按系统字体画一遍、字宽不对；主字体没装全（或清单里没有字体）就不照版面画。
      const ready = source;
      const ok = await installRenderLayoutFonts(ready.fonts, (font) => ready.loadFont(font));
      if (!alive) return;
      if (!ok) {
        console.warn("[render-layout] 版面的字体没有或没装全，HTML 页退回按 OCR 的框塞字");
        setState({ status: "unavailable", reason: "no_fonts", generate: null });
        return;
      }
      setState({ status: "ready", source: ready, fontFamily: renderLayoutFontFamily(ready.fonts) });
    })().catch((error) => {
      console.warn("[render-layout] 版面没读到：", error);
      if (alive) setState({ status: "unavailable", reason: "failed", generate: null });
    });
    return () => {
      alive = false;
    };
  }, [devUrl, enabled, jobId, port, attempt]);

  // 补排：照清单给的请求原样发，然后每 5 秒再要一次清单，排好就照版面画（最多等 10 分钟）。
  const generate = state.status === "unavailable" ? state.generate : null;
  const generateNow = useCallback(() => {
    if (!generate || !port) return;
    setState({ status: "generating" });
    void port.fetchProtected(generate.url, {
      method: generate.method || "POST",
      headers: { "Content-Type": "application/json" },
      body: generate.body == null ? undefined : JSON.stringify(generate.body),
    }).then((res) => {
      if (!res.ok) throw new Error(`补排 HTTP ${res.status}`);
    }).catch((error) => {
      console.warn("[render-layout] 补排没发出去：", error);
      setState({ status: "unavailable", reason: "failed", generate });
    });
  }, [generate, port]);
  useEffect(() => {
    if (state.status !== "generating" || !port) return undefined;
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      if (polls > POLL_LIMIT) {
        clearInterval(timer);
        setState({ status: "unavailable", reason: "failed", generate: null });
        return;
      }
      void loadRenderLayoutFromApi(jobId, { apiPrefix: port.apiPrefix || "/api/v1", fetcher: port.fetchProtected })
        .then((manifest) => {
          if (!manifest.available) return;
          clearInterval(timer);
          setState({ status: "loading" });
          setAttempt((value) => value + 1);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [state.status, jobId, port]);

  return { ...state, generateNow };
}
