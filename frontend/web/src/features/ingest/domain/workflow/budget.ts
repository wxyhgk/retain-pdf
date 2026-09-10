const DEEPSEEK_PAGE_PRICE_CNY = 0.015;
const DEEPSEEK_BUDGET_BUFFER = 1.1;
const DEEPSEEK_TOP_UP_URL = "https://platform.deepseek.com/top_up";

function pageRangeCount(pageRanges = "", uploadedPageCount = 0) {
  const total = Math.max(0, Math.floor(Number(uploadedPageCount) || 0));
  const raw = `${pageRanges || ""}`.trim();
  if (!raw) {
    return total;
  }
  const match = raw.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) {
    return total;
  }
  const start = Number(match[1]);
  const end = Number(match[2] || match[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end < start) {
    return total;
  }
  return Math.max(0, end - start + 1);
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return number.toFixed(2);
}

export function resolveTranslationBudgetState({
  pageRanges = "",
  uploadedPageCount = 0,
  balanceCny = null,
  balanceChecked = false,
  needsTranslation = true,
}: any = {}) {
  const pageCount = pageRangeCount(pageRanges, uploadedPageCount);
  if (!needsTranslation || pageCount <= 0) {
    return {
      visible: false,
      blocking: false,
      pageCount,
      estimatedCost: 0,
      balanceCny,
      balanceChecked,
      message: "",
      tone: "",
    };
  }
  const estimatedCost = pageCount * DEEPSEEK_PAGE_PRICE_CNY * DEEPSEEK_BUDGET_BUFFER;
  const balance = Number(balanceCny);
  const hasBalance = balanceChecked && Number.isFinite(balance);
  const blocking = hasBalance && balance < estimatedCost;
  const balanceLabel = hasBalance ? `余额 ¥${money(balance)}` : "余额未检测";
  return {
    visible: true,
    blocking,
    pageCount,
    estimatedCost,
    balanceCny: hasBalance ? balance : null,
    balanceChecked,
    tone: blocking ? "error" : hasBalance ? "valid" : "",
    message: `预计 ¥${money(estimatedCost)} · ${pageCount} 页 · ${balanceLabel}`,
    topUpUrl: DEEPSEEK_TOP_UP_URL,
  };
}

