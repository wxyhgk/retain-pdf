// HTML 页照排版引擎的版面画（2026-11-28；版面是什么见 shared/data/render-layout.ts）：
// 一页一个 SVG，viewBox 就是版面的 pt 坐标，缩放交给浏览器。先画盖原字的块（covers，填估出来的底色），
// 再把每个字簇用 <text x y> 摆到它的 x 和基线上（SVG 的 text 本来就按基线定位），公式是 MathJax 的 SVG 塞进它的盒子
// （宽 w、高 h + 深 d，按字号的 em；和引擎一样按非行间公式画、盒子底边在基线下 d）。
// 字体和引擎同一份（清单里的字体，按清单顺序当后备，浏览器逐字找，和引擎的 FontChain 一样）。
// 每块一个 <g data-html-block>：动效挂在这上面；刚打开时按顺序浮出来。
// 两个动效（2026-11-28 用户：「继续做下面的两个」——在版面层上试真正的动效）：
// - 逐字浮现（开关在 HTML 页的菜单里）：一块滚进来时，字一个接一个浮上来（每字晚 14ms，一块最多 1.6 秒）；浮过的块不再浮。
// - 点公式分步展开：点一下公式，MathJax 画出来的各项（data-mml-node 的顶层几项）一项一项出来，公式颜色闪一下。
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactElement } from "react";

import { renderTexToSvg } from "../shared/content/markdown-math.js";
import { layoutColor, type RenderLayoutPage } from "../shared/data/render-layout.js";

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

export function LayoutPageLayer({ page, width, height, fontFamily, arrivedAt, charRise = false }: {
  page: RenderLayoutPage;
  width: number;
  height: number;
  /** 字体栈（清单里的字体，按顺序当后备）。 */
  fontFamily: string;
  arrivedAt: number;
  /** 逐字浮现（HTML 页菜单里的开关）。 */
  charRise?: boolean;
}): ReactElement {
  const texList = useMemo(() => {
    const set = new Set<string>();
    for (const block of page.blocks) for (const line of block.lines) for (const item of line.items) if ("tex" in item) set.add(item.tex);
    return [...set];
  }, [page]);
  // 每块里每一行第一个字是这块的第几个字（逐字浮现按它排先后）。
  const charIndexes = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const block of page.blocks) {
      let count = 0;
      map.set(block.id, block.lines.map((line) => {
        const start = count;
        count += line.items.length;
        return start;
      }));
    }
    return map;
  }, [page]);
  const [maths, setMaths] = useState<ReadonlyMap<string, MathSvg | null>>(() => new Map());
  useEffect(() => {
    let alive = true;
    void Promise.all(texList.map(async (tex) => [tex, await mathSvg(tex)] as const)).then((entries) => {
      if (alive) setMaths(new Map(entries));
    });
    return () => {
      alive = false;
    };
  }, [texList]);
  const arriving = Date.now() - arrivedAt < 1500;

  // 逐字浮现：每块第一次滚进来时标 data-risen（直接改 DOM，不重画）；关了再开从头来。
  // 不能用 class：公式画好、悬停变了这一页会重画，React 会把 className 整个写回去，浮过的块又藏起来（2026-11-28 实测）。
  const root = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const svg = root.current;
    if (!charRise || !svg || typeof IntersectionObserver === "undefined") return undefined;
    const blocks = [...svg.querySelectorAll<SVGGElement>(".reader-layout-block")];
    for (const block of blocks) block.removeAttribute("data-risen");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-risen", "");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.2 });
    for (const block of blocks) observer.observe(block);
    return () => observer.disconnect();
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
      {page.blocks.map((block, order) => {
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
            {block.lines.map((line, lineIndex) => line.items.map((item, itemIndex) => {
              const key = `${lineIndex}:${itemIndex}`;
              const charIndex = (charIndexes.get(block.id)?.[lineIndex] ?? 0) + itemIndex;
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
                    style={{ "--i": charIndex } as CSSProperties}
                    onClick={onMathClick}
                    dangerouslySetInnerHTML={{ __html: svg.inner }}
                  />
                );
              }
              return (
                <text key={key} x={item.x} y={line.baseline} lang={item.mode === "dflt" ? "en" : "zh-Hans"} style={{ "--i": charIndex } as CSSProperties}>
                  {item.t}
                </text>
              );
            }))}
          </g>
        );
      })}
    </svg>
  );
}
