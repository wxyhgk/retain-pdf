// 共享真值（原 frontend/web/src/js/reader/markdown-math.ts），已抽离为 standalone
// 不直接 import frontend/web 私有路径；MathJax 通过动态 import 加载，支持注入自定义 loader 便于单测
// 对外保持与原实现一致的 pure + injectable 边界：parseMarkdown 由调用方注入（marked 等）

export type MarkdownMathSlot = {
  token: string;
  tex: string;
  display: boolean;
};

export type ExtractMarkdownMathResult = {
  text: string;
  slots: MarkdownMathSlot[];
};

export type MathJaxEngine = {
  convert(tex: string, display: boolean): string;
};

export type MarkdownMathEngineLoader = () => Promise<MathJaxEngine>;

const TOKEN_PREFIX = "\uE000RP_MATH_";
const TOKEN_SUFFIX = "\uE001";

let enginePromise: Promise<MathJaxEngine> | null = null;
let customLoader: MarkdownMathEngineLoader | null = null;

/** 供单测或宿主注入自定义 MathJax 引擎（传 null 恢复默认动态 import） */
export function setMarkdownMathEngineLoader(loader: MarkdownMathEngineLoader | null): void {
  customLoader = loader;
  enginePromise = null;
}

export function resetMarkdownMathEngineLoader(): void {
  customLoader = null;
  enginePromise = null;
}

function escapeHtml(value: string): string {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function makeToken(index: number): string {
  return `${TOKEN_PREFIX}${index}${TOKEN_SUFFIX}`;
}

/**
 * 抽出 LaTeX 片段并换成占位符，避免 marked 破坏下标/命令。
 * 顺序：块级 $$ / \[ \] → 行内 \( \) / $...$
 */
export function extractMarkdownMath(source: string): ExtractMarkdownMathResult {
  const slots: MarkdownMathSlot[] = [];
  let text = `${source ?? ""}`;

  const push = (rawTex: string, display: boolean): string => {
    const tex = `${rawTex ?? ""}`.trim();
    if (!tex) {
      return display ? `$$${rawTex}$$` : `$${rawTex}$`;
    }
    const token = makeToken(slots.length);
    slots.push({ token, tex, display });
    return token;
  };

  // 块级
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => push(tex, true));
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_m, tex: string) => push(tex, true));
  // 行内 \( ... \)
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_m, tex: string) => push(tex, false));
  // 行内 $...$（单行；OCR 常在 $ 内侧加空格）
  text = text.replace(/(?<![\\$])\$(?!\$)((?:\\.|[^$\n])+?)\$(?!\$)/g, (full, tex: string) => {
    if (!`${tex}`.trim()) {
      return full;
    }
    return push(tex, false);
  });

  return { text, slots };
}

async function loadDefaultMathJaxEngine(): Promise<MathJaxEngine> {
  const [
    { mathjax },
    { TeX },
    { SVG },
    { liteAdaptor },
    { RegisterHTMLHandler },
    { AllPackages },
  ] = await Promise.all([
    import("mathjax-full/js/mathjax.js"),
    import("mathjax-full/js/input/tex.js"),
    import("mathjax-full/js/output/svg.js"),
    import("mathjax-full/js/adaptors/liteAdaptor.js"),
    import("mathjax-full/js/handlers/html.js"),
    import("mathjax-full/js/input/tex/AllPackages.js"),
  ]);

  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const document = mathjax.document("", {
    InputJax: new TeX({
      packages: AllPackages,
    }),
    OutputJax: new SVG({ fontCache: "none" }),
  });

  return {
    convert(tex: string, display: boolean): string {
      const node = document.convert(tex, { display });
      const html = adaptor.outerHTML(node);
      // 完全失败（无 SVG）才抛，交给外层回退；含 merror 的 SVG 仍展示
      if (!/<svg[\s>]/i.test(html)) {
        throw new Error("mathjax produced no svg");
      }
      return html;
    },
  };
}

function loadMathJaxEngine(): Promise<MathJaxEngine> {
  if (!enginePromise) {
    const loader = customLoader ?? loadDefaultMathJaxEngine;
    enginePromise = loader().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

export function renderMathFallbackHtml(tex: string, display: boolean): string {
  const body = `<code class="reader-md-math-error" title="公式渲染失败">${escapeHtml(tex)}</code>`;
  if (display) {
    return `<div class="reader-md-math reader-md-math-display reader-md-math-failed">${body}</div>`;
  }
  return `<span class="reader-md-math reader-md-math-inline reader-md-math-failed">${body}</span>`;
}

export function wrapMathSvgHtml(svgHtml: string, display: boolean): string {
  const cls = display
    ? "reader-md-math reader-md-math-display"
    : "reader-md-math reader-md-math-inline";
  const tag = display ? "div" : "span";
  return `<${tag} class="${cls}">${svgHtml}</${tag}>`;
}

/** 将 HTML 中的占位符替换为 MathJax SVG（失败则回退为代码片段）。 */
export async function materializeMarkdownMathHtml(
  html: string,
  slots: MarkdownMathSlot[],
): Promise<string> {
  if (!slots.length) {
    return html;
  }

  let engine: MathJaxEngine | null = null;
  try {
    engine = await loadMathJaxEngine();
  } catch {
    engine = null;
  }

  const replacements = new Map<string, string>();
  let processed = 0;
  for (const slot of slots) {
    let replacement: string;
    if (engine) {
      try {
        replacement = wrapMathSvgHtml(engine.convert(slot.tex, slot.display), slot.display);
      } catch {
        replacement = renderMathFallbackHtml(slot.tex, slot.display);
      }
    } else {
      replacement = renderMathFallbackHtml(slot.tex, slot.display);
    }
    replacements.set(slot.token, replacement);
    processed += 1;
    // Large OCR Markdown can contain thousands of formulas. Yield periodically
    // so React can paint the fast fallback instead of presenting a blank panel.
    if (processed % 24 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  return replaceMathTokens(`${html ?? ""}`, slots, replacements);
}

function replaceMathTokens(
  html: string,
  slots: MarkdownMathSlot[],
  replacements: Map<string, string>,
): string {
  if (!slots.length) return html;
  const tokenPattern = new RegExp(
    slots.map((slot) => slot.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g",
  );
  return html.replace(tokenPattern, (token) => replacements.get(token) || token);
}

/** Fast first paint: keep every formula visible without waiting for MathJax. */
export function materializeMarkdownMathFallbackHtml(
  html: string,
  slots: MarkdownMathSlot[],
): string {
  const replacements = new Map(
    slots.map((slot) => [slot.token, renderMathFallbackHtml(slot.tex, slot.display)]),
  );
  return replaceMathTokens(`${html ?? ""}`, slots, replacements);
}

/** 完整管线：保护公式 → marked.parse → 还原 SVG。 */
export async function parseMarkdownWithMath(
  markdown: string,
  parseMarkdown: (src: string) => string,
): Promise<string> {
  const { text, slots } = extractMarkdownMath(markdown);
  const html = parseMarkdown(text);
  return materializeMarkdownMathHtml(html, slots);
}
