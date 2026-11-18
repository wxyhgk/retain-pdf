// 页码选择：rangeOn + 一个混合页码字符串（`1-5, 8, 12-14`）+ 校验。
//
// 原来是起、止两个字段，只能表达连续区间。改成单个混合输入，是因为「只翻某几页」常常
// 不连续（摘要 + 第 3 章 + 附录的某张表）。OCR 和翻译两个 hook 共用这一份：
//   - OCR：`spec` 原样交给 `ocr.page_ranges`，MinerU 原生支持混合范围
//   - 翻译：`pages`（1 起的文档页号）交给 `translation.page_ranges`
//
// - 作用域：(open, documentId) 变化即重置（换文档即使弹窗一直开着也不串页码）
// - 初始回填：仅当 open && pageCount && pageSpec 仍为空时回填 `1-N` 一次；pageCount
//   迟到时补填，但不依赖 pageSpec（避免用户手动清空后被回填）

import { useCallback, useEffect, useRef, useState } from "react";

import { parsePageSelection } from "../domain/page-selection.js";

export type UsePageRangeOptions = {
  open: boolean;
  documentId?: string;
  pageCount?: number | null;
};

// 扁平而不是判别联合：tsconfig 是 strict: false，判别不收窄。
export type PageRangeCheck = {
  valid: boolean;
  pages: number[];
  spec: string;
  all: boolean;
  error: string;
};

export function usePageRange({ open, documentId, pageCount }: UsePageRangeOptions) {
  const [rangeOn, setRangeOn] = useState(false);
  const [pageSpec, setPageSpec] = useState("");

  const pageSpecRef = useRef(pageSpec);
  useEffect(() => {
    pageSpecRef.current = pageSpec;
  }, [pageSpec]);

  // (open, documentId) 构成一个作用域。换作用域就清干净（含换文档但弹窗不关）。
  const scopeRef = useRef("");
  useEffect(() => {
    const key = `${open ? "o" : "c"}:${documentId || ""}`;
    if (scopeRef.current === key) return;
    scopeRef.current = key;
    // 同步清 ref：让下面的回填在同一次提交里读到"空"，否则会读到上一本的值而跳过。
    pageSpecRef.current = "";
    setRangeOn(false);
    setPageSpec("");
  }, [open, documentId]);

  // 初始仅当 pageSpec 为空时回填 `1-N`；故意不依赖 pageSpec，避免用户清空后被回填。
  useEffect(() => {
    if (open && pageCount && !pageSpecRef.current) {
      setPageSpec(pageCount > 1 ? `1-${pageCount}` : "1");
    }
  }, [open, pageCount, documentId]);

  const validateRange = useCallback((): PageRangeCheck => {
    if (!rangeOn) {
      const count = pageCount ?? 0;
      const pages = Array.from({ length: count }, (_, index) => index + 1);
      return { valid: true, pages, spec: count > 1 ? `1-${count}` : "1", all: true, error: "" };
    }
    const parsed = parsePageSelection(pageSpec, pageCount ?? 0);
    if (!parsed.ok) return { valid: false, pages: [], spec: "", all: false, error: parsed.error };
    return {
      valid: true,
      pages: parsed.pages,
      spec: parsed.spec,
      all: parsed.pages.length === (pageCount ?? -1),
      error: "",
    };
  }, [rangeOn, pageSpec, pageCount]);

  return {
    rangeOn,
    pageSpec,
    setRangeOn,
    setPageSpec,
    validateRange,
  };
}
