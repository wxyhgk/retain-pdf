/**
 * 阅读页底栏「待处理」：这次任务里要人看一眼的段落。都从通用取数接口（GET /jobs/:id/data/:dataset）读，
 * 每条带阅读页块编号（reader_item_id，四位），点一下跳过去：
 *   failed   没翻成、先显示原文的段落（translation_items 里 final_status = failed）
 *   content  质检挑出的内容问题（qa_violations 里 critical / major，排版那类除外）
 *   layout   版面放不下（qa_violations 的 layout_fit，只要 critical；major 多是溢出两三磅，看不出来，不列）
 * 一样的段落、一样的类只列一次。读不到（旧任务没有这些数据、合并出来的虚拟任务）就当没有。
 */
import type { ReaderIssue, ReaderIssueKind } from "@retainpdf/reader/contracts";
import { fetchJobData } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";

type Row = Record<string, unknown>;

const CHECK_LABELS: Record<string, string> = {
  numbers: "数字对不上",
  terms: "术语没照用",
  references: "引用编号对不上",
  annotations: "注释标记丢了",
  punctuation: "标点问题",
  formula: "公式变了",
  untranslated: "有没翻的地方",
  foreign_script: "冒出原文没有的外文",
};

const text = (value: unknown) => `${value ?? ""}`.trim();
const clip = (value: unknown, max = 70) => {
  const s = text(value).replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max)}…` : s;
};
const rowsOf = (view: unknown): Row[] => {
  const rows = (view as { rows?: unknown })?.rows;
  return Array.isArray(rows) ? (rows as Row[]) : [];
};

export function readerIssuesFromRows(failedRows: readonly Row[], qaRows: readonly Row[]): ReaderIssue[] {
  const seen = new Set<string>();
  const issues: ReaderIssue[] = [];
  const add = (row: Row, kind: ReaderIssueKind, title: string, detail: string) => {
    const readerItemId = text(row.reader_item_id);
    const page = Number(row.page) || 0;
    if (!readerItemId || seen.has(`${kind}:${readerItemId}`)) return;
    seen.add(`${kind}:${readerItemId}`);
    issues.push({ readerItemId, page, kind, title, detail });
  };
  for (const row of failedRows) add(row, "failed", "没翻成，先显示原文", clip(row.source_text));
  for (const row of qaRows) {
    const check = text(row.check);
    if (check === "layout_fit") {
      if (text(row.severity) === "critical") add(row, "layout", "版面放不下", clip(row.message));
      continue;
    }
    add(row, "content", CHECK_LABELS[check] || clip(row.message, 24) || "质检问题", clip(row.message));
  }
  return issues.sort((a, b) => a.page - b.page || a.readerItemId.localeCompare(b.readerItemId));
}

export async function loadReaderIssues(jobId: string): Promise<ReaderIssue[]> {
  const [failed, qa] = await Promise.all([
    fetchJobData(jobId, API_PREFIX, "translation_items", { filters: { final_status: "failed" }, sort: "page", limit: 200 }).catch(() => null),
    fetchJobData(jobId, API_PREFIX, "qa_violations", { filters: { severity: ["critical", "major"] }, sort: "page", limit: 500 }).catch(() => null),
  ]);
  return readerIssuesFromRows(rowsOf(failed), rowsOf(qa));
}
