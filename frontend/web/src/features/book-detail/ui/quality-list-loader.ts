// 「质量」页签里各个明细列表：都从通用取数接口（GET /jobs/:id/data/:dataset）读，不再走 quality-items。
// 每条带阅读页的块编号（reader_item_id，四位），点一下打开阅读页跳到那一块。
import { fetchJobData } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import type { QualityListKind } from "../domain/quality-model.js";

export type QualityListItem = {
  key: string;
  /** 阅读页跳转用的块编号（四位）。 */
  readerItemId: string;
  page: number;
  title: string;
  /** 第二行：改前改后、尝试过什么等，可以没有。 */
  detail?: string;
};

export type QualityList = { total: number; items: QualityListItem[] };

export type LoadQualityList = (jobId: string, kind: QualityListKind) => Promise<QualityList>;

type Row = Record<string, unknown>;
type FetchJobData = typeof fetchJobData;

export const QUALITY_LIST_LIMIT = 50;
// 排版：缩到不到 75% 才算「缩得太小」（和质量摘要的阈值一致）。
const SMALL_SCALE = 0.75;

const LAYOUT_REASON = { overflow: "溢出", small: "字缩得太小" } as const;

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clip(value: unknown, max = 60): string {
  const s = text(value).replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function base(row: Row, index: number, prefix: string) {
  return {
    key: `${prefix}-${text(row.id || row.revision_id || row.reader_item_id || row.item_id) || index}-${index}`,
    readerItemId: text(row.reader_item_id || row.item_id),
    page: num(row.page),
  };
}

function rowsOf(view: { rows?: Row[] | null } | null | undefined): Row[] {
  return Array.isArray(view?.rows) ? view!.rows! : [];
}

export function createQualityListLoader(fetchData: FetchJobData = fetchJobData): LoadQualityList {
  const get = (jobId: string, dataset: string, query: Parameters<FetchJobData>[3]) =>
    fetchData(jobId, API_PREFIX, dataset, query);

  return async (jobId, kind) => {
    if (kind === "qa") {
      const view = await get(jobId, "qa_violations", { filters: { severity: ["critical", "major"] }, sort: "page", limit: QUALITY_LIST_LIMIT });
      return {
        total: view.total,
        items: rowsOf(view).map((row, i) => ({ ...base(row, i, "qa"), title: text(row.message) || text(row.type) })),
      };
    }
    if (kind === "revisions") {
      const view = await get(jobId, "revisions", { filters: { source: "refine" }, sort: "-ts", limit: QUALITY_LIST_LIMIT });
      return {
        total: view.total,
        items: rowsOf(view).map((row, i) => ({
          ...base(row, i, "rev"),
          title: text(row.reason) || "精修改写",
          detail: `原：${clip(row.previous_text)}\n改：${clip(row.new_text)}`,
        })),
      };
    }
    if (kind === "escalated") {
      const view = await get(jobId, "escalated", { sort: "page", limit: QUALITY_LIST_LIMIT });
      return {
        total: view.total,
        items: rowsOf(view).map((row, i) => {
          const categories = Array.isArray(row.categories) ? row.categories.map(text).filter(Boolean) : [];
          const attempts = Array.isArray(row.attempts) ? row.attempts.map(text).filter(Boolean) : [];
          return {
            ...base(row, i, "esc"),
            title: `${text(row.reason) || "留给你确认"}${categories.length ? `（${categories.join("、")}）` : ""}`,
            ...(attempts.length ? { detail: `试过：${attempts.join("；")}` } : {}),
          };
        }),
      };
    }
    if (kind === "untranslated") {
      const view = await get(jobId, "translation_items", { filters: { final_status: "failed" }, sort: "page", limit: QUALITY_LIST_LIMIT });
      return {
        total: view.total,
        items: rowsOf(view).map((row, i) => ({ ...base(row, i, "fail"), title: "翻译失败", detail: `原文：${clip(row.source_text)}` })),
      };
    }
    // layout：溢出的全拿；缩得太小的没有现成筛选字段，按缩放比例从小到大取一页再挑。
    const [overflowView, smallestView] = await Promise.all([
      get(jobId, "layout_blocks", { filters: { overflow: true }, sort: "page", limit: QUALITY_LIST_LIMIT }),
      get(jobId, "layout_blocks", { sort: "scale", limit: QUALITY_LIST_LIMIT }),
    ]);
    const overflow = rowsOf(overflowView).map((row, i) => ({
      ...base(row, i, "of"),
      title: LAYOUT_REASON.overflow,
      detail: `超出 ${num(row.overflow_pt).toFixed(1)}pt，字号 ${num(row.final_font_size)}pt`,
    }));
    const small = rowsOf(smallestView)
      .filter((row) => row.overflow !== true && num(row.scale) > 0 && num(row.scale) < SMALL_SCALE)
      .map((row, i) => ({
        ...base(row, i, "sm"),
        title: `${LAYOUT_REASON.small}（缩到 ${percent(num(row.scale))}）`,
        detail: `字号 ${num(row.final_font_size)}pt`,
      }));
    const items = [...overflow, ...small].sort((a, b) => a.page - b.page);
    return { total: overflowView.total + small.length, items };
  };
}
