// 顶栏右边、底栏右边的工具（2026-11-28 起三行壳层：顶栏、底栏都是全宽实占位的栏）。按钮来自贡献表，按 place 分：
// - 顶栏右边（place 不写或 "top"）：打开面板的——提问，后面跟着扩展带的面板（Markdown）；包在一个浅灰胶囊里，和中间的页签胶囊呼应；
// - 底栏右边（"bottom"）：在书页上动手的——画笔 ▾（钢笔右下角一个当前笔色的小点，▾ 弹出笔型、颜色、撤销）、截图；
// 两条栏只用图标、一个尺寸一种线宽（bar-icon.ts），名字在 aria-label 和悬停里（2026-11-28 用户）。
// - 「对照」后面（"compare"）：换对照看法的——对比版本，只画一个 ▾（2026-11-28 从顶栏右边挪过来，那里只留提问 / Markdown）。
// 带 popup 的点了弹出（顶栏往下弹、底栏往上弹），点外面、Esc 收起。提问排第一（11-27 那 7 条意见里第 1 条是「入口太隐蔽」）。
//
// 以前（11-20）是右下角一颗黑色小球、（11-27）是底栏浮条里竖线后面一组，都浮在书页上。
// 2026-09 删过一个圆钮：两个启动器各管一半，开着面板时圆钮被 CSS 藏掉、里面的功能进不去。这里几组各管各的，面板开着时都在。
import { Fragment, useEffect, useRef, useState, type ReactElement } from "react";
import { ChevronDown } from "lucide-react";
import { BAR_CARET, BAR_ICON } from "./bar-icon.js";
import { Button } from "@retainpdf/ui";

import { BUILTIN_READER_EXTENSIONS } from "../../extensions/builtin.js";
import { useReaderContributions } from "../../extensions/registry.js";
import type { ReaderExtension, ReaderToolbarItem } from "../../extensions/types.js";
import type { ReaderAssistantPanel } from "./reader-assistant-types.js";
import { ReaderPanelToggles } from "./ReaderAssistantDock.js";
import { readerDockTabs } from "./reader-dock-tabs.js";

const FIRST = ["ask"];

function toolOrder(extensions: readonly ReaderExtension[]): readonly ReaderExtension[] {
  const rank = (extension: ReaderExtension) => {
    const at = FIRST.indexOf(extension.id);
    return at < 0 ? FIRST.length : at;
  };
  return [...extensions].sort((a, b) => rank(a) - rank(b));
}

export type ReaderBarPlace = "top" | "bottom" | "compare";

export function ReaderBarTools({
  place,
  active = null,
  extensions: registered = BUILTIN_READER_EXTENSIONS,
}: {
  place: ReaderBarPlace;
  /** 开着哪个面板（顶栏的面板按钮按下）。 */
  active?: ReaderAssistantPanel | null;
  extensions?: readonly ReaderExtension[];
}): ReactElement | null {
  // 顶栏：提问排第一；底栏照扩展登记的顺序（画笔 ▾、截图）。
  const extensions = place === "top" ? toolOrder(registered) : registered;
  // 开着哪颗按钮的弹出（扩展 id + 按钮 key + popup / dropdown）。
  const [menu, setMenu] = useState<string | null>(null);
  const contributions = useReaderContributions();
  const itemsOf = (id: string): readonly ReaderToolbarItem[] =>
    (contributions.find((entry) => entry.id === id)?.contribution.toolbarItems ?? []).filter((item) => (item.place ?? "top") === place);
  const close = () => setMenu(null);
  const opened = (() => {
    if (!menu) return null;
    for (const { id } of extensions) {
      for (const item of itemsOf(id)) {
        if (`${id}:${item.key}:popup` === menu && item.popup) return item.popup(close);
        if (`${id}:${item.key}:dropdown` === menu && item.dropdown) return item.dropdown(close);
      }
    }
    return null;
  })();
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menu) return undefined;
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
  }, [menu]);

  const groups = extensions.map((extension) => {
    const items = itemsOf(extension.id);
    const tabs = place === "top" ? readerDockTabs([extension]) : [];
    if (!items.length && !tabs.length) return null;
    return (
      <Fragment key={extension.id}>
        {items.map((item) => {
          const key = `${extension.id}:${item.key}`;
          const Icon = item.Icon;
          return (
            <span key={key} className="reader-bar-tool-group" data-has-dropdown={item.dropdown ? "true" : undefined}>
              <Button
                className={place === "compare" ? "reader-bar-tool reader-bar-tool-compare" : "reader-bar-tool"}
                aria-label={item.label}
                title={item.title || item.label}
                aria-pressed={Boolean(item.pressed) || menu === `${key}:popup`}
                aria-expanded={item.popup ? menu === `${key}:popup` : undefined}
                data-bar-tool={item.key}
                onClick={() => {
                  if (item.popup) {
                    setMenu((current) => (current === `${key}:popup` ? null : `${key}:popup`));
                    return;
                  }
                  item.onClick?.();
                  close();
                }}
              >
                {place === "compare" ? <ChevronDown {...BAR_CARET} aria-hidden /> : (item.mark ?? <Icon {...BAR_ICON} aria-hidden />)}
              </Button>
              {item.dropdown ? (
                <Button
                  className="reader-bar-tool-caret"
                  aria-label={`${item.label}：选项`}
                  title={`${item.label}的选项`}
                  aria-expanded={menu === `${key}:dropdown`}
                  data-bar-tool-caret={item.key}
                  onClick={() => setMenu((current) => (current === `${key}:dropdown` ? null : `${key}:dropdown`))}
                >
                  <ChevronDown {...BAR_CARET} aria-hidden />
                </Button>
              ) : null}
            </span>
          );
        })}
        {tabs.length ? <ReaderPanelToggles active={active} tabs={tabs} /> : null}
      </Fragment>
    );
  }).filter(Boolean);
  if (!groups.length) return null;

  return (
    <div className={`reader-bar-tools is-${place}`} ref={root} role="group" aria-label={place === "top" ? "面板" : place === "compare" ? "对比版本" : "书页工具"}>
      {groups}
      {opened ? <div className="reader-bar-tools-popup">{opened}</div> : null}
    </div>
  );
}
