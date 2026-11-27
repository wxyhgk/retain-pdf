// 底栏右边那组工具（2026-11-27 起，取代右下角的悬浮小球）：提问、画笔、Markdown、对比版本……都在底栏竖线后面，
// 和页码、缩放是同一条：读书时一起往下收（use-hud-autohide），四个角都空着。以前是右下角一颗黑色实心球，点开往上一列，
// 和底栏的白药丸两种样子压在正文上，最显眼的却是最不常用的。
// 按钮来自贡献表：按扩展顺序，每个扩展先是它登记的按钮（toolbarItems），再是它带的面板（Markdown）。带弹出的（对比版本的列表）弹在底栏上面。
// 书页区窄（手机、左栏钉住又开着面板）时一排放不下：收成一颗「···」，点开往上一列（toolball.css 的容器查询切换）。
//
// 2026-09 删过一个圆钮：那时两个启动器各管一半，开着面板时圆钮被 CSS 藏掉、里面的功能进不去。这里是唯一的入口，面板开着时也在。
import { Fragment, useEffect, useRef, useState, type ReactElement } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { BUILTIN_READER_EXTENSIONS } from "../../extensions/builtin.js";
import { useReaderContributions } from "../../extensions/registry.js";
import type { ReaderExtension, ReaderToolbarItem } from "../../extensions/types.js";
import type { ReaderAssistantPanel } from "./reader-assistant-types.js";
import { ReaderPanelToggles } from "./ReaderAssistantDock.js";
import { readerDockTabs } from "./reader-dock-tabs.js";

/** 排在最前的扩展：提问最常用，放竖线后面第一个（11-27 那 7 条意见里第 1 条就是「入口太隐蔽」）。别的照扩展登记的顺序。 */
const FIRST = ["ask"];

function toolOrder(extensions: readonly ReaderExtension[]): readonly ReaderExtension[] {
  const rank = (extension: ReaderExtension) => {
    const at = FIRST.indexOf(extension.id);
    return at < 0 ? FIRST.length : at;
  };
  return [...extensions].sort((a, b) => rank(a) - rank(b));
}

export function ReaderHudTools({
  active,
  extensions: registered = BUILTIN_READER_EXTENSIONS,
}: {
  active: ReaderAssistantPanel | null;
  extensions?: readonly ReaderExtension[];
}): ReactElement | null {
  const extensions = toolOrder(registered);
  // 窄的时候「···」开没开；开着哪颗按钮的弹出（扩展 id + 按钮 key）。
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const contributions = useReaderContributions();
  const itemsOf = (id: string): readonly ReaderToolbarItem[] => contributions.find((entry) => entry.id === id)?.contribution.toolbarItems ?? [];
  const names = extensions.flatMap((extension) => [...itemsOf(extension.id).map((item) => item.label), ...(extension.panels ?? []).map((panel) => panel.label)]);
  const pressed = extensions.some(({ id }) => itemsOf(id).some((item) => item.pressed));
  const close = () => {
    setMore(false);
    setMenu(null);
  };
  const popup = (() => {
    if (!menu) return null;
    for (const { id } of extensions) {
      const item = itemsOf(id).find((entry) => `${id}:${entry.key}` === menu);
      if (item?.popup) return item.popup(close);
    }
    return null;
  })();
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!more && !menu) return undefined;
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
  }, [more, menu]);
  if (!names.length) return null;

  const buttons = extensions.map((extension) => {
    const tabs = readerDockTabs([extension]);
    return (
      <Fragment key={extension.id}>
        {itemsOf(extension.id).map((item) => {
          const key = `${extension.id}:${item.key}`;
          const Icon = item.Icon;
          return (
            <Button
              key={key}
              className="reader-react-hud-btn reader-hud-tool"
              aria-label={item.label}
              title={item.title || item.label}
              aria-pressed={Boolean(item.pressed) || menu === key}
              aria-expanded={item.popup ? menu === key : undefined}
              data-hud-tool={item.key}
              onClick={() => {
                if (item.popup) {
                  setMenu((current) => (current === key ? null : key));
                  return;
                }
                item.onClick?.();
                close();
              }}
            >
              <Icon size={15} strokeWidth={2.1} aria-hidden />
            </Button>
          );
        })}
        {tabs.length ? <ReaderPanelToggles active={active} tabs={tabs} /> : null}
      </Fragment>
    );
  });

  return (
    <div className="reader-react-hud-group reader-hud-tools" ref={root} aria-label="工具" data-active={active || pressed ? "true" : undefined}>
      <div className="reader-hud-tools-row" role="group" aria-label="工具">{buttons}</div>
      <Button
        className="reader-react-hud-btn reader-hud-tools-more"
        aria-label={more ? "收起工具" : `工具：${names.join("、")}`}
        title={more ? "收起" : `工具：${names.join("、")}`}
        aria-expanded={more}
        aria-pressed={Boolean(active || pressed)}
        onClick={() => {
          setMore((value) => !value);
          setMenu(null);
        }}
      >
        <MoreHorizontal size={15} strokeWidth={2.1} aria-hidden />
      </Button>
      {more ? <div className="reader-hud-tools-stack" role="group" aria-label="工具">{buttons}</div> : null}
      {popup ? <div className="reader-hud-tools-popup">{popup}</div> : null}
    </div>
  );
}
