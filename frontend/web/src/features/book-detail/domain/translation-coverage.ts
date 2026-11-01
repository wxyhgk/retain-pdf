// 书籍详情里读「翻译覆盖」接口的展示逻辑：「历史」页签的任务记录，「进度」页用到的模型、OCR 复用等摘要。
// 纯函数，不碰网络和 DOM。（「进度」页以前还有一条每页一格的覆盖条，2026-11-01 用户说去掉。）
//
// 数据来自 GET /documents/:id/translation-coverage —— 和阅读入口同一套合并规则（每页取最近
// 翻译了它的任务），所以这里说「第 7 页来自某次翻译」，阅读器打开时第 7 页就是那次翻译。

import type {
  TranslationCoverageJob,
  TranslationCoverageView,
} from "@/platform/api/index.js";
import { compactPageSpec } from "@/features/library/domain.js";

/** 任务记录色块的深浅档位数：不同次翻译用墨色深浅区分（单色设计，不引入新颜色）。 */
export const COVERAGE_SHADES = 4;

export type JobRow = {
  jobId: string;
  kind: string;
  pagesText: string;
  meta: string;
  statusLabel: string;
  statusTone: "done" | "active" | "failed" | "idle";
  suppliedText: string;
  shade: number;
  /** 成功但没翻全：「16 个内容块未能翻译」（只数该翻没翻出来的块，公式等按设计不翻的不算）。 */
  warningText: string;
  /** 失败原因一句话。 */
  failureText: string;
  /** 原始错误第一行，展开看。和 failureText 一样时不重复给。 */
  errorDetail: string;
};

const KIND_LABEL: Record<string, string> = { ocr: "OCR", book: "翻译", translate: "翻译", render: "重新排版" };
const STATUS: Record<string, [string, JobRow["statusTone"]]> = {
  succeeded: ["完成", "done"],
  running: ["进行中", "active"],
  queued: ["排队中", "active"],
  failed: ["失败", "failed"],
  canceled: ["已取消", "idle"],
};

/** 给参与合并的任务分墨色档位：最近的一次最深，往前依次变浅（超过档位数就循环）。 */
export function shadeByJob(view: TranslationCoverageView): Map<string, number> {
  const contributing = view.jobs.filter((job) => job.supplied_pages > 0);
  const shades = new Map<string, number>();
  contributing.forEach((job, index) => shades.set(job.job_id, (index % COVERAGE_SHADES) + 1));
  return shades;
}

/** `2026-10-06T02:32:50Z` → 本地时间的 `10月5日 19:32`（同一年不写年份）。
 *  以前直接截字符串里的数字，丢了末尾的 Z，显示的是 UTC —— 和书卡上的本地日期差一天。 */
