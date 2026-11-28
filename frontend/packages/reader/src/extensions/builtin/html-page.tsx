// HTML 页作为内置扩展（2026-11-28，pdf/HtmlPageLayer.tsx 说了是什么）：
// 书页区右缘竖条上一颗按钮（CodeXml），点开往左弹：关 / 画译文 / 画原文。开着时原文栏的每一页上叠一层 HTML。
// 只画在原文栏（底下是原文页的图形）：开着时如果在看「译文」就切到「原文」；对照时左边是 HTML 页、右边是译文 PDF，正好对着看。
// 对比版本时左栏是另一份译文的 PDF（layerPane 是 "compare"），不画。开关只在这次打开里有效，不写本机。
// 「画译文」有排版引擎的版面（layout.json，hooks/use-render-layout.ts）时照版面画（pdf/LayoutPageLayer.tsx，和译文 PDF 一样）；
// 版面里没有的页是原页（整页图、不翻的参考文献）。没有版面时退回按 OCR 的框塞字（pdf/HtmlPageLayer.tsx）。
// 动效（只在照版面画时有）：菜单里「逐行浮现」开关（11-28 先做的逐字太慢，改成逐行）；点公式分步展开一直有（LayoutPageLayer）。
// 版面从正式接口来（2026-11-28 后端 #241 / #242）：开了「画译文」才去要清单；没有版面时菜单里说为什么，能补排就给「生成 HTML 排版」
// （照清单给的请求原样发，原地重新渲染，不花钱），排好自动照版面画。底图（去掉原字的原文页）在版面底下画。
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { CodeXml } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { useRenderLayout } from "../../hooks/use-render-layout.js";
import { HtmlPageLayer, regionsByPage, type HtmlPageText } from "../../pdf/HtmlPageLayer.js";
import { LayoutPageHost } from "../../pdf/LayoutPageLayer.js";
import type { RegionPdfDocument } from "../../pdf/RegionCanvas.js";
import { loadLayoutBackground } from "../../pdf/layout-background.js";
import { useReaderApi, useReaderContribution } from "../registry.js";
import type { ReaderContribution, ReaderExtension } from "../types.js";

const CHOICES: readonly { value: HtmlPageText | null; label: string; hint: string }[] = [
  { value: null, label: "关", hint: "看原来的 PDF" },
  { value: "translated", label: "画译文", hint: "原文页上按 OCR 的框用 HTML 画译文" },
  { value: "source", label: "画原文", hint: "原文页上按 OCR 的框用 HTML 重画原文" },
];

/** 菜单里说为什么没照版面画（清单的 reason，见 docs/api/12-阅读/01-阅读接口.md）。 */
const REASON_TEXT: Record<string, string> = {
  no_translated_pdf: "还没有译文 PDF（或正在重新渲染）",
  not_engine_route: "这次的译文是 Typst 排的，没有版面",
  unsupported_render: "这本书的排版设置引擎排不了（双栏对照、字体不是思源宋体）",
  merged_reading: "合并阅读的书没有版面",
  not_kept: "版面没留下来（以前排的书）",
  no_fonts: "版面还没有字体（以前排的书）",
  failed: "版面没要到",
};

