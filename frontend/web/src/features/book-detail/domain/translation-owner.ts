// 「这份译文是哪个任务的」：重新处理（精修、重新翻译、重新渲染）要发给真正持有译文的任务。
//
// 重新渲染（create_new_job=true）出来的新任务没有自己的译文，它的 source_artifact_job_id
// 指向上一个任务；连着重新渲染几次就是一条链。精修是在任务上就地跑的，跑完那个任务的
// 类型会被记成「渲染」——于是「找最近一个不是渲染的翻译任务」会一个都找不到，退回到链尾
// 那个重新渲染出来的任务，后端回一句英文：refine writes revisions back into this job's own
// <job_root>/translated, but this job renders translations owned by another job …
//
// 判断持有者不看类型，看来源：不是渲染任务，或者来源是自己（就地精修过的原始任务），就是它。

export type TranslationSourceView = {
  workflow?: string | null;
  source_artifact_job_id?: string | null;
};

const MAX_HOPS = 12;

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

export async function resolveTranslationOwnerId(
  startJobId: string,
  readJob: (jobId: string) => Promise<TranslationSourceView | null | undefined>,
): Promise<string> {
  let jobId = text(startJobId);
  const visited = new Set<string>();
  for (let hop = 0; jobId && hop < MAX_HOPS; hop += 1) {
    visited.add(jobId);
    const view = await readJob(jobId);
    const source = text(view?.source_artifact_job_id);
    if (text(view?.workflow).toLowerCase() !== "render" || !source || source === jobId || visited.has(source)) {
      return jobId;
    }
    jobId = source;
  }
  return jobId;
}
