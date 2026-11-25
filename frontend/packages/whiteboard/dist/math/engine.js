// 公式排版：TeX → SVG。默认按需加载 mathjax-full（阅读器已经在用，不新加依赖）；
// 测试或宿主可以换成自己的引擎（setWhiteboardMathEngine）。
//
// 脚本是数据：不开 html 扩展（不能往公式里塞 HTML），其余照阅读器的宽容设置。
import { exToPx, FONT_SIZE } from "../layout/measure.js";
let customLoader = null;
let enginePromise = null;
/** 已经加载好的引擎：有了它，公式可以同步排（边打边看用）。 */
let loadedEngine = null;
export function setWhiteboardMathEngine(loader) {
    customLoader = loader;
    enginePromise = null;
    loadedEngine = null;
    cache.clear();
    htmlCache.clear();
}
function pickExport(ns, name) {
    const direct = ns[name];
    if (direct !== undefined)
        return direct;
    const fallback = ns.default?.[name];
    if (fallback !== undefined)
        return fallback;
    throw new Error(`mathjax-full 未导出 ${name}`);
}
async function loadDefaultEngine() {
    const [mathjaxNs, texNs, svgNs, adaptorNs, handlerNs, packagesNs] = await Promise.all([
        import("mathjax-full/js/mathjax.js"),
        import("mathjax-full/js/input/tex.js"),
        import("mathjax-full/js/output/svg.js"),
        import("mathjax-full/js/adaptors/liteAdaptor.js"),
        import("mathjax-full/js/handlers/html.js"),
        import("mathjax-full/js/input/tex/AllPackages.js"),
    ]);
    const mathjax = pickExport(mathjaxNs, "mathjax");
    const TeX = pickExport(texNs, "TeX");
    const SVG = pickExport(svgNs, "SVG");
    const liteAdaptor = pickExport(adaptorNs, "liteAdaptor");
    const RegisterHTMLHandler = pickExport(handlerNs, "RegisterHTMLHandler");
    const AllPackages = pickExport(packagesNs, "AllPackages");
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const document = mathjax.document("", {
        InputJax: new TeX({ packages: AllPackages.filter((name) => name !== "html" && name !== "bussproofs") }),
        OutputJax: new SVG({ fontCache: "none" }),
    });
    return {
        toSvg(tex, display = true) {
            const node = document.convert(tex, { display });
            return adaptor.outerHTML(adaptor.firstChild(node));
        },
    };
}
function engine() {
    if (!enginePromise) {
        const loading = (customLoader ?? loadDefaultEngine)();
        enginePromise = loading;
        loading.then((ready) => {
            if (enginePromise === loading)
                loadedEngine = ready;
        }, () => { });
    }
    return enginePromise;
}
/** 先把公式引擎加载好（之后 mathHtmlNow 能同步排）。 */
export async function loadMathEngine() {
    loadedEngine = await engine();
}
export function mathEngineReady() {
    return loadedEngine !== null;
}
const htmlCache = new Map();
const HTML_CACHE_LIMIT = 500;
/**
 * 同步把一段 TeX 排成可以放进 HTML 的 SVG（白板上的文字、边打边看的预览）。
 * 引擎还没加载时返回 null（调用方先 loadMathEngine）；写错时返回 error（MathJax 的说明）。
 */
export function mathHtmlNow(tex, display) {
    if (!loadedEngine)
        return null;
    const key = `${display ? "D" : "I"}\u0000${tex}`;
    const hit = htmlCache.get(key);
    if (hit)
        return hit;
    let result;
    try {
        const svg = loadedEngine.toSvg(tex, display);
        const error = /data-mjx-error="([^"]*)"/.exec(svg)?.[1];
        result = error ? { error } : { html: sanitizeMathSvg(svg) };
    }
    catch (cause) {
        result = { error: cause instanceof Error ? cause.message : String(cause) };
    }
    if (htmlCache.size >= HTML_CACHE_LIMIT)
        htmlCache.delete(htmlCache.keys().next().value);
    htmlCache.set(key, result);
    return result;
}
const cache = new Map();
function cacheKey(tex, size) {
    return `${size}\u0000${tex}`;
}
function readEx(svg, attr) {
    const match = svg.match(new RegExp(`\\s${attr}="(-?[0-9.]+)ex"`));
    return match ? Number(match[1]) : 0;
}
function readDepthEx(svg) {
    const match = svg.match(/vertical-align:\s*(-?[0-9.]+)ex/);
    return match ? Math.abs(Number(match[1])) : 0;
}
/**
 * 脚本是模型写的：就算 TeX 里写了 \href 之类，排出来的 SVG 里也不留链接、事件属性和外部引用，
 * 只留页内的 #引用。
 */
export function sanitizeMathSvg(svg) {
    return svg
        .replace(/<\/?a\b[^>]*>/gi, "")
        .replace(/<\/?(script|foreignObject|iframe|image)\b[^>]*>/gi, "")
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
        .replace(/\s(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi, (match, value) => (value.slice(1).startsWith("#") ? match : ""));
}
/** 把 MathJax 的 SVG 改成像素尺寸，嵌进白板的 <svg> 里直接用。 */
export function sizeMathSvg(svg, size) {
    const fontSize = FONT_SIZE[size];
    const w = exToPx(readEx(svg, "width"), fontSize);
    const h = exToPx(readEx(svg, "height"), fontSize);
    const depth = exToPx(readDepthEx(svg), fontSize);
    const error = /data-mjx-error="([^"]*)"/.exec(svg)?.[1];
    const sized = sanitizeMathSvg(svg)
        .replace(/\swidth="[^"]*"/, ` width="${w.toFixed(2)}"`)
        .replace(/\sheight="[^"]*"/, ` height="${h.toFixed(2)}"`)
        .replace(/\sstyle="[^"]*"/, "");
    return { svg: sized, w, h, depth, ...(error ? { error } : {}) };
}
/** 已经排好的公式（同步取，排版和渲染都用它）。没排过返回 null。 */
export function cachedMath(tex, size) {
    return cache.get(cacheKey(tex, size)) ?? null;
}
/** 把一批公式先排好放进缓存；写错的公式记成错误，不抛。 */
export async function prepareMath(items) {
    const pending = items.filter(({ tex, size }) => !cache.has(cacheKey(tex, size)));
    if (!pending.length)
        return;
    const mathEngine = await engine();
    for (const { tex, size } of pending) {
        let rendered;
        try {
            rendered = sizeMathSvg(mathEngine.toSvg(tex), size);
        }
        catch (error) {
            rendered = { svg: "", w: 0, h: 0, depth: 0, error: error instanceof Error ? error.message : String(error) };
        }
        if (rendered.error || rendered.w <= 0) {
            // 写错的公式按原文显示（等宽、标成警示色），不让一处错把整块板弄没。
            rendered = { svg: "", w: 0, h: 0, depth: 0, error: rendered.error || "公式没排出来" };
        }
        cache.set(cacheKey(tex, size), rendered);
    }
}
