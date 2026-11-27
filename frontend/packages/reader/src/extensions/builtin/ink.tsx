// 画笔作为内置扩展（2026-11-27）：笔迹按书存在本机（hooks/use-reader-ink）。
// 登记：底栏右边的「画笔 ▾」（主按钮进出画笔，▾ 弹出笔型、颜色、撤销）、右键菜单里的笔和颜色那一排、每页的笔迹层、
// 画笔模式下占着指针（书页不出悬停框、不让拖选）、快捷键说明。P 进出画笔、Esc 退出、⌘Z 撤销在 useInkShortcuts 里自己监听。
// 2026-11-28 起画笔模式下不再在左下角常驻一条工具（三行壳层：底栏实占位，平时不展开工具栏，要换笔点 ▾）。
import { useMemo, type ReactElement } from "react";
import { PenLine } from "lucide-react";

import { ReaderInkMenuSection, useInkShortcuts } from "../../components/react-pdf/ReaderInkPalette.js";
import { useReaderInk, type ReaderInk } from "../../hooks/use-reader-ink.js";
import { InkLayer } from "../../pdf/InkLayer.js";
import { useReaderApi, useReaderContribution } from "../registry.js";
import type { ReaderContribution, ReaderExtension } from "../types.js";

const SHORTCUTS = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" },
] as const;

/** 画笔往贡献表里放的东西（单独拿出来，测试不用起整个扩展）。 */
export function inkContribution(ink: ReaderInk): ReaderContribution {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: PenLine,
      // 底栏左右同密度（2026-11-28）：画笔前面是当前笔色的小圆点，不画钢笔线框图。
      mark: <span className="reader-ink-dot" style={{ background: `var(--${ink.color})` }} aria-hidden />,
      place: "bottom",
      pressed: Boolean(ink.tool),
      onClick: () => ink.setTool(ink.tool ? null : "pen"),
      dropdown: (done) => <ReaderInkMenuSection ink={ink} onPick={done} />,
    }],
    menuSection: ({ page, close }) => <ReaderInkMenuSection ink={ink} page={page} onPick={close} />,
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page, pane, width, height, active }) => (active ? <InkLayer page={page} pane={pane} width={width} height={height} ink={ink} /> : null),
    takesPointer: Boolean(ink.tool),
    shortcuts: SHORTCUTS,
  };
}

function InkExtension(): ReactElement | null {
  const api = useReaderApi();
  const ink = useReaderInk(api.resetKey);
  useInkShortcuts(ink);
  const contribution = useMemo(() => inkContribution(ink), [ink]);
  useReaderContribution(contribution);
  return null;
}

export const readerInkExtension: ReaderExtension = { id: "ink", title: "画笔", Component: InkExtension };
