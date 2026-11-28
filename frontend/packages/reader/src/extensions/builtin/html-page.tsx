// HTML 页作为内置扩展（2026-11-28，pdf/HtmlPageLayer.tsx 说了是什么）：
// 书页区右缘竖条上一颗按钮（CodeXml），点开往左弹：关 / 画译文 / 画原文。开着时原文栏的每一页上叠一层 HTML。
// 只画在原文栏（底下是原文页的图形）：开着时如果在看「译文」就切到「原文」；对照时左边是 HTML 页、右边是译文 PDF，正好对着看。
// 对比版本时左栏是另一份译文的 PDF（layerPane 是 "compare"），不画。开关只在这次打开里有效，不写本机。
import { useMemo, useState, type ReactElement } from "react";
import { CodeXml } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { HtmlPageLayer, regionsByPage, type HtmlPageText } from "../../pdf/HtmlPageLayer.js";
import { useReaderApi, useReaderContribution } from "../registry.js";
import type { ReaderContribution, ReaderExtension } from "../types.js";

const CHOICES: readonly { value: HtmlPageText | null; label: string; hint: string }[] = [
  { value: null, label: "关", hint: "看原来的 PDF" },
  { value: "translated", label: "画译文", hint: "原文页上按 OCR 的框用 HTML 画译文" },
  { value: "source", label: "画原文", hint: "原文页上按 OCR 的框用 HTML 重画原文" },
];

function HtmlPageExtension(): ReactElement | null {
  const api = useReaderApi();
  const [text, setText] = useState<HtmlPageText | null>(null);
  const [arrivedAt, setArrivedAt] = useState(0);
  const byPage = useMemo(() => regionsByPage(api.regions), [api.regions]);
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
        title: text ? `HTML 页：${text === "translated" ? "画译文" : "画原文"}（点开换）` : "HTML 页：按 OCR 的框把书页用 HTML 画出来",
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
          </div>
        ),
      }],
      pageLayer: text
        ? ({ page, width, height, pane, active }) => (active && pane === "source" ? (
          <HtmlPageLayer
            page={page}
            width={width}
            height={height}
            regions={byPage.get(page) ?? []}
            metadata={metadata}
            text={text}
            arrivedAt={arrivedAt}
          />
        ) : null)
        : undefined,
    };
  }, [text, arrivedAt, byPage, metadata, hasTranslation, visibleMode, setWorkspace]);
  useReaderContribution(contribution);
  return null;
}

export const readerHtmlPageExtension: ReaderExtension = { id: "html-page", title: "HTML 页", Component: HtmlPageExtension };
