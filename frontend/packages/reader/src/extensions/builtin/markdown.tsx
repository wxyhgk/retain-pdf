// Markdown 面板作为内置扩展（2026-11-27）：右边停靠的一个面板，第一次打开才加载，之后一直挂着（留滚动位置）。
// 2026-11-28 起面板画进阅读页右边停靠栏（api.panelHost，中间工作区横排里实占的一栏），不再自己 fixed 盖在书上。
import { lazy, Suspense, type ReactElement } from "react";
import { createPortal } from "react-dom";

import { BookText } from "lucide-react";
import { useMountedSinceFirstOpen } from "../../shared/react/use-mounted-since-first-open.js";
import { useReaderApi } from "../registry.js";
import type { ReaderExtension, ReaderPanelTab } from "../types.js";

const ReaderMarkdownPanel = lazy(() => import("../../components/react-pdf/ReaderMarkdownPanel.js").then((m) => ({ default: m.ReaderMarkdownPanel })));

export const MARKDOWN_PANEL: ReaderPanelTab = { id: "markdown", label: "Markdown", short: "MD", Icon: BookText, needsJob: true };

function MarkdownExtension(): ReactElement | null {
  const api = useReaderApi();
  const open = api.activePanel === MARKDOWN_PANEL.id;
  // 闸和面板用同一个 open：闸是单调的，接错了就成了「先开过别的面板才打得开」。
  const mounted = useMountedSinceFirstOpen(open);
  if (!mounted) return null;
  const panel = (
    <Suspense fallback={null}>
      <ReaderMarkdownPanel open={open} jobId={api.jobId} sourceOnly={api.sourceOnly} side="right" onClose={api.closePanel} />
    </Suspense>
  );
  return api.panelHost ? createPortal(panel, api.panelHost) : panel;
}

export const readerMarkdownExtension: ReaderExtension = {
  id: "markdown",
  title: "Markdown",
  Component: MarkdownExtension,
  panels: [MARKDOWN_PANEL],
};
