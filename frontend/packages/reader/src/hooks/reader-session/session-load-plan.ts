// Typed resolution：document/job/source/artifact 解析的纯函数。
// 无 React、无网络、无 adapter 依赖；输入均为已抓取的数据，输出 discriminated load plan。
// 语义与拆分前 session-assets.ts 内联分支逐一对应：
// - document_id 直开先看 active_job_id（排除 rejected 与 "doc:" 伪 job）；
// - 只有 linkedActiveJobId === sessionJobId 才恢复 active_version_id；
// - 404 stale 判定只适用于“document 链路解析出的 active job”。

/** 从文档详情响应中提取关联身份（对应原 docData.active_job_id/active_version_id）。 */
export type DocumentLink = {
  activeJobId: string;
  activeVersionId: string;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : `${(value as string | null) ?? ""}`.trim();
}

/** 原内联逻辑：const docData = docJson?.data ?? docJson。 */
export function parseDocumentLink(docJson: unknown): DocumentLink {
  const holder = (docJson as { data?: unknown } | null)?.data ?? docJson;
  const record = (holder && typeof holder === "object" ? holder : {}) as {
    active_job_id?: unknown;
    active_version_id?: unknown;
  };
  return {
    activeJobId: asTrimmedString(record.active_job_id),
    activeVersionId: asTrimmedString(record.active_version_id),
  };
}

export type SourceOnlyPlan =
  /** 跟随文档的 active job：对外暴露该 job 身份后走统一 job 分支。 */
  | { kind: "follow-active-job"; jobId: string; activeVersionId: string }
  /** 仅恢复已提交的文档源版本（source 视图），不下载 job 产物。 */
  | { kind: "open-committed-source"; documentId: string; revision: string }
  /** 直接打开馆藏源 PDF。 */
  | { kind: "open-source-url" };

export function planSourceOnlyLoad(input: {
  link: DocumentLink;
  rejectedDocumentJobId: string;
  hasCommittedSource: boolean;
}): SourceOnlyPlan {
  const { link, rejectedDocumentJobId, hasCommittedSource } = input;
  const effectiveJobId = link.activeJobId
    && link.activeJobId !== rejectedDocumentJobId
    && !link.activeJobId.startsWith("doc:")
    ? link.activeJobId
    : "";
  if (effectiveJobId) {
    return { kind: "follow-active-job", jobId: effectiveJobId, activeVersionId: link.activeVersionId };
  }
  if (link.activeVersionId && !hasCommittedSource) {
    // 调用方再按 routeDocumentId 补足 documentId/revision。
    return { kind: "open-committed-source", documentId: "", revision: link.activeVersionId };
  }
  return { kind: "open-source-url" };
}

export type JobLoadPlan =
  /** 仅当前 active job 恢复其 committed 文档源（source 视图），不下载 job 产物。 */
  | { kind: "restore-committed-source"; documentId: string; revision: string }
  /** 打开该 job 自己的不可变产物（原文/译文 artifact 或回退源 PDF）。 */
  | { kind: "open-job-artifacts" };

export function planJobLoad(input: {
  payloadDocumentId: string;
  linkedActiveJobId: string;
  linkedActiveVersionId: string;
  sessionJobId: string;
  hasCommittedSource: boolean;
}): JobLoadPlan {
  const {
    payloadDocumentId,
    linkedActiveJobId,
    linkedActiveVersionId,
    sessionJobId,
    hasCommittedSource,
  } = input;
  // 历史 job（linkedActiveJobId !== sessionJobId）永远走不可变快照分支。
  if (
    payloadDocumentId
    && linkedActiveVersionId
    && linkedActiveJobId === sessionJobId
    && !hasCommittedSource
  ) {
    return { kind: "restore-committed-source", documentId: payloadDocumentId, revision: linkedActiveVersionId };
  }
  return { kind: "open-job-artifacts" };
}

/**
 * document 链路 stale active job 的 404 回退判定。
 * 仅当 sessionJobId 确实来自 document 解析（sessionJobId === documentJobId）
 * 且当前 route 是 document 链路（!jobId 有显式 job）时成立。
 */
export function isStaleDocumentJobFailure(input: {
  status: number;
  jobId: string;
  routeDocumentId: string;
  documentJobId: string;
  sessionJobId: string;
}): boolean {
  return input.status === 404
    && !input.jobId
    && Boolean(input.routeDocumentId)
    && Boolean(input.documentJobId)
    && input.sessionJobId === input.documentJobId;
}