function HtmlPageExtension(): ReactElement | null {
  const api = useReaderApi();
  const [text, setText] = useState<HtmlPageText | null>(null);
  const [arrivedAt, setArrivedAt] = useState(0);
  const [charRise, setCharRise] = useState(false);
  const byPage = useMemo(() => regionsByPage(api.regions), [api.regions]);
  const layoutState = useRenderLayout(api.jobId, text === "translated");
  const layout = layoutState.status === "ready" ? layoutState : null;
  const { generateNow } = layoutState;
  const unavailable = layoutState.status === "unavailable" ? layoutState : null;
  const generating = layoutState.status === "generating";
  // 底图的 PDF：有版面、有底图才读，读一次。
  const backgroundUrl = layout?.source.background?.url || "";
  const [backgroundPdf, setBackgroundPdf] = useState<RegionPdfDocument | null>(null);
  useEffect(() => {
    setBackgroundPdf(null);
    if (!backgroundUrl) return undefined;
    const controller = new AbortController();
    void loadLayoutBackground(backgroundUrl, controller.signal)
      .then((pdf) => {
        if (!controller.signal.aborted && pdf) setBackgroundPdf(pdf);
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.warn("[html-page] 底图没读到，用原文页做底：", error);
      });
    return () => controller.abort();
  }, [backgroundUrl]);
  const hasTranslation = !api.sourceOnly;
  const { metadata, visibleMode, setWorkspace } = api;

  const contribution = useMemo<ReaderContribution>(() => {
    const choose = (next: HtmlPageText | null) => {
      setText(next);
      setArrivedAt(Date.now());
      if (next && visibleMode === "translated") setWorkspace("source");
    };
    return {
      toolbarItems: [{
        key: "html-page",
        label: "HTML 页",
        title: text
          ? `HTML 页：${text === "translated" ? (layout ? "画译文（照排版引擎的版面）" : "画译文（按识别的框）") : "画原文"}（点开换）`
          : "HTML 页：把书页用 HTML 画出来",
        Icon: CodeXml,
        pressed: Boolean(text),
        popup: (done) => (
          <div className="reader-html-page-menu reader-floating-surface" role="menu" aria-label="HTML 页">
            {CHOICES.filter((choice) => choice.value !== "translated" || hasTranslation).map((choice) => (
              <Button
                key={choice.label}
                className="reader-html-page-choice"
                role="menuitemradio"
                aria-checked={text === choice.value}
                title={choice.hint}
                onClick={() => {
                  choose(choice.value);
                  done();
                }}
              >
                {choice.label}
              </Button>
            ))}
            {text === "translated" && unavailable ? (
              <>
                <span className="reader-html-page-menu-sep" aria-hidden />
                <p className="reader-html-page-menu-note">现在按识别的框画：{REASON_TEXT[unavailable.reason] || REASON_TEXT.not_kept}。</p>
                {unavailable.generate ? (
                  <Button
                    className="reader-html-page-choice"
                    title="照排版引擎重新排一次版面（不重新翻译、不花钱），排好自动换上，和译文 PDF 一样"
                    onClick={() => {
                      generateNow();
                      done();
                    }}
                  >
                    生成 HTML 排版
                  </Button>
                ) : null}
              </>
            ) : null}
            {text === "translated" && generating ? (
              <>
                <span className="reader-html-page-menu-sep" aria-hidden />
                <p className="reader-html-page-menu-note">正在排版（不花钱），先按识别的框画，排好自动换上…</p>
              </>
            ) : null}
            {layout ? (
              <>
                <span className="reader-html-page-menu-sep" aria-hidden />
                <Button
                  className="reader-html-page-choice"
                  role="menuitemcheckbox"
                  aria-checked={charRise}
                  title="一段话滚进来时，一行接一行浮上来"
                  onClick={() => {
                    setCharRise((value) => !value);
                    if (!text) choose("translated");
                    done();
                  }}
                >
                  逐行浮现
                </Button>
                <p className="reader-html-page-menu-note">点公式会分步展开</p>
              </>
            ) : null}
          </div>
        ),
      }],
      pageLayer: text
        ? ({ page, width, height, pane, active }) => {
          if (!active || pane !== "source") return null;
          if (text === "translated" && layout) {
            return (
              <LayoutPageHost
                source={layout.source}
                page={page}
                width={width}
                height={height}
                fontFamily={layout.fontFamily}
                arrivedAt={arrivedAt}
                charRise={charRise}
                backgroundPdf={backgroundPdf}
              />
            );
          }
          return (
            <HtmlPageLayer
              page={page}
              width={width}
              height={height}
              regions={byPage.get(page) ?? []}
              metadata={metadata}
              text={text}
              arrivedAt={arrivedAt}
            />
          );
        }
        : undefined,
    };
  }, [text, arrivedAt, byPage, metadata, hasTranslation, visibleMode, setWorkspace, layout, charRise, unavailable, generating, generateNow, backgroundPdf]);
  useReaderContribution(contribution);
  return null;
}

export const readerHtmlPageExtension: ReaderExtension = { id: "html-page", title: "HTML 页", Component: HtmlPageExtension };
