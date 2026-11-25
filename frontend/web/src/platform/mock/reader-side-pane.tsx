// 演示模式下阅读页的第二栏（@retainpdf/reader 的 sidePane 口子）：只在 mock 里出现，
// 用来看「学习」页签、回书里看、页边小圆点通不通。学习系统接进来以后由它的面板替换。
// 不调后端；锚点指向 mock 书的两块（platform/mock/reader.ts）和第 2 页。

import { useEffect, useState } from "react";
import { Button } from "@retainpdf/ui";
import type { ReaderMarginMarker, ReaderSidePaneApi, ReaderSidePanePort } from "@retainpdf/reader/contracts";

import { isMockMode } from "@/platform/config/runtime.js";

const DEMO_POINTS: Array<ReaderMarginMarker & { note: string }> = [
  { key: "intro", label: "原始 PDF：会了", tone: "ok", anchor: { page: 1, itemId: "b-intro-3" }, note: "按块编号找" },
  { key: "body", label: "联调预览：卡住", tone: "danger", anchor: { page: 1, quote: "RetainPDF Mock Preview" }, note: "按原文找（没给块编号）" },
  { key: "page2", label: "第 2 页：还没测", tone: "muted", hollow: true, anchor: { page: 2 }, note: "只给页码" },
];

const JUMP_COPY = { block: "找到了这一块", page: "翻到了那一页（没找到块）", none: "页码不对，没跳" } as const;

function DemoPane({ api }: { api: ReaderSidePaneApi }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const { setMarginMarkers } = api;
  useEffect(() => {
    setMarginMarkers(DEMO_POINTS, setSelected);
    return () => setMarginMarkers([]);
  }, [setMarginMarkers]);

  return (
    <section data-mock-side-pane="" style={{ padding: 16, display: "grid", gap: 12, color: "var(--ink)" }}>
      <header>
        <strong>学习（演示）</strong>
        <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
          演示模式里的占位：点「回书里看」左栏跳过去；点书页左边的小圆点，这里选中对应的一条。现在看到第 {api.currentPage} 页。
        </p>
      </header>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {DEMO_POINTS.map((point) => (
          <li
            key={point.key}
            data-mock-side-point={point.key}
            aria-current={selected === point.key ? "true" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              border: "1px solid var(--line)",
              borderRadius: "var(--ui-radius-sm, 6px)",
              background: selected === point.key ? "var(--accent-weak)" : "transparent",
            }}
          >
            <span style={{ flex: 1 }}>
              {point.label}
              <span style={{ display: "block", color: "var(--muted)" }}>{point.note}</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelected(point.key);
                setStatus(JUMP_COPY[api.navigateToAnchor(point.anchor)]);
              }}
            >
              回书里看
            </Button>
          </li>
        ))}
      </ul>
      {status ? <p role="status" style={{ margin: 0, color: "var(--muted)" }}>{status}</p> : null}
    </section>
  );
}

export const mockReaderSidePanePort: ReaderSidePanePort = {
  label: "学习",
  isAvailableFor: () => isMockMode(),
  render: (api) => <DemoPane api={api} />,
};
