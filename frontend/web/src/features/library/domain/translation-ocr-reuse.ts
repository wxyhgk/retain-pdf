import type {
  DocumentJobSummary,
  TranslateDocumentPayload,
} from "./types.js";

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

function workflowOf(job?: DocumentJobSummary | null): string {
  return text(job?.workflow || job?.job_type).toLowerCase();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function translationOcrStatus(job: DocumentJobSummary): string {
  const workflow = workflowOf(job);
  if (!["book", "translate", "translation", "render"].includes(workflow)) return "";

  const stageState = text(record(record(job.stages).ocr).state).toLowerCase();
  if (stageState === "completed" || stageState === "reused") return "succeeded";
  if (stageState === "in_progress") return "running";
  if (stageState === "queued") return "queued";
  if (stageState === "failed") return "failed";

  const status = text(job.status).toLowerCase();
  if (status === "succeeded" || job.ocr_reused === true) return "succeeded";
  // translate/render 工作流只能在已有 OCR/译文产物上启动。
  if (workflow === "translate" || workflow === "translation" || workflow === "render") {
    return "succeeded";
  }
  const activeStage = text(job.display_stage || job.stage).toLowerCase();
  if (["translation", "translate", "translating", "render", "rendering", "done", "finished"].includes(activeStage)) {
    return "succeeded";
  }
  return "";
}

function timestampOf(job: DocumentJobSummary): number {
  const value = Date.parse(text(job.updated_at || job.created_at));
  return Number.isFinite(value) ? value : 0;
}

/**
 * 复用候选的优先级：0 = 独立 OCR 任务，1 = OCR 阶段已成功的 book/translate/render 任务。
 * 返回 -1 表示该任务不能作为复用候选。
 */
function reuseRank(job: DocumentJobSummary): number {
  const jobId = text(job?.job_id || job?.id);
  // 后端明确的不可复用信号，任何工作流都不放宽。
  if (!jobId || jobId.startsWith("doc:")) return -1;
  if (job?.ocr_reusable === false || job?.translation_source_ready === false) return -1;

  if (workflowOf(job) === "ocr") {
    return text(job?.status).toLowerCase() === "succeeded" ? 0 : -1;
  }
  // 后端 ocr_artifact_reuse 支持从整本/翻译/渲染任务复用其自身 OCR 产物，
  // 即使任务整体失败；判定沿用文档 OCR 状态那一套。
  return translationOcrStatus(job) === "succeeded" ? 1 : -1;
}

/**
 * Pick the newest job whose OCR artifact can seed a translation.
 *
 * Standalone succeeded OCR jobs win over jobs that merely cleared their OCR
 * stage; within one tier the newest wins.
 *
 * This is deliberately only a candidate: artifact completeness, provider
 * compatibility, document ownership and page coverage remain backend-owned
 * validations. Explicit backend `ocr_reusable: false` is respected so the
 * frontend never knowingly offers an incompatible artifact.
 */
export function selectReusableOcrJob(
  jobs: DocumentJobSummary[] = [],
): DocumentJobSummary | null {
  return jobs
    .map((job, index) => ({ job, index, rank: reuseRank(job) }))
    .filter((entry) => entry.rank >= 0)
    .map((entry) => ({ ...entry, timestamp: timestampOf(entry.job) }))
    .sort((left, right) => left.rank - right.rank
      || right.timestamp - left.timestamp
      || left.index - right.index)[0]?.job || null;
}

/**
 * Processing 页面展示的是“当前文档是否已有 OCR 能力”，不局限于 OCR-only job。
 * 整本翻译成功、翻译复用 OCR，或流水线已经越过 OCR 阶段，都能作为完成证据。
 *
 * 翻译任务有自己的 OCR 子任务（`{翻译任务}-ocr`）时用子任务本身，不从翻译任务推：列表按更新时间排，
 * 翻译任务通常排在子任务前面。OCR 和翻译并行时（GLM-OCR）翻译任务一开始就进 translating，从它推出来是
 * 「OCR 已完成」，OCR 站其实还在跑；跑完以后推出来的也没有子任务自己的计时。
 */
export function selectDocumentOcrStatusJob(
  jobs: DocumentJobSummary[] = [],
): DocumentJobSummary | null {
  const byId = new Map(jobs.map((job) => [text(job.job_id || job.id), job]));
  for (const job of jobs) {
    if (workflowOf(job) === "ocr") return job;
    const child = byId.get(`${text(job.job_id || job.id)}-ocr`);
    if (child && workflowOf(child) === "ocr") return child;
    const status = translationOcrStatus(job);
    if (!status) continue;
    return {
      ...job,
      workflow: "ocr",
      job_type: "ocr",
      status,
      ocr_status_derived: true,
      ocr_status_source_workflow: workflowOf(job),
    };
  }
  return null;
}

export function reusableOcrJobId(job?: DocumentJobSummary | null): string {
  return text(job?.job_id || job?.id);
}

/** 扁平而不是判别联合：tsconfig 是 `strict: false`，布尔字面量判别在这个配置下
 *  不收窄（`if (!r.ok) r.error` 会报「属性不存在」）。所以字段总是存在。 */
export type PageSelection = { ok: boolean; pages: number[]; spec: string; error: string };

const fail = (error: string): PageSelection => ({ ok: false, pages: [], spec: "", error });

/** 解析混合页码，比如 `1-5, 8, 12-14`（打印对话框那种写法）。
 *
 * 返回**去重、升序、1 起**的文档页号，外加一份规范化后的字符串（`1-5,8,12-14`）——
 * 后者可以原样交给 `ocr.page_ranges`，MinerU 和 Rust 的 `parse_page_ranges` 都认这个格式。
 *
 * 容忍的写法：中英文逗号、顿号、空格分隔；`~` `—` `–` 当作连字符。这些都是从输入法里
 * 很容易敲出来的，拒掉它们只会让人困惑「我明明写对了」。
 *
 * 拒绝的写法都给出能照着改的提示，而不是一句「格式错误」：
 * 倒序区间（`5-3`）、0 或超出总页数、空串、非数字。
 */
export function parsePageSelection(raw: string, pageCount: number): PageSelection {
  const text = `${raw ?? ""}`
    .replace(/[，、；;]/g, ",")
    .replace(/[~～—–]/g, "-")
    .trim();
  if (!text) return fail("请填写要翻译的页码，比如 1-5, 8, 12-14");
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return fail("还不知道这本书有几页，稍后再试");
  }
  const pages = new Set<number>();
  for (const rawPart of text.split(/[,\s]+/)) {
    const part = rawPart.trim();
    if (!part) continue;
    const range = /^(\d+)-(\d+)$/.exec(part);
    const single = /^(\d+)$/.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end) {
        return fail(`「${part}」起止颠倒了，应写成 ${end}-${start}`);
      }
      if (start < 1 || end > pageCount) {
        return fail(`「${part}」超出范围，这本书共 ${pageCount} 页`);
      }
      for (let page = start; page <= end; page += 1) pages.add(page);
    } else if (single) {
      const page = Number(single[1]);
      if (page < 1 || page > pageCount) {
        return fail(`第 ${page} 页不存在，这本书共 ${pageCount} 页`);
      }
      pages.add(page);
    } else {
      return fail(`看不懂「${part}」—— 页码写成 3 或 3-7，用逗号分开`);
    }
  }
  const sorted = [...pages].sort((a, b) => a - b);
  if (sorted.length === 0) return fail("请填写要翻译的页码，比如 1-5, 8, 12-14");
  return { ok: true, pages: sorted, spec: compactPageSpec(sorted), error: "" };
}

