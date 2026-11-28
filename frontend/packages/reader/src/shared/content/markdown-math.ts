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

export type ExtractMarkdownMathOptions = {
  /**
   * Also treat un-delimited LaTeX fragments (e.g. `^{6}`, `\mathbf{Q}`,
   * `CHCl_{3}`) as math. Off by default so plain-text/markdown callers keep
   * treating bare `^`/`_`/`\` as literal text.
   *
   * Only strong LaTeX signals qualify (a `\command`, or a braced subscript /
   * superscript like `_{...}` / `^{...}`), so code identifiers such as
   * `pdf_font`, `page_layout` or `get_imports(url)` are never turned into math.
   */
  bareLatex?: boolean;
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
 * A maximal whitespace-free run of LaTeX-ish characters. Used to grow a bare
 * fragment around its trigger so `[\mathrm{Bu_3PH}]BF_4` is captured whole.
 */
const BARE_MATH_RUN = /[0-9A-Za-z\\{}_^()\[\]|+\-=,.:;'~*/<>!\u00b0\u00b1\u00d7\u00f7\u2212\u2202\u03b1-\u03c9\u0391-\u03a9]+/g;
/**
 * Strong LaTeX signals only. A lone `_`/`^` (snake_case, URLs, code
 * identifiers) must NOT match; an explicit `_{...}` / `^{...}` group or a
 * `\command` does.
 */
const BARE_MATH_TRIGGER = /\\[A-Za-z]+|[_^]\{/;

function extractBareMathFragments(
  text: string,
  push: (rawTex: string, display: boolean) => string,
): string {
  const tokenPattern = new RegExp(`${TOKEN_PREFIX}\\d+${TOKEN_SUFFIX}`, "g");
  const scan = (segment: string): string =>
    segment.replace(BARE_MATH_RUN, (run) =>
      BARE_MATH_TRIGGER.test(run) ? push(run, false) : run,
    );

  let result = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(text)) !== null) {
    result += scan(text.slice(cursor, match.index)) + match[0];
    cursor = match.index + match[0].length;
  }
  result += scan(text.slice(cursor));
  return result;
}

/**
 * 抽出 LaTeX 片段并换成占位符，避免 marked 破坏下标/命令。
 * 顺序：块级 $$ / \[ \] → 行内 \( \) / $...$ →（可选）未包裹的裸 LaTeX。
 */
// 后端保护 token 的形状:类型前缀 + 序号 + 校验和。落盘前本该全部还原,漏了就是
// 确定性的垃圾。
const PROTECTED_TOKEN_RE = /<([futnvc]\d+-[0-9a-z]{3})\/>/g;

/**
 * 把漏还原的保护 token 变成看得见的文本。
 *
 * `<f1-e32/>` 在 Markdown 里会被当成未知 HTML 元素——不是显示成乱码，而是**整段
 * 消失**:实测 `结果为 <f1-e32/> 所示` 渲染出来的 textContent 是 `结果为  所示`,
 * 公式连痕迹都不剩。比显示成垃圾更糟,因为没人会发现译文少了东西。
 *
 * 后端对这类 token 只在缓存读写处设了闸（坏译文不入缓存、命中即作废）,不拦投递,
 * 所以前端仍会拿到。这里只保证它可见,不试图还原——还原信息在后端。
 */
export function revealProtectedTokens(source: string): { text: string; count: number } {
  let count = 0;
  const text = `${source ?? ""}`.replace(PROTECTED_TOKEN_RE, (_match, body: string) => {
    count += 1;
    // 不能只是转义或加反引号:两条下游路径对 HTML 的处理方式不同（Markdown 走
    // marked，叠层走 escapeHtml），任何带尖括号的形式都会在其中一条里被解析掉或
    // 显示成二次转义的乱码。换成完全不含尖括号的写法，哪条路都原样可见。
    return `[未还原 token ${body}]`;
  });
  return { text, count };
}

export function extractMarkdownMath(
  source: string,
  options: ExtractMarkdownMathOptions = {},
): ExtractMarkdownMathResult {
  const slots: MarkdownMathSlot[] = [];
  const revealed = revealProtectedTokens(`${source ?? ""}`);
  if (revealed.count) {
    mathFailureStats.protectedTokens += revealed.count;
    if (mathFailureStats.protectedTokens <= 5) {
      console.warn(
        `[markdown-math] 译文里有 ${revealed.count} 个未还原的保护 token，已原样显示`,
      );
    }
  }
  let text = revealed.text;

  const push = (rawTex: string, display: boolean): string => {
    const tex = `${rawTex ?? ""}`.trim();
    if (!tex) {
      return display ? `$$${rawTex}$$` : `$${rawTex}$`;
    }
    const token = makeToken(slots.length);
    slots.push({ token, tex, display });
    return token;
  };

  // 块级。只认 `$$`——OCR 的 markdown fallback 对公式块产出的就是这个
  // （markdown_fallback.py 的 _render_formula）。
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => push(tex, true));

  // 不认 `\[...\]` 和 `\(...\)`。
  //
  // 按 CommonMark，`\[` 是**转义的方括号**，不是公式定界符。我们自己的后端就这么
  // 用它——markdown_fallback.py 的 _escape_image_alt 把字面 `[` `]` 转义成 `\[`
  // `\]`；LLM 译文里写 `参见 \[1\] 与 \[2\]` 更是家常便饭。当成公式的后果是
  // 一整段正文被劈成三块、中间两个编号变成居中的块级公式。
  //
  // 另一头也没有来源：渲染 PDF 的那条路（inline_math.py）无条件输出 `$...$`，
  // cmarker 同样只认 `$`。两边都不产出这两种写法，只有前端在认。
  // 行内 $...$（单行；OCR 常在 $ 内侧加空格）
  text = text.replace(/(?<![\\$])\$(?!\$)((?:\\.|[^$\n])+?)\$(?!\$)/g, (full, tex: string) => {
    if (!`${tex}`.trim()) {
      return full;
    }
    return push(tex, false);
  });

  if (options.bareLatex) {
    text = extractBareMathFragments(text, push);
  }

  return { text, slots };
}

