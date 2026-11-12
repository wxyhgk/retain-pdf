// translation-debug — pure
// translation-debug — 翻译报告（job-reports.v1）和译文条目（translation-revisions.v1），请求走生成的函数。
import * as reports from "./generated/job-reports.js";
import * as translations from "./generated/translation-revisions.js";
import { failWith, orOnStatus } from "./request.js";

// 任务在、但翻译报告或翻译清单还没产出时，后端回 404 + error.details.reason=not_ready；
// 不带 reason 的 404 才是任务（或条目）不存在。
function isNotReady(payload: any): boolean {
  return payload?.error?.details?.reason === "not_ready";
}

const TRANSLATION_NOT_READY_MESSAGE = "这个任务的翻译结果还没生成，翻译跑完后再看。";

/** 404 分「还没产出」和「找不到」两种说法，别的状态码用 otherwise。 */
function translationError(notFound: string, otherwise: (status: number, payload: any) => string) {
  return (status: number, payload: any) => {
    if (status === 404) return new Error(isNotReady(payload) ? TRANSLATION_NOT_READY_MESSAGE : notFound);
    return new Error(otherwise(status, payload));
  };
}

function trimmedOrUndefined(value: unknown): string | undefined {
  return `${value ?? ""}`.trim() || undefined;
}

export async function fetchTranslationDiagnostics(jobId: string, apiPrefix?: string): Promise<any> {
  return reports.getTranslationReport(apiPrefix, { job_id: jobId }, {
    onError: translationError("未找到翻译调试信息，请确认该任务已完成翻译。", (status) => `读取翻译调试摘要失败，请稍后重试。(${status})`),
  });
}

export async function fetchTranslationItems(
  jobId: string,
  apiPrefix: string | undefined,
  { limit = 20, offset = 0, page = "", finalStatus = "", errorType = "", route = "", q = "" }: { limit?: number; offset?: number; page?: string; finalStatus?: string; errorType?: string; route?: string; q?: string } = {},
): Promise<any> {
  const pageText = trimmedOrUndefined(page);
  const query = {
    limit,
    offset,
    // 界面传的是输入框里的字符串；不是数字时照样发出去（NaN），后端回 400，和以前一样。
    page: pageText === undefined ? undefined : Number(pageText),
    final_status: trimmedOrUndefined(finalStatus),
    error_type: trimmedOrUndefined(errorType),
    route: trimmedOrUndefined(route),
    q: trimmedOrUndefined(q),
  };
  // 清单还没产出时是 200 空列表；404 只表示任务不存在，这里也当作空。
  return orOnStatus(
    translations.listTranslationItems(apiPrefix, { job_id: jobId, query }, { onError: failWith("读取翻译调试列表失败，请稍后重试。") }),
    404,
    { items: [], total: 0, limit, offset },
  );
}

export async function fetchTranslationItem(jobId: string, itemId: string, apiPrefix?: string): Promise<any> {
  return translations.getTranslationItem(apiPrefix, { job_id: jobId, item_id: itemId }, {
    onError: translationError("未找到该翻译 item，请确认 item_id 是否正确。", (status) => `读取翻译 item 详情失败，请稍后重试。(${status})`),
  });
}

export async function replayTranslationItem(jobId: string, itemId: string, apiPrefix?: string): Promise<any> {
  // 不带请求体。
  return translations.replayTranslationItem(apiPrefix, { job_id: jobId, item_id: itemId }, {
    onError: translationError("未找到该翻译 item，无法重放。", (status, payload) => (payload
      ? `重放翻译 item 失败: ${payload.message || JSON.stringify(payload)}`
      : `重放翻译 item 失败: ${status}`)),
  });
}

/** 改单条译文时后端的拒绝原因（error.details.reason）。 */
export type TranslationRevisionIssueView = { item_id?: string; kind?: string; severity?: string; message?: string };

const REVISION_REASON_MESSAGES: Record<string, string> = {
  validation_failed: "新译文没通过检查，没有保存。",
  job_running: "这本书正在处理（翻译或排版），等它跑完再改。",
  generation_mismatch: "这段译文刚被别处改过（精修或另一个窗口），重新打开再改。",
  checkpoint_locked: "译文文件正被占用（任务刚启动？），稍等再试。",
  read_only_job: "合并出来的阅读结果是只读的，要改得到原来那本书里改。",
};

/**
 * 改单条译文（PATCH /jobs/:id/translations/:item_id）。失败时抛的 Error 带 status、reason（后端的 details.reason）
 * 和 issues（校验没过时的每一条问题），界面按它们说人话。
 */
export async function reviseTranslationItem(
  jobId: string,
  itemId: string,
  body: Parameters<typeof translations.updateTranslationItem>[1]["body"],
  apiPrefix?: string,
): Promise<Awaited<ReturnType<typeof translations.updateTranslationItem>>> {
  return translations.updateTranslationItem(apiPrefix, { job_id: jobId, item_id: itemId, body }, {
    onError: (status, payload) => {
      const details = payload?.error?.details || {};
      const reason = `${details.reason || ""}`;
      const issues: TranslationRevisionIssueView[] = Array.isArray(details.validation?.issues) ? details.validation.issues : [];
      const message = REVISION_REASON_MESSAGES[reason]
        || (status === 404 ? "找不到这段译文（任务的译文可能还没生成）。" : `保存译文失败：${payload?.error?.message || payload?.message || status}`);
      return Object.assign(new Error(message), { status, reason, issues });
    },
  });
}
