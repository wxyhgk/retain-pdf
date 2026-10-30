/** 编辑部的「广播」：每条事件说成一句给人看的话，和几处代码到中文的对照。 */

import type { EditorialEvent } from "./events.js";

export type NarrationTone = "neutral" | "ok" | "warn" | "danger";
export type Narration = { text: string; tone: NarrationTone };

export const STOP_REASON_TEXT: Record<string, string> = {
  quota_exhausted: "额度用完了，充值后可以接着跑",
  auth_failed: "密钥不对，换好后可以接着跑",
  rate_limited: "请求太快被限流，稍后接着跑",
};

export const GENRE_TEXT: Record<string, string> = {
  science_paper: "科研论文",
  textbook: "教科书",
  manual: "技术手册",
  humanities: "人文文章",
  fiction: "小说",
};

export const NAME_POLICY_TEXT: Record<string, string> = {
  keep: "人名保留原文",
  translate: "人名译成中文",
  mixed: "人名首次出现附原文",
};

const GLOSSARY_ACTION_TEXT: Record<string, string> = {
  add: "上板",
  promote: "审定",
  revise: "改译法",
  widen: "扩用法",
  candidate: "记为候选",
};

// 质检代码：后端以后可能加新的，不认识的照原样显示。
export const CHECK_CODE_TEXT: Record<string, string> = {
  number_lost: "数字丢了",
  formula_changed: "公式变了",
  numbering_changed: "编号变了",
  footnote_lost: "脚注标记丢了",
  untranslated: "漏翻",
  term_mismatch: "术语不一致",
};

export const stopReasonText = (reason: string) => STOP_REASON_TEXT[reason] || `停下了（${reason || "原因未知"}）`;
export const genreText = (genre: string) => GENRE_TEXT[genre] || genre || "未定";
export const namePolicyText = (policy: string) => NAME_POLICY_TEXT[policy] || policy || "未定";
export const glossaryActionText = (action: string) => GLOSSARY_ACTION_TEXT[action] || action;
export const checkCodeText = (code: string) => CHECK_CODE_TEXT[code] || code;

function codesText(codes: Record<string, number>): string {
  const parts = Object.entries(codes)
    .filter(([, n]) => n > 0)
    .map(([code, n]) => `${checkCodeText(code)} ${n}`);
  return parts.length ? `（${parts.join("、")}）` : "";
}

export function narrate(event: EditorialEvent): Narration {
  switch (event.type) {
    case "run_started":
      return { text: `开工：《${event.doc_title || "未命名"}》共 ${event.pages} 页，模型 ${event.model}`, tone: "neutral" };
    case "reading_started":
      return { text: "通读员开始通读全书", tone: "neutral" };
    case "reading_done":
      return {
        text: `通读完：${genreText(event.genre)}，${namePolicyText(event.name_policy)}，术语 ${event.terms} 条、标题 ${event.headings} 个`,
        tone: "ok",
      };
    case "page_started":
      return { text: `调度把第 ${event.label || event.page} 页（${event.blocks} 块）派给译者`, tone: "neutral" };
    case "translate_call":
      return event.attempt > 1
        ? { text: `译者重翻第 ${event.page} 页的 ${event.blocks.length || "几"} 块（第 ${event.attempt} 次）`, tone: "warn" }
        : { text: `译者开始翻第 ${event.page} 页`, tone: "neutral" };
    case "check_result": {
      const tone: NarrationTone = event.error > 0 ? "danger" : event.warn > 0 ? "warn" : "ok";
      return {
        text: `质检第 ${event.page} 页：合格 ${event.ok}、警告 ${event.warn}、不合格 ${event.error}${codesText(event.codes)}`,
        tone,
      };
    }
    case "retry":
      return { text: `第 ${event.page} 页有 ${event.blocks.length} 块退回译者重翻`, tone: "warn" };
    case "fallback":
      return { text: `第 ${event.page} 页的 ${event.block} 重翻还不行，放进「待人看」筐，先显示原文`, tone: "danger" };
    case "review_started":
      return { text: `审校开始审第 ${event.page} 页（${event.blocks} 块）`, tone: "neutral" };
    case "review_done":
      if (event.tickets === 0) return { text: `审校第 ${event.page} 页没挑出问题`, tone: "ok" };
      return {
        text: `审校第 ${event.page} 页开了 ${event.tickets} 张单：修订改了 ${event.applied} 处，没收 ${event.rejected} 处`,
        tone: event.rejected > 0 ? "warn" : "ok",
      };
    case "glossary_changed":
      return {
        text: `术语表第 ${event.version} 版：${event.source} → ${event.target}（${glossaryActionText(event.action)}）`,
        tone: "neutral",
      };
    case "ticket_opened":
      return { text: `第 ${event.page} 页贴了歧义单：${event.term} 用「${event.current}」还是「${event.proposed}」`, tone: "warn" };
    case "page_done":
      return { text: `第 ${event.page} 页定稿归档`, tone: "ok" };
    case "run_stopped":
      return { text: stopReasonText(event.reason), tone: "danger" };
    case "run_done":
      return { text: `全部 ${event.pages} 页定稿，术语表第 ${event.glossary_version} 版，歧义单 ${event.tickets} 张`, tone: "ok" };
    default:
      return { text: "", tone: "neutral" };
  }
}
