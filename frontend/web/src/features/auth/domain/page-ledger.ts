// 多用户页数额度：账目每一条怎么说成人话、页数变动怎么写、管理员调整页数的输入校验。
import type { PageLedgerEntry } from "@retainpdf/api/auth";

export const MAX_PAGE_DELTA = 1_000_000;
export const MAX_PAGE_NOTE_LENGTH = 200;

const REFUND_LABELS: Record<string, string> = {
  failed: "任务失败退回",
  canceled: "取消退回",
  deleted: "删除退回",
  submit_failed: "提交失败退回",
};

export function pageLedgerLabel(entry: Pick<PageLedgerEntry, "kind" | "delta" | "note">): string {
  const kind = `${entry.kind || ""}`;
  if (kind === "grant") return entry.delta < 0 ? "管理员扣减" : "管理员发放";
  if (kind === "charge") return "任务扣页";
  if (kind === "refund") return REFUND_LABELS[`${entry.note || ""}`] || "退回";
  return kind || "其他";
}

/** 账目里要显示的备注：只有管理员发放 / 扣减的备注是人写的；退回的 note 是原因码，已经体现在说明里。 */
export function pageLedgerNote(entry: Pick<PageLedgerEntry, "kind" | "note">): string {
  return entry.kind === "grant" ? `${entry.note || ""}`.trim() : "";
}

/** +300 / −12（用真正的减号，和加号等宽）。 */
export function formatPageDelta(delta: number): string {
  const n = Number(delta) || 0;
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

/** 管理员输入的页数（正整数）不合规时返回原因，合规返回空串。 */
export function pageAdjustProblem(pagesText: string, note: string): string {
  const text = `${pagesText || ""}`.trim();
  if (!/^\d+$/.test(text) || Number(text) <= 0) return "页数要填正整数。";
  if (Number(text) > MAX_PAGE_DELTA) return `一次最多调整 ${MAX_PAGE_DELTA.toLocaleString("en-US")} 页。`;
  if (Array.from(note).length > MAX_PAGE_NOTE_LENGTH) return `备注最多 ${MAX_PAGE_NOTE_LENGTH} 字。`;
  return "";
}
