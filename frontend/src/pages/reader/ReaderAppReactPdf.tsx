// View trình đọc React-pdf: logic nằm trong useReaderReactController; công cụ là cửa sổ nổi (căn chỉnh theo bộ 4 legacy).

import { useCallback } from "react";
import { useReaderReactController } from "./hooks/use-reader-react-controller.js";
import {
  ReaderCloseHome,
  ReaderModeTabs,
  ReaderReactBoot,
  ReaderCompareGrid,
  ReaderZoomHud,
  ReaderFab,
  ReaderNotesPanel,
  ReaderFavoritesPanel,
  ReaderMarkdownPanel,
  ReaderAiPanel,
  ReaderSelectionToolbar,
} from "./components/react-pdf/index.js";
import { DownloadToastHost } from "../../shared/react/DownloadToastHost.jsx";
import { isReaderAiNavigationLocked } from "./external.js";

export function ReaderAppReactPdf() {
  const c = useReaderReactController();
  const { boot, panes, shell, sessionFiles, notes, tools, session } = c;

  const closeTool = useCallback(() => {
    tools.close();
  }, [tools]);

  // citation.page_idx tính từ 0; tương thích page / block_id(p00N); số trang trình đọc tính từ 1
  const jumpCitation = useCallback((citation: {
    page_idx?: number;
    page?: number;
    block_id?: string;
  } | number) => {
    // Trong thời gian khóa khi branch/đổi session: tuyệt đối không nhảy PDF (cảm giác như refresh + chuyển cả trang).
    if (isReaderAiNavigationLocked()) return;
    let page1: number | null = null;
    if (typeof citation === "number") {
      // Quy ước: khi truyền số trực tiếp thì đó là index 0-based.
      if (Number.isFinite(citation) && citation >= 0) {
        page1 = Math.floor(citation) + 1;
      }
    } else if (citation && typeof citation === "object") {
      const raw = citation.page_idx ?? citation.page;
      if (raw !== undefined && raw !== null && `${raw}`.trim() !== "" && Number.isFinite(Number(raw))) {
        const n = Number(raw);
         // page_idx thường tính từ 0; nếu giống 1..N và block cũng tính từ 1 thì vẫn coi là 0-based +1 (nhất quán với FTS)
        page1 = Math.floor(n) + 1;
      } else {
        const m = `${citation.block_id || ""}`.match(/(?:^|[^0-9])p0*([1-9]\d*)(?:-|_|\b)/i);
        if (m) page1 = Number(m[1]);
      }
    }
    if (page1 == null || !Number.isFinite(page1) || page1 < 1) return;
    c.goToPage(page1);
  }, [c.goToPage]);

  return (
    <div className="reader-react-root" data-reader-engine="react-pdf">
      <ReaderReactBoot
        loading={boot.loading}
        failed={boot.failed}
        text={boot.text}
        percent={boot.percent}
      />

      {/* Reader toàn trang: nút đóng góc phải trên -> về trang chủ (thay nút đóng host iframe cũ). */}
      <ReaderCloseHome />

      <ReaderModeTabs
        mode={c.mode}
        sourceOnly={c.sourceOnly}
        onModeChange={c.setModeKeepingPage}
      />

      {c.showHud ? (
        <ReaderFab
          activeTool={tools.active}
          notesCount={notes.count}
          sourceOnly={c.sourceOnly}
          onToggleTool={tools.toggle}
          download={c.download}
        />
      ) : null}

      <ReaderCompareGrid
        mode={c.mode}
        bindShell={shell.bindShell}
        shellEl={shell.shellEl}
        userZoom={c.userZoom}
        compareMode={panes.compareMode}
        shellWidth={shell.shellWidth}
        compareColWidth={shell.compareColWidth}
        rowHeights={c.rowHeights}
        mountSource={panes.mountSource}
        mountTranslated={panes.mountTranslated}
        showSource={panes.showSource}
        showTranslated={panes.showTranslated}
        sourceOnly={c.sourceOnly}
        sourceUrl={sessionFiles.sourceUrl}
        translatedUrl={sessionFiles.translatedUrl}
        sourceFile={sessionFiles.sourceFile}
        translatedFile={sessionFiles.translatedFile}
        onMetrics={panes.onMetrics}
        onNumPagesChange={panes.onNumPages}
      />

      {c.showHud ? (
        <ReaderZoomHud
          userZoom={c.userZoom}
          onZoomChange={c.onZoomChange}
          currentPage={c.currentPage}
          numPages={panes.hudNumPages}
          mode={c.mode}
          onGoToPage={c.goToPage}
        />
      ) : null}

      <ReaderNotesPanel
        open={tools.isOpen("notes")}
        groups={notes.groups}
        count={notes.count}
        onClose={closeTool}
        onJump={c.jumpToNote}
        onUpdateNote={notes.updateNote}
        onRemove={notes.remove}
        onExport={() => notes.exportMarkdown(c.documentTitle)}
      />

      <ReaderFavoritesPanel
        open={tools.isOpen("favorites")}
        jobId={session.jobId}
        documentId={session.documentId}
        onClose={closeTool}
        onJumpPage={c.goToPage}
      />

      <ReaderMarkdownPanel
        open={tools.isOpen("markdown")}
        jobId={session.jobId}
        sourceOnly={c.sourceOnly}
        onClose={closeTool}
      />

      <ReaderAiPanel
        open={tools.isOpen("ai")}
        jobId={session.jobId}
        sourceOnly={c.sourceOnly}
        onClose={closeTool}
        onJumpCitation={jumpCitation}
      />

      <ReaderSelectionToolbar
        selection={c.selection}
        onAddNote={c.addNoteFromSelection}
        onDismiss={c.clearSelection}
      />

      <DownloadToastHost />
    </div>
  );
}
