// 盯着任务列表，发现有任务跑完（成功或失败）就报一次（纯逻辑，不碰 React）。
//
// 书架自己的轮询只盯已经加载进网格、并且不是详情弹窗正在看的那几张卡，靠它会漏；
// 这里另起一个很轻的轮询：每一拍取最近更新的一页任务（不带实时阶段），
// 再补查上一拍还在跑、这一页里没出现的那几个。
//
// 什么算「刚跑完」：
// - 之前见过它在排队或在跑，这次变成了 succeeded / failed；
// - 或者第一次见到它就已经跑完了，但它是在开始盯以后才建的（跑得比一拍还快的小任务）。
//   「开始盯以后」用后端的 created_at 比：第一拍看到的最新 created_at 当基线，
//   不用本机时钟——网页连远端后端时两边的钟不一定对得上。
// 用户自己取消的（canceled）不报。同一个任务原地重跑又跑完，会再报一次。

import type { JobListItemView } from "@retainpdf/contracts/job-status";

export const JOB_FINISH_RECENT_LIMIT = 30;
/** 有任务在跑时多久看一次。 */
export const JOB_FINISH_ACTIVE_INTERVAL_MS = 5000;
/** 没有任务在跑时多久看一次（别处——命令行、另一台电脑——交的任务也要能发现）。 */
export const JOB_FINISH_IDLE_INTERVAL_MS = 20000;

export type WatchedJob = Pick<JobListItemView, "job_id" | "display_name" | "workflow" | "status" | "created_at"> &
  Partial<Pick<JobListItemView, "completion_note" | "failure" | "source_file_name">>;

export type FinishedJob = {
  jobId: string;
  title: string;
  workflow: string;
  status: "succeeded" | "failed";
  /** 成功但有说明（例如有几块保留原文），或失败时给用户看的那句原因。 */
  note: string;
};

export type JobFinishWatcherOptions = {
  /** 最近更新的一页任务。 */
  listRecent: () => Promise<WatchedJob[]>;
  /** 按编号查任务；后端没有的编号不返回。 */
  listByIds: (jobIds: string[]) => Promise<WatchedJob[]>;
  onFinished: (job: FinishedJob) => void;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  activeIntervalMs?: number;
  idleIntervalMs?: number;
};

export type JobFinishWatcher = {
  start(): void;
  stop(): void;
  /** 刚交了任务：马上看一次，不等这一拍。 */
  poke(): void;
};

function isActive(job: WatchedJob) {
  return job.status === "queued" || job.status === "running";
}

function jobTitle(job: WatchedJob) {
  return `${job.display_name || job.source_file_name || job.job_id}`.trim();
}

function finishedNote(job: WatchedJob) {
  if (job.status === "failed") return `${job.failure?.summary || ""}`.trim();
  return `${job.completion_note || ""}`.trim();
}

export function createJobFinishWatcher({
  listRecent,
  listByIds,
  onFinished,
  setTimer = (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimer = (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  activeIntervalMs = JOB_FINISH_ACTIVE_INTERVAL_MS,
  idleIntervalMs = JOB_FINISH_IDLE_INTERVAL_MS,
}: JobFinishWatcherOptions): JobFinishWatcher {
  // 上一拍还在排队或在跑的任务。
  const active = new Set<string>();
  // 见过的任务；第一次见就已经跑完、又不是基线以后建的，不报。
  // 每个终态只报一次靠这两条：报的时候它要么刚从 active 里删掉，要么是第一次见，下一拍两样都不成立。
  const seen = new Set<string>();
  let baselineCreatedAt: string | null = null;
  let timer: unknown = null;
  let running = false;
  let ticking = false;
  let pokedWhileTicking = false;

  function observe(job: WatchedJob) {
    const id = `${job.job_id || ""}`.trim();
    if (!id) return;
    const firstSight = !seen.has(id);
    seen.add(id);
    if (isActive(job)) {
      active.add(id);
      return;
    }
    const wasActive = active.delete(id);
    if (job.status !== "succeeded" && job.status !== "failed") return;
    const createdAfterBaseline = baselineCreatedAt !== null && `${job.created_at || ""}` > baselineCreatedAt;
    if (!wasActive && !(firstSight && createdAfterBaseline)) return;
    onFinished({ jobId: id, title: jobTitle(job), workflow: `${job.workflow || ""}`, status: job.status, note: finishedNote(job) });
  }

  async function tick() {
    const recent = await listRecent();
    const firstTick = baselineCreatedAt === null;
    if (firstTick) {
      // 第一拍只记下现状：已经跑完的都是开始盯以前的事。
      baselineCreatedAt = recent.reduce((latest, job) => (`${job.created_at || ""}` > latest ? `${job.created_at}` : latest), "");
      for (const job of recent) {
        seen.add(job.job_id);
        if (isActive(job)) active.add(job.job_id);
      }
      return;
    }
    const inPage = new Set(recent.map((job) => job.job_id));
    const missing = [...active].filter((id) => !inPage.has(id));
    const extra = missing.length ? await listByIds(missing) : [];
    for (const job of [...recent, ...extra]) observe(job);
    // 查不到的（被删了）不再盯。
    const found = new Set(extra.map((job) => job.job_id));
    for (const id of missing) if (!found.has(id)) active.delete(id);
  }

  function schedule(ms: number) {
    if (!running) return;
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      void runTick();
    }, ms);
  }

  async function runTick() {
    if (!running) return;
    if (ticking) {
      pokedWhileTicking = true;
      return;
    }
    ticking = true;
    try {
      await tick();
    } catch {
      // 后端暂时连不上：下一拍再看，不打扰用户。
    } finally {
      ticking = false;
    }
    if (pokedWhileTicking) {
      pokedWhileTicking = false;
      schedule(0);
      return;
    }
    schedule(active.size ? activeIntervalMs : idleIntervalMs);
  }

  return {
    start() {
      if (running) return;
      running = true;
      schedule(0);
    },
    stop() {
      running = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
    poke() {
      if (!running) return;
      if (ticking) {
        pokedWhileTicking = true;
        return;
      }
      schedule(0);
    },
  };
}
