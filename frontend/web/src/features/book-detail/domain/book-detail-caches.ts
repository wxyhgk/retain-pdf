// 书籍详情的会话缓存：弹窗第一次打开后一直挂着，缓存跟着它活，关掉再打开同一本书直接用。
// 不放模块级（门禁不许新增模块级可变状态），由 BookDetailDialog 创建一份往下传。
import type { TranslationCoverageView } from "@/platform/api/index.js";
import type { ArtifactManifest } from "./artifact-center-types.js";
import type { EditorialFlow } from "./editorial-flow-model.js";

export type BookDetailCaches = {
  /** 按书：最近一次的翻译覆盖，和当时的「任务 id:状态」键。 */
  coverage: Map<string, { jobsKey: string; view: TranslationCoverageView }>;
  /** 按「任务 id:流程:状态:更新时间」：已结束任务的产物清单。 */
  manifests: Map<string, ArtifactManifest>;
  /** 按任务：不在跑的任务最后一次编辑部精修的流程图（不会再变）。 */
  settledFlows: Map<string, EditorialFlow | null>;
};

export function createBookDetailCaches(): BookDetailCaches {
  return { coverage: new Map(), manifests: new Map(), settledFlows: new Map() };
}
