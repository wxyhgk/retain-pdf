// 书架卡片右上角终态徽标。
// 进行中（排队/OCR/翻译/渲染）不在角标写文案（易截断），改由封面中央加载动画表达。
//
// 决策表（status × stage → 中央转圈 / 右上角标 / 无）：
// | status                | stage(stageKey/raw)              | 转圈 | 角标      |
// | library_only 馆藏      | —                                | 无   | 馆藏      |
// | failed                | failed                           | 无   | 失败      |
// | canceled/cancelled    | canceled                         | 无   | 已取消    |
// | queued/running/pending/processing/validating | ocr/translate/render/queued/processing/validating | 转圈 | 无（中央 loading 代替） |
// | succeeded + OCR-only  | done                             | 无   | OCR 完成  |
// | succeeded             | done                             | 无   | 已翻译    |
// | succeeded + 重试脏态   | 回到 ocr/translate/render        | 转圈 | 无        |
// | 其余未知              | —（isRecentJobActive 兜底）      | 按 active 转圈 | 无 |

import type { LibraryCardBadge, LibraryCardItem } from "../types.js";
import {
  isLibraryOnlyItem,
} from "../documents/document-card-item.js";
import {
  isRecentJobActive,
  stageKeyForRecentJobLabel,
} from "./recent-job-card-presenter.js";
import { isOcrOnlyItem } from "./library-card-semantics.js";

/**
 * @returns 终态/馆藏徽标；进行中返回 null（用中央 loading 代替，见上表）。
 * 判定序：馆藏 → 失败/取消 → 进行中(null) → 成功(OCR 完成/已翻译) → 运行兜底(null)。
 */
export function libraryCardBadge(item: LibraryCardItem = {}): LibraryCardBadge | null {
  if (isLibraryOnlyItem(item)) {
    return {
      label: "馆藏",
      icon: "archive",
      cls: "border border-border bg-white/95 text-muted-foreground",
    };
  }

  const status = `${item.status || ""}`.trim().toLowerCase();
  const stageKey = stageKeyForRecentJobLabel(item);

  if (status === "failed" || stageKey === "failed") {
    return {
      label: "失败",
      icon: "alert",
      cls: "bg-destructive/12 text-destructive",
    };
  }
  if (status === "canceled" || status === "cancelled" || stageKey === "canceled") {
    return {
      label: "已取消",
      icon: "clock",
      cls: "bg-muted text-muted-foreground",
    };
  }

  // 进行中（含重试）：不角标，封面中央 loading
  if (isLibraryCardProcessing(item)) {
    return null;
  }

  // 已完成
  if (status === "succeeded" || stageKey === "done") {
    if (isOcrOnlyItem(item)) {
      return {
        label: "OCR 完成",
        icon: "scan-text",
        cls: "bg-secondary text-secondary-foreground",
      };
    }
    return {
      label: "已翻译",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  // 排队 / 运行中（兜底）：进行中不挂角标，中央 loading 表达
  if (isRecentJobActive(item) || status === "queued" || status === "running" || status === "processing" || status === "validating") {
    return null;
  }

  // 兜底：有 done 阶段
  if (stageKey === "done") {
    if (isOcrOnlyItem(item)) {
      return {
        label: "OCR 完成",
        icon: "scan-text",
        cls: "bg-secondary text-secondary-foreground",
      };
    }
    return {
      label: "已翻译",
      icon: "languages",
      cls: "bg-primary text-primary-foreground",
    };
  }

  return null;
}

/**
 * 是否应在封面中央显示处理中加载动画（见文件头决策表）。
 * 否决序：馆藏/失败/取消 → false；OCR-only 成功 → false；
 * 肯定序：status 运行态 → true；succeeded 但原生 stage 回退运行态（重试脏态）→ true；
 * 收尾：stage done → false，否则按 isRecentJobActive 兜底。progress 仅驱动条长，不决定转不转。
 */
export function isLibraryCardProcessing(item: LibraryCardItem = {}): boolean {
  if (isLibraryOnlyItem(item)) return false;
  const RUNNING_STAGES = new Set(["ocr", "translate", "render", "queued", "processing", "validating"]);
  const status = `${item.status || ""}`.trim().toLowerCase();
  if (status === "failed" || status === "canceled" || status === "cancelled") {
    return false;
  }
  // OCR-only 的公共终态仍可能停在 display_stage=ocr / ocr_result_ready；
  // workflow + succeeded 才是权威终态，不能套用翻译任务的重试脏态规则。
  if (status === "succeeded" && isOcrOnlyItem(item)) {
    return false;
  }
  // 明确运行中（列表投影只有原生 stage，无 display_stage，见 live.rs）：
  // 后端 running 之外的运行态（processing/validating）同样在转。
  if (status === "queued" || status === "running" || status === "pending" || status === "processing" || status === "validating") {
    return true;
  }
  // 重试后偶发 status 未及时变、但 stage 已回到 ocr/翻译/渲染；
  // 列表投影只有原生 stage（live.rs，无 display_stage），一并看 item.stage。
  const stage = stageKeyForRecentJobLabel(item);
  const rawStage = `${(item as any).stage || ""}`.trim().toLowerCase();
  const normRawStage = rawStage === "translation" || rawStage === "translating" ? "translate" : rawStage;
  const effStage = stage || (RUNNING_STAGES.has(normRawStage) ? normRawStage : "");
  // succeeded 先看原生 stage：helper 会把 succeeded 统一收敛成 done，
  // 但重试脏态（原生 stage 回到 ocr/翻译/渲染/processing）必须仍转圈。
  if (status === "succeeded") {
    if (RUNNING_STAGES.has(normRawStage)) return true;
    if (RUNNING_STAGES.has(effStage)) return true;
    return false;
  }
  if (RUNNING_STAGES.has(effStage)) {
    if (status === "") return true;
  }
  if (effStage === "done") return false;
  return isRecentJobActive(item);
}
