// 书架卡片右上角终态徽标。
// 进行中（排队/OCR/翻译/渲染）不在角标写文案（易截断），改由封面中央加载动画表达。
// 「已翻译」是书架上的常态（实测 16 本里 15 本），每张卡都挂一个等于没说，还把真正需要
// 注意的「失败 / 存档 / OCR 完成」淹没了 —— 所以翻译成功不挂角标，只给例外状态挂。
//
// 决策表（status × stage → 中央转圈 / 右上角标 / 无）：
// | status                | stage(stageKey/raw)              | 转圈 | 角标      |
// | library_only 馆藏      | —                                | 无   | 馆藏      |
// | failed                | failed                           | 无   | 失败      |
// | failed + has_translation（旧译文可读） | failed              | 无   | 更新失败（次要样式） |
// | canceled/cancelled    | canceled                         | 无   | 已取消    |
// | queued/running/pending/processing/validating | ocr/translate/render/queued/processing/validating | 转圈 | 无（中央 loading 代替） |
// | succeeded + OCR-only  | done                             | 无   | OCR 完成  |
// | succeeded             | done                             | 无   | 无（常态不标） |
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
import { hasReadableTranslation, isOcrOnlyItem } from "./library-card-semantics.js";
import { isCanceledStatus, isFailedStatus } from "@/platform/contracts/job-status.js";

function ocrDoneBadge(): LibraryCardBadge {
  return {
    label: "OCR 完成",
    icon: "scan-text",
    cls: "bg-secondary text-secondary-foreground",
  };
}

/**
 * @returns 终态/馆藏徽标；进行中和翻译成功返回 null（见上表）。
 * 判定序：馆藏 → 失败/取消 → 进行中(null) → 成功(OCR 完成 / 已翻译=null) → 运行兜底(null)。
 */
export function libraryCardBadge(item: LibraryCardItem = {}): LibraryCardBadge | null {
  if (isLibraryOnlyItem(item)) {
    return {
      label: "存档",
      icon: "archive",
      cls: "border border-border bg-white/95 text-muted-foreground",
    };
  }

  if (!item.status && (item.runtime_pending || item.runtime_unavailable)) {
    return {
      label: item.runtime_pending ? "读取状态…" : "状态待刷新",
      icon: "clock",
      cls: "bg-muted text-muted-foreground",
    };
  }

  const status = `${item.status || ""}`.trim().toLowerCase();
  const stageKey = stageKeyForRecentJobLabel(item);

  if (isFailedStatus(status) || stageKey === "failed") {
    // 失败只说明「最近一次处理失败」。书本身还有能读的旧译文时，醒目的「失败」会让人以为
    // 书坏了 —— 降成次要提示：白底、红字、细边框，阅读入口照旧是对照阅读。
    if (hasReadableTranslation(item)) {
      return {
        label: "更新失败",
        icon: "alert",
        cls: "border border-destructive/25 bg-white/95 text-destructive",
      };
    }
    return {
      label: "失败",
      icon: "alert",
      cls: "bg-destructive/12 text-destructive",
    };
  }
  if (isCanceledStatus(status) || stageKey === "canceled") {
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

  // 已完成：只有 OCR 完成（没有译文，阅读入口也不同）值得标出来；翻译成功是常态，不挂角标。
  if (status === "succeeded" || stageKey === "done") {
    return isOcrOnlyItem(item) ? ocrDoneBadge() : null;
  }

  // 排队 / 运行中（兜底）：进行中不挂角标，中央 loading 表达
  if (isRecentJobActive(item) || status === "queued" || status === "running" || status === "processing" || status === "validating") {
    return null;
  }

  // 兜底：有 done 阶段
  if (stageKey === "done") {
    return isOcrOnlyItem(item) ? ocrDoneBadge() : null;
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
  if (isFailedStatus(status) || isCanceledStatus(status)) {
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
  const rawStage = `${item.stage || ""}`.trim().toLowerCase();
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