/**
 * 从动态 import 的命名空间里取一个导出，CJS 和 ESM 两种形态都认。
 *
 * mathjax-full 的 `js/` 全是 CommonJS（无 `type: "module"`）。Node 里
 * `import()` 会把 `exports` 的键提升成命名导出，所以单测解构 `{ mathjax }`
 * 正常；浏览器里经打包器处理后，同样的东西可能只挂在 `default` 下，解构就得到
 * `undefined`，下一行调用直接抛 `... is not a function`。
 *
 * 这正是此前的故障：单测全绿，浏览器里引擎加载失败，所有公式退回纯文本显示成
 * 裸 LaTeX，而三层 catch 把原因全吞了。取不到时带上名字抛，别再让它沉默。
 */
const MATH_FAILURE_SAMPLE_LIMIT = 20;

// `noundefined` 把未定义命令渲染成红色的 mtext 节点；而合法的 `\textcolor{red}`
// 走的是 mstyle。两者都带 fill="red"，只看颜色会把前者和后者混为一谈，所以连节点
// 类型一起认。实测 `\textcolor{red}{\text{abc}}` 这种嵌套不会误判。
const UNDEFINED_COMMAND_RE = /data-mml-node="mtext"[^>]*fill="red"/;

function pickExport<T>(namespace: unknown, name: string): T {
  const source = namespace as Record<string, unknown> | undefined;
  const direct = source?.[name];
  if (direct !== undefined) {
    return direct as T;
  }
  const fallback = (source?.default as Record<string, unknown> | undefined)?.[name];
  if (fallback !== undefined) {
    return fallback as T;
  }
  throw new Error(`mathjax-full 未导出 ${name}（CJS/ESM 互操作问题）`);
}

