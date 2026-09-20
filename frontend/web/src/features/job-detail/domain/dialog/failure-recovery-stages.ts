// 阶段恢复动作：把后端 stage-actions 原样翻成前端模型。
//
// 这里刻意不认识任何**失败分类**。后端 job_failure_catalogue 是「分类 → 怎么
// 续跑」的唯一真源，新增一种失败只该改那张表；前端要是再按分类分叉，就等于把
// 刚消掉的「三处都要改」又加回来。所以本文件只问后端三件事：有哪些阶段、每个
// 阶段能不能点、点了会复用什么 / 重跑什么。
//
// 取值小工具也放这里：failure-recovery.ts 依赖本文件，反过来不成立，才不会绕出
// import 环（architecture/import-cycles 门禁盯着这个）。

export type UnknownRecord = Record<string, unknown>;

export type FailureRecoveryAction = {
  available: boolean;
  enabled: boolean;
  method: "POST" | "";
  url: string;
  body: UnknownRecord;
  reason: string;
  requiresDuplicateRisk: boolean;
};

/** 单个阶段的恢复入口，字段全部来自后端，前端只做排版。 */
export type FailureRecoveryStage = {
  stage: string;
  label: string;
  action: FailureRecoveryAction;
  willReuse: string[];
  willRerun: string[];
  preservesSourcePdf: boolean;
  preservationText: string;
  /** 后端 failure.resume_from 指向这个阶段：续跑不会重复调用付费接口。 */
  recommended: boolean;
  noteText: string;
};

export function recordOf(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

export function textOf(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? `${value}`.trim()
    : "";
}

export function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = textOf(value);
    if (text) return text;
  }
  return "";
}

export function normalizedToken(value: unknown): string {
  return textOf(value).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase();
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(textOf).filter(Boolean)
    : [];
}

export function stageActionRecords(stageActions: unknown): UnknownRecord[] {
  const stages = recordOf(stageActions).stages;
  return Array.isArray(stages) ? stages.map(recordOf) : [];
}

/** 按阶段名取后端动作；阶段名由调用方给，本文件不预设哪个阶段特殊。 */
export function stageActionFor(stageActions: unknown, stage: string): UnknownRecord {
  const token = normalizedToken(stage);
  if (!token) return {};
  return stageActionRecords(stageActions)
    .find((item) => normalizedToken(item.stage) === token) || {};
}

export function preservationTextOf(artifacts: string[]): string {
  if (!artifacts.includes("source_pdf")) {
    return "重试不会覆盖当前任务记录；请保留原 PDF，便于安全恢复。";
  }
  return artifacts.length > 1
    ? `原 PDF 会保留；恢复时将复用 ${artifacts.join("、")}。`
    : "原 PDF 会保留并用于重新 OCR。";
}

export function buildRetryAction(
  stageAction: UnknownRecord,
  stage: string,
  ambiguity: UnknownRecord,
): FailureRecoveryAction {
  const action = recordOf(stageAction.action);
  const body = recordOf(action.body);
  const method = normalizedToken(action.method) === "post" ? "POST" : "";
  const url = textOf(action.url);
  // body.stage 仍要和请求的阶段对上——只是「哪个阶段」由调用方给。对不上说明
  // 后端 payload 串了，宁可置灰，也不要把重试打到另一个阶段上去。
  const valid = method === "POST"
    && Boolean(url)
    && normalizedToken(body.stage) === normalizedToken(stage);
  const requiresDuplicateRisk = normalizedToken(ambiguity.status) === "ambiguous"
    || Boolean(stageAction.danger);
  return {
    available: valid,
    enabled: valid && stageAction.can_retry === true && !requiresDuplicateRisk,
    method,
    url,
    body,
    reason: firstText(stageAction.disabled_reason, stageAction.reason),
    requiresDuplicateRisk,
  };
}

function noteTextOf(
  action: FailureRecoveryAction,
  preservationText: string,
  willRerun: string[],
  recommended: boolean,
): string {
  if (!action.available) {
    return action.reason || "后端未提供该阶段的恢复动作。";
  }
  const rerunText = willRerun.length ? `将重跑：${willRerun.join("、")}。` : "";
  const riskText = action.requiresDuplicateRisk ? "需先确认重复执行风险。" : "";
  return `${recommended ? "推荐：" : ""}${preservationText}${rerunText}${riskText}`;
}

export function buildStageRecoveries(
  stageActions: unknown,
  ambiguity: UnknownRecord,
  resumeFrom: string,
): FailureRecoveryStage[] {
  return stageActionRecords(stageActions)
    .map((record): FailureRecoveryStage | null => {
      const stage = normalizedToken(record.stage);
      if (!stage) return null;
      const action = buildRetryAction(record, stage, ambiguity);
      const willReuse = stringList(record.will_reuse);
      const willRerun = stringList(record.will_rerun);
      const preservationText = preservationTextOf(willReuse);
      const recommended = Boolean(resumeFrom) && stage === resumeFrom;
      return {
        stage,
        label: firstText(record.label) || `重试 ${stage}`,
        action,
        willReuse,
        willRerun,
        preservesSourcePdf: willReuse.includes("source_pdf"),
        preservationText,
        recommended,
        noteText: noteTextOf(action, preservationText, willRerun, recommended),
      };
    })
    .filter((item): item is FailureRecoveryStage => item !== null)
    // 既没有 action 又没给理由的阶段不渲染：那是一个点不动也解释不了的按钮
    // （后端漏字段另有 backendGaps 记账，不靠这排空按钮提示）。
    .filter((item) => item.action.available || Boolean(item.action.reason))
    // 后端说能从哪续跑，哪个就排第一——用户最该点的别藏在列表末尾。
    .sort((left, right) => Number(right.recommended) - Number(left.recommended));
}