/** `[1,2,3,4,5,8,12,13,14]` → `"1-5,8,12-14"`。 */
export function compactPageSpec(pages: number[]): string {
  const out: string[] = [];
  let index = 0;
  while (index < pages.length) {
    const start = pages[index];
    let end = start;
    while (index + 1 < pages.length && pages[index + 1] === end + 1) {
      index += 1;
      end = pages[index];
    }
    out.push(start === end ? `${start}` : `${start}-${end}`);
    index += 1;
  }
  return out.join(",");
}

export function inclusivePageNumbers(startPage: number, endPage: number): number[] {
  if (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1 || endPage < startPage) {
    return [];
  }
  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
}

/** A translate workflow starts from an existing OCR artifact by definition. */
export function translationUsesReusedOcr(item?: Record<string, unknown> | null): boolean {
  if (!item) return false;
  if (item.ocr_reused === true) return true;
  const stages = item.stages && typeof item.stages === "object"
    ? item.stages as Record<string, unknown>
    : {};
  const ocr = stages.ocr && typeof stages.ocr === "object"
    ? stages.ocr as Record<string, unknown>
    : {};
  if (text(ocr.state).toLowerCase() === "reused") return true;
  return text(item.workflow || item.job_type).toLowerCase() === "translate";
}

/**
 * Merge credentials/config with per-launch overrides without leaking the OCR
 * config into an artifact-backed translation request.
 */
export function mergeTranslatePayload(
  base: TranslateDocumentPayload = {},
  overrides: TranslateDocumentPayload = {},
): TranslateDocumentPayload {
  const artifactJobId = text(overrides.source?.artifact_job_id);
  const reusingOcr = text(overrides.workflow).toLowerCase() === "translate" && Boolean(artifactJobId);
  const merged: TranslateDocumentPayload = {
    ...base,
    ...overrides,
  };

  if (base.translation || overrides.translation) {
    merged.translation = { ...(base.translation || {}), ...(overrides.translation || {}) };
  }

  if (reusingOcr) {
    delete merged.ocr;
    merged.workflow = "translate";
    merged.source = {
      ...(base.source || {}),
      ...(overrides.source || {}),
      artifact_job_id: artifactJobId,
    };
  } else if (base.ocr || overrides.ocr) {
    merged.ocr = { ...(base.ocr || {}), ...(overrides.ocr || {}) };
  }

  return merged;
}
