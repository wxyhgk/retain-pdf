// HTML 页照排版引擎的版面画（2026-11-28；版面是什么见 shared/data/render-layout.ts）：
// 一页一个 SVG，viewBox 就是版面的 pt 坐标，缩放交给浏览器。先画盖原字的块（covers，填估出来的底色），
// 再把每个字簇用 <text x y> 摆到它的 x 和基线上（SVG 的 text 本来就按基线定位），公式是 MathJax 的 SVG 塞进它的盒子
// （宽 w、高 h + 深 d，按字号的 em；和引擎一样按非行间公式画、盒子底边在基线下 d）。
// 字体和引擎同一份（清单里的字体，按清单顺序当后备，浏览器逐字找，和引擎的 FontChain 一样）。
// 每块一个 <g data-html-block>：动效挂在这上面；刚打开时按顺序浮出来。
// 两个动效（2026-11-28 用户：「继续做下面的两个」——在版面层上试真正的动效）：
// - 逐行浮现（开关在 HTML 页的菜单里）：一块滚进来时，一行接一行浮上来（每行晚 70ms，一块最多 1.4 秒才开始）；浮过的块不再浮。
//   2026-11-28 先做的是逐字（每个字一个动画），用户说「html 排版速度特别慢」：一屏 1600 多个动画，SVG 的字合不了层，每帧整页重画，
//   滚 15 下主线程卡 12.8 秒。改成一行一个动画（一页几十个），浮完撤掉。
// - 点公式分步展开：点一下公式，MathJax 画出来的各项（data-mml-node 的顶层几项）一项一项出来，公式颜色闪一下。
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactElement } from "react";

import { renderTexToSvg } from "../shared/content/markdown-math.js";
import { layoutColor, type RenderLayoutLine, type RenderLayoutPage, type RenderLayoutSource } from "../shared/data/render-layout.js";
import { RegionCanvas, type RegionPdfDocument } from "./RegionCanvas.js";
import { FULL_PAGE } from "./region-image.js";

type MathSvg = { viewBox: string; inner: string };

/** MathJax 给的 <mjx-container><svg viewBox …>…</svg></mjx-container> → viewBox 和里面那一层（套进我们自己的 <svg> 里）。 */
export function parseMathSvg(html: string | null): MathSvg | null {
  if (!html) return null;
  const match = /<svg([^>]*)>([\s\S]*)<\/svg>/i.exec(html);
  if (!match) return null;
  const viewBox = /viewBox="([^"]+)"/i.exec(match[1])?.[1];
  return viewBox ? { viewBox, inner: match[2] } : null;
}

const mathCache = new Map<string, Promise<MathSvg | null>>();
const MATH_CACHE_LIMIT = 512;

function mathSvg(tex: string): Promise<MathSvg | null> {
  let entry = mathCache.get(tex);
  if (!entry) {
    entry = renderTexToSvg(tex, false).then(parseMathSvg);
    mathCache.set(tex, entry);
    if (mathCache.size > MATH_CACHE_LIMIT) {
      const oldest = mathCache.keys().next().value;
      if (oldest !== undefined) mathCache.delete(oldest);
    }
  }
  return entry;
}

/** 公式里一项一项的那几项：从 MathJax 的 math 节点往下，只有一个孩子（mrow 这类）就接着往下，到有几项的那一层。 */
export function formulaTerms(svg: Element): Element[] {
  let node: Element | null = svg.querySelector('g[data-mml-node="math"]');
  while (node && node.children.length === 1 && node.firstElementChild?.hasAttribute("data-mml-node")) node = node.firstElementChild;
  return node ? [...node.children] : [];
}

const FORMULA_FLASH = "rgb(40, 110, 215)";

/** 逐行浮现：每行晚 RISE_LINE_MS，一块最多 RISE_MAX_DELAY_MS 才开始，每行浮 RISE_DURATION_MS（和 live-translation.css 里的一样）。 */
const RISE_LINE_MS = 70;
const RISE_MAX_DELAY_MS = 1400;
const RISE_DURATION_MS = 520;

const reducedMotion = () => {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
};

