// 页码范围：rangeOn/startPage/endPage + 校验 + 初始 setEndPage。
// - 重置：!open（或 documentId 变化）时清状态
// - 初始回填：仅当 open && pageCount && !endPage 时一次（open/pageCount 变化时检查，不监听 endPage 避免清空后被回填）
// - 校验：s/e/pageCount 边界（供 handleTranslate 复用）

import { useCallback, useEffect, useRef, useState } from "react";

export type UsePageRangeOptions = {
  open: boolean;
  documentId?: string;
  pageCount?: number | null;
};

export function usePageRange({ open, documentId, pageCount }: UsePageRangeOptions) {
  const [rangeOn, setRangeOn] = useState(false);
  const [startPage, setStartPage] = useState("1");
  const [endPage, setEndPage] = useState("");

  const endPageRef = useRef(endPage);
  useEffect(() => {
    endPageRef.current = endPage;
  }, [endPage]);

  // 关闭时重置；documentId 变化时也重置（与原 useBookDetailTranslate:29-35 保持一致）
  useEffect(() => {
    if (!open) {
      setRangeOn(false);
      setStartPage("1");
      setEndPage("");
    }
  }, [open, documentId]);

  // 初始仅当 !endPage && open 时一次；故意不依赖 endPage，避免用户清空后被回填
  useEffect(() => {
    if (open && pageCount && !endPageRef.current) {
      setEndPage(String(pageCount));
    }
  }, [open, pageCount, documentId]);

  // rangeOn 与 pageCount 联动校验：pageCount 收缩时若 endPage 越界则夹紧
  useEffect(() => {
    if (!rangeOn || !pageCount) return;
    const e = Number(endPageRef.current);
    if (Number.isInteger(e) && e > pageCount) {
      setEndPage(String(pageCount));
    }
    const s = Number(startPage);
    if (Number.isInteger(s) && s > pageCount) {
      setStartPage(String(pageCount));
    }
  }, [pageCount, rangeOn, startPage]);

  const validateRange = useCallback(() => {
    if (!rangeOn) return { valid: true as const, s: 1, e: pageCount ?? 0 };
    const s = Number(startPage);
    const e = Number(endPage);
    if (
      !Number.isInteger(s)
      || !Number.isInteger(e)
      || s < 1
      || e < s
      || (pageCount ? e > pageCount : false)
    ) {
      return {
        valid: false as const,
        error: `页码范围不合法（1–${pageCount || "总页数"}）`,
      };
    }
    return { valid: true as const, s, e };
  }, [rangeOn, startPage, endPage, pageCount]);

  return {
    rangeOn,
    startPage,
    endPage,
    setRangeOn,
    setStartPage,
    setEndPage,
    validateRange,
  };
}
