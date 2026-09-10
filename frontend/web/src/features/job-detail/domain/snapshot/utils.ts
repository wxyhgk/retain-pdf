import { isJobTerminal, isTerminalStatus } from "@retainpdf/domain/job";
import {
  formatEventTimestamp,
  formatRuntimeDuration,
} from "@retainpdf/domain/job";

export {
  clampPositiveMs,
  parseIsoTime,
  resolveLiveDurations,
} from "@retainpdf/domain/job";
export {
  resolveStageHistory,
  resolveStageHistoryDuration,
  stageHistoryDisplay,
  summarizeStageName,
} from "@retainpdf/domain/job";

export function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export { formatEventTimestamp, formatRuntimeDuration, isJobTerminal, isTerminalStatus };