export function formatTime(iso: string | null | undefined, now: Date = new Date()): string {
  const text = `${iso || ""}`.trim();
  const ms = Date.parse(text);
  if (!text || !Number.isFinite(ms)) return text;
  const date = new Date(ms);
  const pad = (value: number) => `${value}`.padStart(2, "0");
  const label = `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.getFullYear() === now.getFullYear() ? label : `${date.getFullYear()}年${label}`;
}

/** 用时：「42 秒」「3 分 5 秒」「1 小时 2 分」。时间认不出返回空串。 */
export function formatDuration(startIso: string | null | undefined, endIso: string | null | undefined): string {
  const start = Date.parse(`${startIso || ""}`);
  const end = Date.parse(`${endIso || ""}`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "";
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 ? `${minutes} 分 ${seconds % 60} 秒` : `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} 小时 ${minutes % 60} 分` : `${hours} 小时`;
}

function pagesText(job: TranslationCoverageJob, pageCount: number): string {
  if (!job.pages.length) return "";
  if (pageCount && job.pages.length >= pageCount) return `全部 ${pageCount} 页`;
  return `第 ${compactPageSpec(job.pages).replace(/,/g, "、")} 页`;
}

export function jobRows(view: TranslationCoverageView | null | undefined, now: Date = new Date()): JobRow[] {
  if (!view) return [];
  const shades = shadeByJob(view);
  return view.jobs.map((job) => {
    const [statusLabel, statusTone] = STATUS[job.status] || [job.status || "未知", "idle"];
    const duration = job.status === "succeeded" ? formatDuration(job.created_at, job.finished_at) : "";
    const meta = [
      formatTime(job.created_at, now),
      duration ? `用时 ${duration}` : "",
      job.model,
      job.ocr_reused ? "复用 OCR" : "",
    ].filter(Boolean).join(" · ");
    const isTranslation = job.workflow !== "ocr";
    let suppliedText = "";
    if (isTranslation && job.status === "succeeded") {
      suppliedText = job.supplied_pages > 0
        ? (job.supplied_pages < job.pages.length ? `采用 ${job.supplied_pages} 页（其余被之后的翻译替换）` : `采用 ${job.supplied_pages} 页`)
        : "已被之后的翻译替换";
    }
    return {
      jobId: job.job_id,
      kind: KIND_LABEL[job.workflow] || job.workflow || "任务",
      pagesText: pagesText(job, view.page_count),
      meta,
      statusLabel,
      statusTone,
      suppliedText,
      shade: shades.get(job.job_id) || 0,
      warningText: keptOriginText(job),
      failureText: `${job.failure_summary || ""}`.trim(),
      errorDetail: errorDetailOf(job),
    };
  });
}

function keptOriginText(job: TranslationCoverageJob): string {
  const kept = Number(job.kept_origin_blocks || 0);
  return job.status === "succeeded" && kept > 0 ? `${kept} 个内容块未能翻译` : "";
}

function errorDetailOf(job: TranslationCoverageJob): string {
  const detail = `${job.error_head || ""}`.trim();
  return detail && detail !== `${job.failure_summary || ""}`.trim() ? detail : "";
}

/** 摘要里的「翻译」只认真正翻译的任务。重新渲染（render）任务也带 model、也复用 OCR，
 *  算进来的话顶部写的是渲染的用时，OCR 站也会误写成「复用已有 OCR」。 */
const isTranslationJob = (job: TranslationCoverageJob) =>
  job.workflow === "book" || job.workflow === "translate";

/** 最近一次成功的翻译 / OCR（jobs 已是新到旧）。 */
function latestSucceeded(view: TranslationCoverageView, matches: (job: TranslationCoverageJob) => boolean) {
  return view.jobs.find((job) => job.status === "succeeded" && matches(job)) || null;
}

/** 模型名；翻译 agent 跑的在前面写明（老后端没有 engine 字段，按现有流程算）。 */
function modelText(job: TranslationCoverageJob): string {
  return job.engine === "agent" ? ["翻译 agent", job.model].filter(Boolean).join(" · ") : job.model;
}

/** 这个任务有没有编辑部画面可看：翻译 agent 跑的（开翻前事件还没有，也要准备好轮询），或者已经有事件。 */
export function hasEditorialRoom(view: TranslationCoverageView | null | undefined, jobId: string): boolean {
  const job = jobId ? view?.jobs.find((item) => item.job_id === jobId) : undefined;
  return Boolean(job && (job.engine === "agent" || job.has_editorial_events));
}

export type ProcessingFacts = {
  /** 摘要那一行的几项：「已翻译 12 / 12 页」「由 2 次翻译拼成」「最近 9月21日 09:25」「用时 4 分 57 秒」「deepseek-v4-flash」。 */
  facts: string[];
  /** 当前合并结果里还保留原文的内容块数（只算仍在提供页面的翻译）。 */
  keptOriginBlocks: number;
  /** 流水线各站一句说明。没有可靠数据的站不给。 */
  stageMeta: { ocr?: string; translate?: string };
};

/**
 * 「进度」页顶部摘要和流水线各站说明。只读覆盖接口给的真实数据，算不出来的项就不出现 ——
 * 不编数字。
 */
export function processingFacts(view: TranslationCoverageView | null | undefined, now: Date = new Date()): ProcessingFacts {
  const empty: ProcessingFacts = { facts: [], keptOriginBlocks: 0, stageMeta: {} };
  if (!view) return empty;
  // 只算当前合并结果里仍取自该任务的那些页上的块（后端按页算好了）；旧后端没有这个
  // 字段时退回整个任务的数。
  const keptOriginBlocks = view.jobs
    .filter((job) => job.supplied_pages > 0)
    .reduce((sum, job) => sum + Number(job.kept_origin_blocks_supplied ?? job.kept_origin_blocks ?? 0), 0);
  const translation = latestSucceeded(view, isTranslationJob);
  const ocr = latestSucceeded(view, (job) => job.workflow === "ocr");
  const facts: string[] = [];
  if (view.page_count) {
    facts.push(view.translated_pages >= view.page_count
      ? `已翻译全部 ${view.page_count} 页`
      : `已翻译 ${view.translated_pages} / ${view.page_count} 页`);
  }
  // 保留原文的块数不放在这一行：下面的提醒条和翻译站已经各说了一次。
  if (view.contributing_jobs > 1) facts.push(`由 ${view.contributing_jobs} 次翻译拼成`);
  if (translation) {
    facts.push(`最近 ${formatTime(translation.created_at, now)}`);
    const duration = formatDuration(translation.created_at, translation.finished_at);
    if (duration) facts.push(`用时 ${duration}`);
    const model = modelText(translation);
    if (model) facts.push(model);
  }

  const stageMeta: ProcessingFacts["stageMeta"] = {};
  if (translation?.ocr_reused) {
    stageMeta.ocr = "复用已有 OCR";
  } else if (ocr) {
    const duration = formatDuration(ocr.created_at, ocr.finished_at);
    stageMeta.ocr = [pagesText(ocr, view.page_count), duration ? `用时 ${duration}` : ""].filter(Boolean).join(" · ");
  }
  // 翻译站不写用时：整本任务（workflow=book）的起止时间包含 OCR 和渲染，算成翻译用时会虚高。
  // 总用时放在顶部摘要里，写明是整次任务的。
  if (translation) {
    stageMeta.translate = [pagesText(translation, view.page_count), modelText(translation)].filter(Boolean).join(" · ");
  }
  return { facts, keptOriginBlocks, stageMeta };
}
