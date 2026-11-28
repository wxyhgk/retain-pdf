// HTML 页照排版引擎的版面画（2026-11-28；版面是什么见 shared/data/render-layout.ts）：
// 一页一个 SVG，viewBox 就是版面的 pt 坐标，缩放交给浏览器。先画盖原字的块（covers，填估出来的底色），
// 再把每个字簇用 <text x y> 摆到它的 x 和基线上（SVG 的 text 本来就按基线定位），公式是 MathJax 的 SVG 塞进它的盒子
// （宽 w、高 h + 深 d，按字号的 em；和引擎一样按非行间公式画、盒子底边在基线下 d）。
// 字体和引擎同一份（清单里的字体，按清单顺序当后备，浏览器逐字找，和引擎的 FontChain 一样）。
// 每块一个 <g data-html-block>：动效挂在这上面；刚打开时按顺序浮出来。
import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

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

export function LayoutPageLayer({ page, width, height, fontFamily, arrivedAt }: {
  page: RenderLayoutPage;
  width: number;
  height: number;
  /** 字体栈（清单里的字体，按顺序当后备）。 */
  fontFamily: string;
  arrivedAt: number;
}): ReactElement {
  const texList = useMemo(() => {
    const set = new Set<string>();
    for (const block of page.blocks) for (const line of block.lines) for (const item of line.items) if ("tex" in item) set.add(item.tex);
    return [...set];
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

  return (
    <svg
      className="reader-layout-page"
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
            key={`${block.id}:${arrivedAt}`}
            className={`reader-layout-block${arriving ? " is-arriving" : ""}`}
            data-html-block={block.id}
            fill={color}
            fontSize={block.fontSize}
            fontWeight={block.weight === "bold" ? 700 : 400}
            style={{ "--reader-html-order": order, color } as CSSProperties}
          >
            {block.lines.map((line, lineIndex) => line.items.map((item, itemIndex) => {
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
                    dangerouslySetInnerHTML={{ __html: svg.inner }}
                  />
                );
              }
              return (
                <text key={key} x={item.x} y={line.baseline} lang={item.mode === "dflt" ? "en" : "zh-Hans"}>
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
