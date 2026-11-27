// Markdown 面板作为内置扩展（2026-11-27）：右边停靠的一个面板，第一次打开才加载，之后一直挂着（留滚动位置）。
import { lazy, Suspense, type ReactElement } from "react";

import { MarkdownIcon } from "../../components/react-pdf/MarkdownIcon.js";
import { useMountedSinceFirstOpen } from "../../shared/react/use-mounted-since-first-open.js";
import { useReaderApi } from "../registry.js";
import type { ReaderExtension, ReaderPanelTab } from "../types.js";

const ReaderMarkdownPanel = lazy(() => import("../../components/react-pdf/ReaderMarkdownPanel.js").then((m) => ({ default: m.ReaderMarkdownPanel })));

export const MARKDOWN_PANEL: ReaderPanelTab = { id: "markdown", label: "Markdown", short: "MD", Icon: MarkdownIcon, needsJob: true };

function MarkdownExtension(): ReactElement | null {
  const api = useReaderApi();
  const open = api.activePanel === MARKDOWN_PANEL.id;
  // 闸和面板用同一个 open：闸是单调的，接错了就成了「先开过别的面板才打得开」。
  const mounted = useMountedSinceFirstOpen(open);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <ReaderMarkdownPanel open={open} jobId={api.jobId} sourceOnly={api.sourceOnly} side="right" onClose={api.closePanel} />
    </Suspense>
  );
}

export const readerMarkdownExtension: ReaderExtension = {
  id: "markdown",
  title: "Markdown",
  Component: MarkdownExtension,
  panels: [MARKDOWN_PANEL],
};
