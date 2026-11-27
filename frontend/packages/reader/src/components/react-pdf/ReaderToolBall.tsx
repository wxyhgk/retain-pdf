// 阅读页右下角的悬浮小球：面板（Markdown）和各扩展按钮（对比版本……）的唯一入口（2026-11-20 起，以前在顶栏，顶栏按钮太多）。
// 点小球往上展开一列图标按钮，名字在悬停里；带弹出的按钮（「对比版本」的版本列表）点了在旁边弹出来。点外面、按 Esc 收起。
// 2026-11-27 起按钮来自贡献表：按扩展顺序，每个扩展先是它登记的按钮（toolbarItems），再是它带的面板。
//
// 2026-09 删过一个圆钮：那时有两个启动器各管一半，而且开着面板时圆钮被 CSS 藏掉，里面的功能就进不去了。
// 这个小球是唯一的启动器，面板开着时不藏，挪到面板左边（toolball.css）。
import { Fragment, useEffect, useRef, useState, type ReactElement } from "react";
import { LayoutGrid, PenLine, X } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { BUILTIN_READER_EXTENSIONS } from "../../extensions/builtin.js";
import { useReaderContributions } from "../../extensions/registry.js";
import type { ReaderExtension, ReaderToolbarItem } from "../../extensions/types.js";
import type { ReaderInk } from "../../hooks/use-reader-ink.js";
import type { ReaderAssistantPanel } from "./reader-assistant-types.js";
import { ReaderPanelToggles } from "./ReaderAssistantDock.js";
import { readerDockTabs } from "./reader-dock-tabs.js";

export function ReaderToolBall({
  active,
  ink,
  extensions = BUILTIN_READER_EXTENSIONS,
}: {
  active: ReaderAssistantPanel | null;
  ink?: ReaderInk;
  extensions?: readonly ReaderExtension[];
}): ReactElement {
  const [open, setOpen] = useState(false);
  // 开着哪颗按钮的弹出（扩展 id + 按钮 key），没开是 null。
  const [menu, setMenu] = useState<string | null>(null);
  const contributions = useReaderContributions();
  const itemsOf = (id: string): readonly ReaderToolbarItem[] => contributions.find((entry) => entry.id === id)?.contribution.toolbarItems ?? [];
  const pressed = extensions.some(({ id }) => itemsOf(id).some((item) => item.pressed));
  const names = extensions.flatMap((extension) => [...itemsOf(extension.id).map((item) => item.label), ...(extension.panels ?? []).map((panel) => panel.label)]);
  const popup = (() => {
    if (!menu) return null;
    for (const { id } of extensions) {
      const item = itemsOf(id).find((entry) => `${id}:${entry.key}` === menu);
      if (item?.popup) return item.popup(() => { setMenu(null); setOpen(false); });
    }
    return null;
  })();
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open && !menu) return undefined;
    const close = () => {
      setOpen(false);
      setMenu(null);
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

  return (
    <div className="reader-toolball" ref={root} data-open={open ? "true" : undefined}>
      {popup}
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
          {extensions.map((extension) => {
            const tabs = readerDockTabs([extension]);
            return (
              <Fragment key={extension.id}>
                {itemsOf(extension.id).map((item) => {
                  const key = `${extension.id}:${item.key}`;
                  const Icon = item.Icon;
                  return (
                    <Button
                      key={key}
                      className="reader-toolball-item"
                      aria-label={item.label}
                      title={item.title || item.label}
                      aria-pressed={Boolean(item.pressed) || menu === key}
                      data-toolball-item={item.key}
                      onClick={() => {
                        if (item.popup) {
                          setMenu((current) => (current === key ? null : key));
                          return;
                        }
                        item.onClick?.();
                        setOpen(false);
                      }}
                    >
                      <Icon size={18} strokeWidth={2.1} aria-hidden />
                    </Button>
                  );
                })}
                {tabs.length ? <ReaderPanelToggles active={active} tabs={tabs} /> : null}
              </Fragment>
            );
          })}
        </div>
      ) : null}
      <Button
        className="reader-toolball-ball"
        aria-label={open ? "收起工具" : `工具：${[...(ink ? ["画笔"] : []), ...names].join("、")}`}
        title={open ? "收起" : "工具"}
        aria-expanded={open}
        data-active={active || pressed ? "true" : undefined}
        onClick={() => {
          setOpen((value) => !value);
          setMenu(null);
        }}
      >
        {open ? <X size={20} strokeWidth={2.2} aria-hidden /> : <LayoutGrid size={20} strokeWidth={2.1} aria-hidden />}
      </Button>
    </div>
  );
}
