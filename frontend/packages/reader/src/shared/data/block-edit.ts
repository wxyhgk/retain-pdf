// 阅读页「改译文」的纯逻辑：阅读页块号对到译文条目号、取可编辑的文字、修订历史、哪些改动还没排进 PDF。
// 接口：GET / PATCH /jobs/:id/translations/:item_id，data/revisions（契约 translation-revisions.v1、job-data.v1）。

import { readerRegionKindForRegion, type ReaderRegion } from "./reader-regions.js";

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 拼出来的书（多次翻译按页合成的虚拟任务 merged-…）是只读的，改要改到源任务上，这一版不支持。 */
export function isMergedReadingJob(jobId: string): boolean {
  return `${jobId || ""}`.trim().startsWith("merged-");
}

/**
 * 阅读页的块号是四位（p012-b0005），译文条目里存的可能是四位、三位（p012-b005）或不补零。
 * 依次试这几种写法；后端以后按同一规则认任何写法时，第一种就中。
 */
export function translationItemIdCandidates(readerItemId: string): string[] {
  const id = `${readerItemId || ""}`.trim();
  const match = /^(.*-b)(\d+)$/.exec(id);
  if (!match) return id ? [id] : [];
  const number = Number(match[2]);
  const forms = [id, `${match[1]}${`${number}`.padStart(3, "0")}`, `${match[1]}${number}`];
  return [...new Set(forms)];
}

/** 块号里的页码（p012-b0005 → 12）；认不出是 0。 */
export function pageOfReaderItem(readerItemId: string): number {
  const match = /^p(\d+)-/.exec(`${readerItemId || ""}`.trim());
  return match ? Number(match[1]) : 0;
}

/**
 * 编辑框里放什么：PATCH 要的是和条目 protected_translated_text 同一种写法（公式写成 $…$），
 * 所以优先拿它；老条目没有就用 translated_text。
 */
export function editableTranslation(item: Row | null | undefined): { source: string; translated: string } {
  return {
    source: text(item?.source_text) || text(item?.unit_source_text),
    translated: text(item?.protected_translated_text) || text(item?.translated_text),
  };
}

export const REVISION_SOURCE_LABELS: Record<string, string> = {
  user: "手改",
  agent: "助手改",
  refine: "精修",
};

export type RevisionEntry = {
  /** 这一版的文字。 */
  text: string;
  /** 「初译」或「手改」「精修」…… */
  label: string;
  /** 写回时间（ISO），初译没有。 */
  ts: string;
  reason: string;
};

function rowsOf(payload: unknown): Row[] {
  const root = (payload && typeof payload === "object" ? payload : {}) as Row;
  const data = (root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : root) as Row;
  const rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data.revisions) ? data.revisions : [];
  return rows.filter((row): row is Row => Boolean(row) && typeof row === "object");
}

/**
 * 一块的修订历史，新的在前：每次写回的新文字，最后是第一次写回之前的那份（「初译」）。
 * 没有修订记录时是空的（当前译文就是初译，不用列）。
 */
export function revisionHistory(payload: unknown): RevisionEntry[] {
  const rows = rowsOf(payload).sort((a, b) => text(a.ts).localeCompare(text(b.ts)));
  if (!rows.length) return [];
  const entries: RevisionEntry[] = [
    { text: text(rows[0].previous_text), label: "初译", ts: "", reason: "" },
    ...rows.map((row) => ({
      text: text(row.new_text),
      label: REVISION_SOURCE_LABELS[text(row.source)] || text(row.source) || "修订",
      ts: text(row.ts),
      reason: text(row.reason),
    })),
  ];
  return entries.reverse();
}