async function loadDefaultMathJaxEngine(): Promise<MathJaxEngine> {
  const [mathjaxNs, texNs, svgNs, adaptorNs, handlerNs, packagesNs] = await Promise.all([
    import("mathjax-full/js/mathjax.js"),
    import("mathjax-full/js/input/tex.js"),
    import("mathjax-full/js/output/svg.js"),
    import("mathjax-full/js/adaptors/liteAdaptor.js"),
    import("mathjax-full/js/handlers/html.js"),
    import("mathjax-full/js/input/tex/AllPackages.js"),
  ]);
  const mathjax = pickExport<{ document: (...args: never[]) => unknown }>(mathjaxNs, "mathjax");
  const TeX = pickExport<new (options: unknown) => unknown>(texNs, "TeX");
  const SVG = pickExport<new (options: unknown) => unknown>(svgNs, "SVG");
  const liteAdaptor = pickExport<() => { outerHTML: (node: unknown) => string }>(adaptorNs, "liteAdaptor");
  const RegisterHTMLHandler = pickExport<(adaptor: unknown) => void>(handlerNs, "RegisterHTMLHandler");
  const AllPackages = pickExport<string[]>(packagesNs, "AllPackages");

  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const document = (mathjax.document as (src: string, options: unknown) => {
    convert: (tex: string, options: { display: boolean }) => unknown;
  })("", {
    InputJax: new TeX({
      // 方案 C：宽容渲染。`unicode` 包让 Unicode 数学符号（⟨⟩、希腊字母、
      // 运算符等）尽量直接渲染，减少严格 TeX 的报错面。
      //
      // 摘掉 `html` 包。它提供 `\href`/`\class`/`\cssId`，链接原样进 SVG，而译文
      // 是模型对 OCR 文本的输出、源头是用户上传的 PDF——不是可信输入。实测
      // `$\href{javascript:alert(1)}{x}$` 渲染出 `<a href="javascript:alert(1)">`，
      // 而实时翻译叠层是 dangerouslySetInnerHTML 直接注入，中间没有任何消毒层。
      //
      // 试过在字符串层用正则摘掉危险协议，不成立：`jav&#x61;script:` 在字符串里
      // 看着无害，浏览器解析属性时会把实体解码回 `javascript:`。能被绕过的清洗器
      // 比没有更糟，它只提供虚假的安全感。所以从根上不产生这类属性。
      //
      // 代价：文档里真有 `\href` 时不再渲染成链接，退化成失败回退显示原文。渲染
      // PDF 的 mitex 本来也不支持 `\href`，两边因此一致。
      packages: AllPackages.filter((name: string) => name !== "html").concat("unicode"),
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
      // 方案 C 错误降级：MathJax 报错会整条渲染成 merror（红框）。这里视为
      // 失败，交由外层回退显示原始公式文本，避免出现错误框。
      if (/data-mjx-error|merror/i.test(html)) {
        throw new Error("mathjax error node");
      }
      // 未定义命令**不**产生 merror。`AllPackages` 自带 `noundefined`，它把
      // `\circled{R}` 这类画成 MathJax 硬编码的红色字面文本，照上面那条检查看
      // 就是「渲染成功」。于是最常见的那类坏公式——模型造词、命令拼错、OCR 粘连
      // ——完全绕过失败计数，页面上留下一段谁也管不着的红字（实时翻译叠层的 CSS
      // 压不掉它，因为红色写在 SVG 的 fill 属性上）。
      if (UNDEFINED_COMMAND_RE.test(html)) {
        throw new Error("mathjax undefined command");
      }
      return html;
    },
  };
}

/** 公式渲染失败的计数与最近一次原因，供控制台排查。 */
export const mathFailureStats = {
  engineLoad: 0,
  convert: 0,
  lastReason: "",
  /** 最近若干条失败的公式原文，用来判断是哪一类写法出了问题。 */
  samples: [] as string[],
  /** 译文里漏还原的后端保护 token 数量。不是渲染失败，是上游漏了一步。 */
  protectedTokens: 0,
};

// 只写不读的统计等于没有统计。上一次公式事故（引擎加载被三层 catch 吞掉）之后加了
// 这个对象，却没有任何读取方、没挂 window、不进界面——生产环境下在控制台里根本拿
// 不到它。挂上去，排查时 `__retainMathFailures` 直接可见。
try {
  (globalThis as Record<string, unknown>).__retainMathFailures = mathFailureStats;
} catch {
  // 只读的全局对象（严格沙箱）不该影响渲染。
}

function reportMathFailure(kind: "engine-load" | "convert", error: unknown, tex = ""): void {
  const reason = `${(error as { message?: string })?.message || error}`;
  mathFailureStats.lastReason = reason;
  if (kind === "engine-load") {
    mathFailureStats.engineLoad += 1;
    console.warn("[markdown-math] MathJax 引擎加载失败，公式将退回纯文本：", reason);
    return;
  }
  mathFailureStats.convert += 1;
  // 留几条原文。控制台上限之后仍然看得出是哪一类写法。
  if (mathFailureStats.samples.length < MATH_FAILURE_SAMPLE_LIMIT) {
    mathFailureStats.samples.push(tex);
  }
  // 逐条刷屏没有意义,前几条足够定位是哪一类写法。
  if (mathFailureStats.convert <= 5) {
    console.warn(`[markdown-math] 公式渲染失败（第 ${mathFailureStats.convert} 条）：`, tex, reason);
  }
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

/**
 * 一条公式画成 MathJax 的 SVG（和 Markdown、实时译文同一个引擎、同一套包）；画不出来是 null（失败计数照记）。
 * HTML 页照排版引擎的 layout.json 摆公式用（pdf/LayoutPageLayer.tsx，2026-11-28）。
 */
export async function renderTexToSvg(tex: string, display: boolean): Promise<string | null> {
  let engine: MathJaxEngine;
  try {
    engine = await loadMathJaxEngine();
  } catch (error) {
    reportMathFailure("engine-load", error);
    return null;
  }
  try {
    return engine.convert(tex, display);
  } catch (error) {
    reportMathFailure("convert", error, tex);
    return null;
  }
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

/**
 * 译文/OCR 里常混入 Unicode 数学符号（尤其 `\left⟨`/`\right⟩` 这种把 Unicode
 * 尖括号当定界符的写法），MathJax 会直接报错（merror）。这里把常见 Unicode
 * 数学符号归一化回 LaTeX 命令后再交给 MathJax。只作用于公式片段，不影响正文。
 */
const UNICODE_MATH_MAP: Array<[RegExp, string]> = [
  [/[⟨〈]/g, "\\langle "],
  [/[⟩〉]/g, "\\rangle "],
  [/∣/g, "\\mid "],
  [/‖/g, "\\| "],
  [/[≤⩽]/g, "\\le "],
  [/[≥⩾]/g, "\\ge "],
  [/≠/g, "\\ne "],
  [/≈/g, "\\approx "],
  [/≡/g, "\\equiv "],
  [/×/g, "\\times "],
  [/÷/g, "\\div "],
  [/[·⋅]/g, "\\cdot "],
  [/±/g, "\\pm "],
  [/∓/g, "\\mp "],
  [/[−–]/g, "-"],
  [/∞/g, "\\infty "],
  [/∑/g, "\\sum "],
  [/∏/g, "\\prod "],
  [/∫/g, "\\int "],
  [/√/g, "\\surd "],
  [/∂/g, "\\partial "],
  [/∇/g, "\\nabla "],
  [/→/g, "\\to "],
  [/←/g, "\\leftarrow "],
  [/⇒/g, "\\Rightarrow "],
  [/⇔/g, "\\Leftrightarrow "],
  [/∈/g, "\\in "],
  [/∉/g, "\\notin "],
  [/∀/g, "\\forall "],
  [/∃/g, "\\exists "],
  [/∅/g, "\\emptyset "],
  [/∝/g, "\\propto "],
  [/≃/g, "\\simeq "],
  [/≅/g, "\\cong "],
  [/⊥/g, "\\perp "],
  [/∥/g, "\\parallel "],
  [/[′ʹ]/g, "'"],
  [/[″ʺ]/g, "''"],
  [/Δ/g, "\\Delta "],
  [/Ω/g, "\\Omega "],
  [/μ/g, "\\mu "],
  [/λ/g, "\\lambda "],
  [/σ/g, "\\sigma "],
  [/π/g, "\\pi "],
  [/θ/g, "\\theta "],
  [/φ/g, "\\varphi "],
  [/α/g, "\\alpha "],
  [/β/g, "\\beta "],
  [/γ/g, "\\gamma "],
  [/ω/g, "\\omega "],
];

export function normalizeMathTex(tex: string): string {
  let out = `${tex ?? ""}`;
  for (const [pattern, replacement] of UNICODE_MATH_MAP) {
    out = out.replace(pattern, replacement);
  }
  // 只在真的存在畸形上下标时才合并，避免把正常 `x_i` 也改写成 `x_{i}`
  //（会改变交给引擎的 tex，且无必要）。
  return needsScriptRepair(out) ? mergeRepeatedScripts(out) : out;
}

/**
 * 检测畸形脚本：连续同类型脚本（`T_0_*`、`relied_m_j`）、脚本后紧跟撇号
 * （`^0'`、`^w'`）、`^^{...}`、`__`。正常的 `x_i` / `x^2` / `a_{i,j}` 不命中。
 */
function needsScriptRepair(tex: string): boolean {
  const scriptArg = "(?:\\{[^{}]*\\}|\\\\[A-Za-z]+|[A-Za-z0-9*])";
  const scriptThenScript = new RegExp(`[_^]${scriptArg}\\s*(?=[_^])`);
  const scriptThenPrime = new RegExp(`[_^]${scriptArg}\\s*'`);
  return scriptThenScript.test(tex)
    || scriptThenPrime.test(tex)
    || /\^\s*\^/.test(tex)
    || /__/.test(tex);
}

/**
 * 译文里常见畸形脚本：`T_0_*`、`relied_m_j^t`、`^0'`、`^w'`、`^^{...}`。
 * TeX 会因「双下标/双上标」直接报错。这里把 `'` 展开为 `^{\prime}`，再把相邻
 * 同类型脚本合并成一层（`X_a_b` → `X_{a_b}`），保证能渲染（视觉嵌套，无 merror）。
 */
function readBalanced(source: string, start: number): { arg: string; next: number } {
  let depth = 0;
  let j = start;
  for (; j < source.length; j += 1) {
    if (source[j] === "{") depth += 1;
    else if (source[j] === "}") {
      depth -= 1;
      if (depth === 0) { j += 1; break; }
    }
  }
  return { arg: source.slice(start, j), next: j };
}

function readScriptArg(source: string, start: number): { arg: string; next: number } {
  let i = start;
  while (i < source.length && source[i] === " ") i += 1;
  if (source[i] === "{") return readBalanced(source, i);
  if (source[i] === "\\") {
    let j = i + 1;
    while (j < source.length && /[A-Za-z]/.test(source[j])) j += 1;
    let end = j > i + 1 ? j : j + 1;
    // 命令作为脚本参数时要带上其花括号参数（\text{H}、\mathrm{a}、\frac{1}{2}）。
    for (;;) {
      let k = end;
      while (k < source.length && source[k] === " ") k += 1;
      if (source[k] !== "{") break;
      end = readBalanced(source, k).next;
    }
    return { arg: source.slice(i, end), next: end };
  }
  return { arg: source[i] ?? "", next: i + 1 };
}

function mergeRepeatedScripts(tex: string): string {
  const expanded = tex
    .replace(/\^\s*\^/g, "^")
    .replace(/''/g, "^{\\prime\\prime}")
    .replace(/'/g, "^{\\prime}");
  let out = "";
  let i = 0;
  while (i < expanded.length) {
    const op = expanded[i];
    if (op !== "_" && op !== "^") {
      out += op;
      i += 1;
      continue;
    }
    const first = readScriptArg(expanded, i + 1);
    let arg = first.arg;
    let j = first.next;
    while (j < expanded.length) {
      let k = j;
      while (k < expanded.length && expanded[k] === " ") k += 1;
      if (expanded[k] !== op) break;
      const next = readScriptArg(expanded, k + 1);
      arg = `${arg}${expanded.slice(j, k)}${op}${next.arg}`;
      j = next.next;
    }
    out += `${op}{${arg}}`;
    i = j;
  }
  return out;
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
  } catch (error) {
    // 静默吞掉会让界面显示「公式渲染失败」而没有任何线索:引擎没加载、还是
    // 某条公式转换抛错,两者外观完全一样,只能靠猜。至少把原因说出来。
    engine = null;
    reportMathFailure("engine-load", error);
  }

  const replacements = new Map<string, string>();
  let processed = 0;
  for (const slot of slots) {
    let replacement: string;
    if (engine) {
      try {
        replacement = wrapMathSvgHtml(engine.convert(normalizeMathTex(slot.tex), slot.display), slot.display);
      } catch (error) {
        replacement = renderMathFallbackHtml(slot.tex, slot.display);
        reportMathFailure("convert", error, slot.tex);
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