/**
 * 点公式分步展开：各项依次从上面落下来、淡进来（MathJax 的单位是 1000 一个 em，-600 是往上 0.6em），公式闪一下蓝。
 * 闪色写死浅冷的蓝（和选区一个色系）：--accent 在黑白纸墨的皮肤里就是墨色，闪了看不出来（2026-11-28 实测）。
 */
export function playFormula(svg: SVGElement): void {
  if (reducedMotion() || typeof svg.animate !== "function") return;
  const terms = formulaTerms(svg);
  const step = Math.min(220, 1200 / Math.max(1, terms.length));
  terms.forEach((term, index) => {
    (term as SVGElement).animate?.(
      [{ opacity: 0, transform: "translate(0px, -600px)" }, { opacity: 1, transform: "translate(0px, 0px)" }],
      { duration: 460, delay: index * step, easing: "cubic-bezier(.2, .75, .25, 1)", fill: "backwards" },
    );
  });
  svg.animate(
    [{ color: FORMULA_FLASH }, { color: FORMULA_FLASH, offset: 0.75 }, { color: "currentColor" }],
    { duration: terms.length * step + 900, easing: "ease-out" },
  );
}

/** 公式：版面给了后端存的 SVG（和 PDF 里同一份 MathJax 输出）就用它，没有或取不到再前端自己画。 */
function layoutMathSvg(tex: string, svg: string | undefined, loadMath: ((svg: string) => Promise<string | null>) | undefined): Promise<MathSvg | null> {
  if (!svg || !loadMath) return mathSvg(tex);
  return loadMath(svg).then((text) => parseMathSvg(text) ?? mathSvg(tex));
}

