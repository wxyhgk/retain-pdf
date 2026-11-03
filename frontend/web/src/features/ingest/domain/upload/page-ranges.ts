import { currentPageCap, type PageCap } from "./ports.js";
// 页码区间的纯计算：归一化、上下界约束、校验。
//
// 全部无副作用（不读写 store / DOM）。controller 只负责把这里的结果落到
// viewPort 与 upload state，因此这些函数可被单测直接覆盖。

export interface ConstrainPageRangeInput {
  start?: string | number;
  end?: string | number;
  maxPage?: number;
  source?: string;
}

export interface ConstrainedPageRanges {
  start: string;
  end: string;
  maxPage: number;
}

export interface PageRangeValidation {
  ok: boolean;
  message?: string;
}

/** 把 start/end 拼成展示用区间串：空为空，单侧取单侧，双侧相同不重复，否则 a-b。 */
export function normalizePageRangeValue(startValue = "", endValue = ""): string {
  const start = `${startValue}`.trim();
  const end = `${endValue}`.trim();
  if (!start && !end) {
    return "";
  }
  if (start && end) {
    return start === end ? start : `${start}-${end}`;
  }
  return start || end;
}

/** 非数字归一为空；数字向下取整且不小于 1。 */
export function normalizePageNumberInput(value: unknown): string | number {
  const text = `${value ?? ""}`.trim();
  if (!text) {
    return "";
  }
  const page = Number(text);
  if (!Number.isFinite(page)) {
    return "";
  }
  return Math.max(1, Math.trunc(page));
}

/** 上传态页数优先，否则退回前端配置上限。 */
export function resolvePageRangeLimit(
  uploadedPageCount: unknown,
  frontMaxPageCount: PageCap,
): number {
  return Number(uploadedPageCount || 0) || currentPageCap(frontMaxPageCount);
}

/** 归一 + 按 maxPage 夹取 + 保证 start<=end，返回写回 viewPort 的字符串值。 */
export function constrainPageRangeValues({
  start: rawStart = "",
  end: rawEnd = "",
  maxPage = 0,
  source = "",
}: ConstrainPageRangeInput = {}): ConstrainedPageRanges {
  let start = normalizePageNumberInput(rawStart);
  let end = normalizePageNumberInput(rawEnd);

  if (maxPage > 0) {
    if (start !== "") {
      start = Math.min(Number(start), maxPage);
    }
    if (end !== "") {
      end = Math.min(Number(end), maxPage);
    }
  }

  if (start !== "" && end !== "" && Number(start) > Number(end)) {
    if (source === "end") {
      end = start;
    } else {
      start = end;
    }
  }

  return {
    start: start === "" ? "" : `${start}`,
    end: end === "" ? "" : `${end}`,
    maxPage,
  };
}

/** 校验页码输入；false 时返回应写入 error-box 的文案。 */
export function validatePageRangeValues({
  start: rawStart = "",
  end: rawEnd = "",
  maxPage = 0,
}: { start?: string; end?: string; maxPage?: number } = {}): PageRangeValidation {
  const start = `${rawStart ?? ""}`.trim();
  const end = `${rawEnd ?? ""}`.trim();
  // 非数字输入归一为空，与 constrain 共用同一规则直接报错，避免 Number("abc") 比较一路绿灯。
  if (
    (start && normalizePageNumberInput(start) === "") ||
    (end && normalizePageNumberInput(end) === "")
  ) {
    return { ok: false, message: "页码必须为数字" };
  }
  if ((start && Number(start) < 1) || (end && Number(end) < 1)) {
    return { ok: false, message: "页码必须从 1 开始" };
  }
  if ((start && maxPage && Number(start) > maxPage) || (end && maxPage && Number(end) > maxPage)) {
    return { ok: false, message: `页码不能超过 ${maxPage}` };
  }
  if (start && end && Number(start) > Number(end)) {
    return { ok: false, message: "起始页不能大于结束页" };
  }
  if (maxPage && start && end && Number(end) - Number(start) + 1 > maxPage) {
    return { ok: false, message: `页码区间不能超过 ${maxPage} 页` };
  }
  return { ok: true };
}
