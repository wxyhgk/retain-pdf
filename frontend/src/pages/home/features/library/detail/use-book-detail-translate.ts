// Tab «Dịch» chi tiết: phạm vi trang + khởi tạo dịch + attachJobProgress âm thầm.
// Tiến trình chỉ ở bd-job-status-inner, không mở hộp thoại workflow.

import { useEffect, useState } from "react";

/**
 * @param {object} options
 * @param {boolean} options.open
 * @param {string} options.documentId
 * @param {number} options.pageCount
 * @param {object} options.actions library.actions (chứa attachJobProgress / translateDocument)
 * @param {(key: string, fn: Function, fail: string) => Promise<void>} options.withBusy
 * @param {(msg: string) => void} options.setError
 * @param {() => void} [options.onTranslateStarted] sau khi gửi thành công, chuyển sang tab dịch v.v.
 */
export function useBookDetailTranslate({
  open,
  documentId,
  pageCount,
  actions,
  withBusy,
  setError,
  onTranslateStarted,
}: any) {
  const [rangeOn, setRangeOn] = useState(false);
  const [startPage, setStartPage] = useState("1");
  const [endPage, setEndPage] = useState("");

  useEffect(() => {
    if (!open) {
      setRangeOn(false);
      setStartPage("1");
      setEndPage("");
    }
  }, [open, documentId]);

  useEffect(() => {
    if (pageCount && !endPage) {
      setEndPage(`${pageCount}`);
    }
  }, [pageCount, endPage]);

  async function handleTranslate() {
    const payload: any = {};
    if (rangeOn) {
      const s = Number(startPage);
      const e = Number(endPage);
      if (
        !Number.isInteger(s)
        || !Number.isInteger(e)
        || s < 1
        || e < s
        || (pageCount && e > pageCount)
      ) {
        setError(`Phạm vi trang không hợp lệ (1–${pageCount || "tổng số trang"})`);
        return;
      }
      payload.ocr = { page_ranges: `${s}-${e}` };
      payload.translation = { start_page: s, end_page: e };
    }
    // Chuyển sang tab dịch trước, bảo đảm bd-job-status-inner nằm trong viewport rồi nối tiến trình
    onTranslateStarted?.();
    await withBusy(
      "translate",
      async () => {
        // promoteDocumentToJob: đổi payload chi tiết + attachJobProgress âm thầm
        // không mở openTranslationWorkflow
        await actions.translateDocument(documentId, payload);
        onTranslateStarted?.();
      },
      "Khởi tạo dịch thất bại",
    );
  }

  return {
    rangeOn,
    startPage,
    endPage,
    setRangeOn,
    setStartPage,
    setEndPage,
    handleTranslate,
  };
}