export function LayoutPageLayer({ page, width, height, fontFamily, arrivedAt, charRise = false, loadMath, fontByKey, findTerm = "" }: {
  page: RenderLayoutPage;
  width: number;
  height: number;
  /** 字体栈（清单里的字体，按顺序当后备）。 */
  fontFamily: string;
  arrivedAt: number;
  /** 逐字浮现（HTML 页菜单里的开关）。 */
  charRise?: boolean;
  /** 取后端存的公式 SVG（版面来源的 loadMath）。 */
  loadMath?: (svg: string) => Promise<string | null>;
  /** 字簇的 font（清单 fonts[].key）→ 浏览器里的字体名：版面写明了用哪个字体就照它画（后面还接着整个字体栈）。 */
  fontByKey?: ReadonlyMap<string, string>;
  /** 左栏搜索的词：命中的字底下画一块底色（和 PDF 文字层的 mark.reader-find-mark 一样）。 */
  findTerm?: string;
}): ReactElement {
  const texList = useMemo(() => {
    const map = new Map<string, string | undefined>();
    const allBlocks = [...page.blocks, ...page.tables.flatMap((table) => table.blocks)];
    for (const block of allBlocks) for (const line of block.lines) for (const item of line.items) if ("tex" in item) map.set(item.tex, item.svg);
    return [...map];
  }, [page]);
  const [maths, setMaths] = useState<ReadonlyMap<string, MathSvg | null>>(() => new Map());
  useEffect(() => {
    let alive = true;
    void Promise.all(texList.map(async ([tex, svg]) => [tex, await layoutMathSvg(tex, svg, loadMath)] as const)).then((entries) => {
      if (alive) setMaths(new Map(entries));
    });
    return () => {
      alive = false;
    };
  }, [texList, loadMath]);
  const arriving = Date.now() - arrivedAt < 1500;

  // 逐字浮现：每块第一次滚进来时标 data-risen（直接改 DOM，不重画）；关了再开从头来。
  // 不能用 class：公式画好、悬停变了这一页会重画，React 会把 className 整个写回去，浮过的块又藏起来（2026-11-28 实测）。
  const root = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const svg = root.current;
    if (!charRise || !svg || typeof IntersectionObserver === "undefined") return undefined;
    const blocks = [...svg.querySelectorAll<SVGGElement>(".reader-layout-block")];
    for (const block of blocks) block.removeAttribute("data-risen");
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const block = entry.target;
        block.setAttribute("data-risen", "run");
        observer.unobserve(block);
        // 浮完把动画撤掉（data-risen="done" 没有动画）：放完的动画留着，以后每次样式变化都要再算一遍（2026-11-28 实测拖慢滚动）。
        const lines = block.querySelectorAll(".reader-layout-line").length;
        const timer = setTimeout(() => {
          timers.delete(timer);
          block.setAttribute("data-risen", "done");
        }, Math.min(lines * RISE_LINE_MS, RISE_MAX_DELAY_MS) + RISE_DURATION_MS + 100);
        timers.add(timer);
      }
    }, { threshold: 0.2 });
    for (const block of blocks) observer.observe(block);
    return () => {
      observer.disconnect();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [charRise, page]);
  const onMathClick = (event: MouseEvent<SVGSVGElement>) => {
    if (`${globalThis.getSelection?.() || ""}`.trim()) return;
    playFormula(event.currentTarget);
  };

  return (
    <svg
      ref={root}
      className={`reader-layout-page${charRise ? " is-char-rise" : ""}`}
      data-html-page={page.index + 1}
      viewBox={`0 0 ${page.width} ${page.height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      style={{ fontFamily }}
    >
      {/* 画法（后端 #246）：底 → erase（渲染前抹掉的原字）→ covers → 每张表的 cover → 表格线 → 正文和表格的字。 */}
      {page.erase.map((paint, index) => (
        <rect key={`erase:${index}`} x={paint.rect[0]} y={paint.rect[1]} width={paint.rect[2] - paint.rect[0]} height={paint.rect[3] - paint.rect[1]} fill={layoutColor(paint.fill)} />
      ))}
      {page.covers.map((cover, index) => (
        <rect
          key={`${cover.block}:${index}`}
          x={cover.rect[0]}
          y={cover.rect[1]}
          width={cover.rect[2] - cover.rect[0]}
          height={cover.rect[3] - cover.rect[1]}
          fill={layoutColor(cover.fill)}
        />
      ))}
      {page.tables.flatMap((table) => [
        ...(table.cover ? [table.cover] : []).map((paint) => (
          <rect key={`${table.id}:cover`} x={paint.rect[0]} y={paint.rect[1]} width={paint.rect[2] - paint.rect[0]} height={paint.rect[3] - paint.rect[1]} fill={layoutColor(paint.fill)} />
        )),
        ...table.rules.map((paint, index) => (
          <rect key={`${table.id}:rule:${index}`} x={paint.rect[0]} y={paint.rect[1]} width={paint.rect[2] - paint.rect[0]} height={paint.rect[3] - paint.rect[1]} fill={layoutColor(paint.fill)} />
        )),
      ])}
      {[...page.blocks, ...page.tables.flatMap((table) => table.blocks)].map((block, order) => {
        const color = layoutColor(block.color);
        return (
          <g
            key={`${block.id}:${arrivedAt}:${charRise ? "rise" : ""}`}
            className={`reader-layout-block${arriving ? " is-arriving" : ""}`}
            data-html-block={block.id}
            fill={color}
            fontSize={block.fontSize}
            fontWeight={block.weight === "bold" ? 700 : 400}
            style={{ "--reader-html-order": order, color } as CSSProperties}
          >
            {block.lines.map((line, lineIndex) => (
              <g key={lineIndex} className="reader-layout-line" style={{ "--l": lineIndex } as CSSProperties}>
              {findTerm ? layoutFindSpans(line, findTerm).map(([x0, x1], index) => (
                <rect
                  key={`find:${index}`}
                  className="reader-layout-find-mark"
                  x={x0}
                  y={line.baseline - block.fontSize * 0.9}
                  width={x1 - x0}
                  height={block.fontSize * 1.2}
                  rx={block.fontSize * 0.15}
                />
              )) : null}
              {line.items.map((item, itemIndex) => {
              const key = `${lineIndex}:${itemIndex}`;
              if ("tex" in item) {
                const svg = maths.get(item.tex);
                const size = block.fontSize;
                if (!svg) return null;
                return (
                  <svg
                    key={key}
                    className="reader-layout-math"
                    x={item.x}
                    y={line.baseline - item.h * size}
                    width={Math.max(0.01, item.w * size)}
                    height={Math.max(0.01, (item.h + item.d) * size)}
                    viewBox={svg.viewBox}
                    preserveAspectRatio="none"
                    data-tex={item.tex}
                    data-baseline={line.baseline}
                    onClick={onMathClick}
                    dangerouslySetInnerHTML={{ __html: svg.inner }}
                  />
                );
              }
              return (
                <text
                  key={key}
                  x={item.x}
                  y={line.baseline}
                  lang={item.mode === "dflt" ? "en" : "zh-Hans"}
                  fontFamily={item.font && fontByKey?.get(item.font) ? `"${fontByKey.get(item.font)}", ${fontFamily}` : undefined}
                >
                  {item.t}
                </text>
              );
              })}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * 一行里搜索词命中的横向范围（pt）：把行里的字簇接成一串找（不分大小写），命中的字簇从它的 x 到下一个字簇的 x
 * （最后一个到行尾）。公式不参与。
 */
export function layoutFindSpans(line: RenderLayoutLine, term: string): [number, number][] {
  const needle = term.replace(/\s+/gu, " ").trim().toLowerCase();
  if (!needle) return [];
  const starts: number[] = [];
  let text = "";
  for (const item of line.items) {
    starts.push(text.length);
    text += "tex" in item ? "\u0000" : item.t;
  }
  const lower = text.toLowerCase();
  const end = (index: number) => {
    const next = line.items[index + 1];
    const item = line.items[index];
    if (next) return next.x;
    return Math.max(line.x + line.width, item.x);
  };
  const itemAt = (offset: number) => {
    let found = 0;
    for (let index = 0; index < starts.length; index += 1) if (starts[index] <= offset) found = index;
    return found;
  };
  const spans: [number, number][] = [];
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + needle.length)) {
    const first = itemAt(at);
    const last = itemAt(at + needle.length - 1);
    spans.push([line.items[first].x, end(last)]);
  }
  return spans;
}

/**
 * 一页：从版面来源取这一页（按页取，接口有 ETag），先画底图（去掉原字的原文页；没有底图就是底下的原文页），再画版面。
 * 版面里没有这一页（整页图、不翻的参考文献）就什么都不画，看到的是原文页。
 */
export function LayoutPageHost({ source, page, width, height, fontFamily, arrivedAt, charRise, backgroundPdf, findTerm, coverWhileLoading = false }: {
  source: RenderLayoutSource;
  page: number;
  width: number;
  height: number;
  fontFamily: string;
  arrivedAt: number;
  charRise?: boolean;
  /** 底图的 PDF（读好了才有）。 */
  backgroundPdf: RegionPdfDocument | null;
  findTerm?: string;
  /** 这一页还在取时整页盖上纸色（译文栏：不让底下的原文先露出来）。 */
  coverWhileLoading?: boolean;
}): ReactElement | null {
  // 记着取的是哪一页、哪份版面：换了页（或版面）还没取回来时不画上一页的。
  const [loaded, setLoaded] = useState<{ source: RenderLayoutSource; page: number; data: RenderLayoutPage | null } | null>(null);
  const has = source.pages.has(page);
  useEffect(() => {
    if (!has) return undefined;
    let alive = true;
    void source.loadPage(page).then((data) => {
      if (alive) setLoaded({ source, page, data });
    });
    return () => {
      alive = false;
    };
  }, [source, page, has]);
  const fontByKey = useMemo(() => new Map(source.fonts.flatMap((font) => (font.key ? [[font.key, font.family] as const] : []))), [source]);
  const loadMath = useMemo(() => (svg: string) => source.loadMath(svg), [source]);
  if (!has) return null;
  const current = loaded?.source === source && loaded.page === page;
  if (!current) return coverWhileLoading ? <div className="reader-layout-loading" data-layout-loading={page} aria-hidden="true" /> : null;
  const layoutPage = loaded.data;
  // 这一页没取到（接口出错）：露出底下的原文页，比一张白纸强。
  if (!layoutPage) return null;
  const backgroundPage = source.background?.pageFor(page) ?? null;
  return (
    <>
      {backgroundPdf && backgroundPage ? (
        <RegionCanvas pdf={backgroundPdf} page={backgroundPage} region={FULL_PAGE} cssWidth={width} className="reader-layout-background" label="底图" />
      ) : null}
      <LayoutPageLayer
        page={layoutPage}
        width={width}
        height={height}
        fontFamily={fontFamily}
        arrivedAt={arrivedAt}
        charRise={charRise}
        loadMath={loadMath}
        fontByKey={fontByKey}
        findTerm={findTerm}
      />
    </>
  );
}
