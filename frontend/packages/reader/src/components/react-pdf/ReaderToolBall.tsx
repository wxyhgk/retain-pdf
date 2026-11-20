// 阅读页右下角的悬浮小球：面板（Markdown）和「对比版本」的唯一入口（2026-11-20 起，以前在顶栏，顶栏按钮太多）。
// 点小球往上展开一列图标按钮，名字在悬停里；点「对比版本」弹出版本列表。点外面、按 Esc 收起。
//
// 2026-09 删过一个圆钮：那时有两个启动器各管一半，而且开着面板时圆钮被 CSS 藏掉，里面的功能就进不去了。
// 这个小球是唯一的启动器，面板开着时不藏，挪到面板左边（toolball.css）。
import { useEffect, useRef, useState, type ReactElement } from "react";
import { GitCompareArrows, LayoutGrid, PenLine, X } from "lucide-react";
import { Button } from "@retainpdf/ui";

import type { VersionCompare } from "../../hooks/use-reader-version-compare.js";
import type { ReaderInk } from "../../hooks/use-reader-ink.js";
import type { ReaderAssistantPanel } from "./reader-assistant-types.js";
import { ReaderPanelToggles } from "./ReaderAssistantDock.js";
import { VersionCompareMenu } from "./ReaderVersionCompare.js";

export function ReaderToolBall({ active, compare, ink }: { active: ReaderAssistantPanel | null; compare: VersionCompare; ink?: ReaderInk }): ReactElement {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open && !menu) return undefined;
    const close = () => {
      setOpen(false);
      setMenu(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, menu]);

  const comparing = Boolean(compare.compared || compare.loading);
  return (
    <div className="reader-toolball" ref={root} data-open={open ? "true" : undefined}>
      {menu ? <VersionCompareMenu compare={compare} onDone={() => { setMenu(false); setOpen(false); }} /> : null}
      {open ? (
        <div className="reader-toolball-stack" role="group" aria-label="工具">
          {ink ? (
            <Button
              className="reader-toolball-item"
              aria-label="画笔"
              title="画笔（P；书页上右键也能选笔和颜色）"
              aria-pressed={Boolean(ink.tool)}
              data-toolball-item="ink"
              onClick={() => {
                ink.setTool(ink.tool ? null : "pen");
                setOpen(false);
              }}
            >
              <PenLine size={18} strokeWidth={2.1} aria-hidden />
            </Button>
          ) : null}
          <ReaderPanelToggles active={active} />
          {compare.available ? (
            <Button
              className="reader-toolball-item"
              aria-label="对比版本"
              title="对比版本：左边换成这本书的另一份译文"
              aria-pressed={comparing || menu}
              data-toolball-item="compare"
              onClick={() => setMenu((value) => !value)}
            >
              <GitCompareArrows size={18} strokeWidth={2.1} aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
      <Button
        className="reader-toolball-ball"
        aria-label={open ? "收起工具" : "工具：画笔、Markdown、对比版本"}
        title={open ? "收起" : "工具"}
        aria-expanded={open}
        data-active={active || comparing ? "true" : undefined}
        onClick={() => {
          setOpen((value) => !value);
          setMenu(false);
        }}
      >
        {open ? <X size={20} strokeWidth={2.2} aria-hidden /> : <LayoutGrid size={20} strokeWidth={2.1} aria-hidden />}
      </Button>
    </div>
  );
}
