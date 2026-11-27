// 画笔作为内置扩展（2026-11-27）：笔迹按书存在本机（hooks/use-reader-ink）。
// 登记：底栏工具里的「画笔」按钮、右键菜单里的笔和颜色那一排、每页的笔迹层、画笔模式下占着指针（书页不出悬停框、不让拖选）、快捷键说明；
// 画笔模式下左下角常驻的那一条是这个组件自己画的。P 进出画笔、Esc 退出、⌘Z 撤销在 useInkShortcuts 里自己监听。
import { useMemo, type ReactElement } from "react";
import { PenLine } from "lucide-react";

import { ReaderInkDock, ReaderInkMenuSection, useInkShortcuts } from "../../components/react-pdf/ReaderInkPalette.js";
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
      pressed: Boolean(ink.tool),
      onClick: () => ink.setTool(ink.tool ? null : "pen"),
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
  return <ReaderInkDock ink={ink} />;
}

export const readerInkExtension: ReaderExtension = { id: "ink", title: "画笔", Component: InkExtension };