/** 修订时间：11月19日 14:02（本地时间）；认不出原样给。 */
export function revisionTime(ts: string): string {
  const parsed = new Date(ts);
  if (!ts || Number.isNaN(parsed.getTime())) return ts || "";
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日 ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/** 这份译文 PDF 是什么时候排好的：任务最后一次跑完的时间。 */
export function jobRenderedAt(jobPayload: unknown): string {
  const job = (jobPayload && typeof jobPayload === "object" ? jobPayload : {}) as Row;
  const data = (job.data && typeof job.data === "object" ? job.data : job) as Row;
  const timestamps = (data.timestamps && typeof data.timestamps === "object" ? data.timestamps : {}) as Row;
  return text(timestamps.finished_at) || text(data.finished_at) || "";
}

/**
 * 还没排进 PDF 的改动：PDF 排好以后才写回的修订，每块取最后一次的文字（阅读页块号 → 文字）。
 * 关掉阅读页再打开也能接上「改了几处、还没排版」，PDF 上照样先盖着新译文。
 */
export function pendingEditsFromRevisions(payload: unknown, renderedAt: string): Map<string, string> {
  const pending = new Map<string, string>();
  const rendered = new Date(renderedAt).getTime();
  if (!renderedAt || Number.isNaN(rendered)) return pending;
  const rows = rowsOf(payload).sort((a, b) => text(a.ts).localeCompare(text(b.ts)));
  for (const row of rows) {
    const at = new Date(text(row.ts)).getTime();
    const id = text(row.reader_item_id) || text(row.item_id);
    if (!id || Number.isNaN(at) || at <= rendered) continue;
    pending.set(id, text(row.new_text));
  }
  return pending;
}

const REVISION_ISSUE_LABELS: Record<string, string> = {
  empty_translation: "译文是空的",
  math_delimiter_unbalanced: "公式的 $ 或括号不成对",
  unexpected_placeholder: "多出了原文里没有的占位符",
  placeholder_inventory_mismatch: "占位符（公式、引用）和原文对不上，可能删掉或改坏了",
  english_residue: "还留着没翻的英文",
  mixed_english_residue: "中英文混在一起",
  protocol_shell_output: "混进了模型输出的格式标记",
  truncated_translation: "译文像是被截断了",
  context_bleed: "混进了别的段落的内容",
  formula_commands_dropped: "公式里的命令丢了",
  glossary_term_missing: "没用术语表规定的译法",
};

/** 保存没通过检查时的一条问题，说成人话；警告不拦保存，不列。 */
export function revisionIssueTexts(issues: unknown): string[] {
  if (!Array.isArray(issues)) return [];
  return issues
    .filter((issue) => issue && typeof issue === "object" && (issue as Row).severity !== "warning")
    .map((issue) => {
      const row = issue as Row;
      const label = REVISION_ISSUE_LABELS[text(row.kind)] || text(row.kind) || "问题";
      const message = text(row.message).trim();
      return message && message !== label ? `${label}（${message}）` : label;
    });
}

const EDITABLE_KINDS = new Set(["text", "formula", "table"]);

/** 能改的块（正文、公式、表格）按阅读顺序排好，给「上一段 / 下一段」用。 */
export function editableBlockIds(regions: readonly ReaderRegion[] | null | undefined): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const region of regions || []) {
    const id = `${region?.itemId || ""}`.trim();
    if (!id || seen.has(id) || !EDITABLE_KINDS.has(readerRegionKindForRegion(region))) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** 编辑框够不够大：块够宽够高就直接盖在块上改，否则在旁边弹一个放大的框。 */
export const INLINE_EDIT_MIN_WIDTH = 300;
export const INLINE_EDIT_MIN_HEIGHT = 72;

export type InlineEditLayout =
  | { mode: "inline"; left: number; top: number; width: number; minHeight: number }
  | { mode: "popout"; left: number; width: number; top?: number; bottom?: number };

/**
 * 编辑框放哪（页内坐标）：大块盖在原位，往下按内容长；小块（标题、单行、行间公式）在下面弹一个至少 360 宽的框，
 * 下面放不下（离页底不到 260）就放上面。左右夹在页里。
 */
export function inlineEditLayout(
  rect: { left: number; top: number; width: number; height: number },
  page: { width: number; height: number },
): InlineEditLayout {
  if (rect.width >= INLINE_EDIT_MIN_WIDTH && rect.height >= INLINE_EDIT_MIN_HEIGHT) {
    return { mode: "inline", left: rect.left, top: rect.top, width: rect.width, minHeight: rect.height };
  }
  const width = Math.max(240, Math.min(Math.max(rect.width, 360), page.width - 16));
  const left = Math.max(8, Math.min(rect.left, page.width - width - 8));
  const gap = 6;
  const below = rect.top + rect.height + gap;
  return page.height - below >= 260
    ? { mode: "popout", left, width, top: below }
    : { mode: "popout", left, width, bottom: page.height - rect.top + gap };
}
