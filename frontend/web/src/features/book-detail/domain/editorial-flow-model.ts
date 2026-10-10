/** 编辑部精修的流程图：从任务事件流还原「走到哪一步、第几轮、这一步第几批」。
 *
 * 编辑部是几个角色接力：读取 → 审校挑错 → 术语专员统一译法 → 最多两轮（主编分流 → 修改 → 审校复核）
 * → 排版。以前界面上只有一句「编辑部：审校开始挑错（708 块）」，看不出还剩几步、到了第几批。
 *
 * 数据来自 GET /jobs/:id/events：每条精修事件的 payload.observation 里有 refine_phase（哪一步）、
 * refine_round / refine_max_rounds（第几轮）、batch_done / batch_total（这一步第几批）。
 * 旧任务的事件没有后三项：轮次退回 observation.round，批数就不显示。
 */

export type EditorialNodeState = "done" | "active" | "pending" | "skipped" | "stopped";

export type EditorialFlowNode = {
  key: string;
  label: string;
  role: string;
  state: EditorialNodeState;
  detail: string;
};

export type EditorialFlow = {
  /** 循环之前的几步：读取、挑错、术语。 */
  before: EditorialFlowNode[];
  /** 循环里的三步：主编分流、修改、审校复核。 */
  loop: EditorialFlowNode[];
  /** 循环之后：排版出 PDF。 */
  after: EditorialFlowNode[];
  round: number;
  maxRounds: number;
  finished: boolean;
  /** 精修结束时后端那句总结（发现几处、改了几处）。 */
  summary: string;
};

type Rec = Record<string, unknown>;

const DEFAULT_MAX_ROUNDS = 2;

// 事件里的 refine_phase → 流程图上的节点。fix（局部修改）和 rewrite（整块重写）画成同一个「修改」。
const NODE_OF_PHASE: Record<string, string> = {
  start: "prepare",
  prepare: "prepare",
  review: "review",
  terms: "terms",
  chief: "chief",
  fix: "revise",
  rewrite: "revise",
  recheck: "recheck",
  done: "done",
};

const RANK: Record<string, number> = { prepare: 0, review: 1, terms: 2, chief: 3, revise: 4, recheck: 5, done: 6 };

const BEFORE = [
  { key: "prepare", label: "读取译文与质检", role: "编辑部" },
  { key: "review", label: "审校挑错", role: "审校" },
  { key: "terms", label: "统一术语", role: "术语专员" },
] as const;

const LOOP = [
  { key: "chief", label: "主编分流", role: "主编" },
  { key: "revise", label: "修改译文", role: "译者" },
  { key: "recheck", label: "审校复核", role: "审校" },
] as const;

function rec(value: unknown): Rec {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Rec : {};
}

function observationOf(event: Rec): Rec {
  const payload = rec(event.payload);
  return Object.keys(rec(payload.observation)).length ? rec(payload.observation) : payload;
}

function int(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function shortDetail(text: unknown): string {
  return `${text ?? ""}`.trim().replace(/^编辑部[：:]\s*/, "");
}

type Step = { node: string; round: number; batchDone: number; batchTotal: number; text: string };

function stepOf(event: Rec, fallbackRound: number): Step | null {
  if (`${event.substage ?? ""}` !== "refining") return null;
  const obs = observationOf(event);
  const node = NODE_OF_PHASE[`${obs.refine_phase ?? ""}`];
  if (!node) return null;
  return {
    node,
    round: int(obs.refine_round) || int(obs.round) || fallbackRound,
    batchDone: int(obs.batch_done),
    batchTotal: int(obs.batch_total),
    text: `${event.stage_detail || event.message || ""}`,
  };
}

function detailOf(step: Step | undefined, state: EditorialNodeState): string {
  if (!step) return "";
  // 做完的步骤只写一共几批：「审校开始挑错（708 块）」这种进行时的话挂在打勾的节点下面不对。
  if (state === "done") return step.batchTotal ? `共 ${step.batchTotal} 批` : "";
  if (step.batchTotal) return `${step.batchDone}/${step.batchTotal} 批`;
  return shortDetail(step.text);
}

/** 没有编辑部精修的事件时返回 null（普通精修、还没开始精修）。 */
export function editorialFlowModel(
  events: unknown[] | null | undefined,
  { jobActive = true }: { jobActive?: boolean } = {},
): EditorialFlow | null {
  const records = (Array.isArray(events) ? events : []).map(rec);
  // 只看最后一次精修：同一任务原地重跑精修时，事件流里会有好几段。
  let startIndex = -1;
  records.forEach((event, index) => {
    if (`${event.substage ?? ""}` === "refining" && `${observationOf(event).refine_phase ?? ""}` === "start") startIndex = index;
  });
  const run = startIndex >= 0 ? records.slice(startIndex) : records;
  const editorial = run.some((event) => `${observationOf(event).refine_mode ?? ""}` === "editorial");
  if (!editorial) return null;

  let maxRounds = 0;
  let round = 0;
  const steps: Step[] = [];
  for (const event of run) {
    const step = stepOf(event, round);
    if (!step) continue;
    maxRounds = Math.max(maxRounds, int(observationOf(event).refine_max_rounds));
    if (RANK[step.node] >= RANK.chief && RANK[step.node] < RANK.done) round = Math.max(round, step.round);
    steps.push(step);
  }
  if (!steps.length) return null;
  maxRounds = maxRounds || DEFAULT_MAX_ROUNDS;
  const current = steps[steps.length - 1];
  const finished = current.node === "done";
  const currentRank = RANK[current.node];
  const lastOf = (node: string, inRound?: number) => [...steps].reverse()
    .find((step) => step.node === node && (inRound === undefined || step.round === inRound));
  const activeState: EditorialNodeState = jobActive ? "active" : "stopped";

  const before = BEFORE.map((node): EditorialFlowNode => {
    const rank = RANK[node.key];
    const last = lastOf(node.key);
    let state: EditorialNodeState = "pending";
    if (currentRank > rank) state = node.key === "terms" && !last ? "skipped" : "done";
    else if (currentRank === rank) state = activeState;
    const detail = state === "skipped" ? "没有要统一的词" : detailOf(last, state);
    return { ...node, state, detail: state === "pending" ? "" : detail };
  });

  const loop = LOOP.map((node): EditorialFlowNode => {
    const rank = RANK[node.key];
    let state: EditorialNodeState = "pending";
    if (finished) state = round ? "done" : "skipped";
    else if (currentRank >= RANK.chief) {
      if (currentRank > rank) state = "done";
      else if (currentRank === rank) state = activeState;
    }
    const last = lastOf(node.key, round || undefined);
    const detail = state === "skipped" ? "挑错后没有要改的块" : state === "pending" ? "" : detailOf(last, state);
    return { ...node, state, detail };
  });

  const after: EditorialFlowNode[] = [{
    key: "render",
    label: "排版出 PDF",
    role: "排版",
    state: finished ? (jobActive ? "active" : "done") : "pending",
    detail: "",
  }];

  return {
    before,
    loop,
    after,
    round,
    maxRounds,
    finished,
    summary: finished ? shortDetail(current.text) : "",
  };
}
