// 职责 2a：job/document 权威身份与 committed 文档源。
// 约束（与拆分前一致）：
// - 显式 job_id 是不可变快照；只有“当前 active job 才恢复 active_version_id”，
//   历史 job 保持不可变快照。
// - refreshCommittedDocument 用 ref 做 stale 防护：跨 documentId 的提交直接丢弃。

import { useCallback, useEffect, useState } from "react";
import type {
  CommittedDocumentSource,
  ResolvedJobDocument,
} from "./types.js";

export type SessionDocuments = {
  resolvedDocumentJob: { documentId: string; jobId: string };
  setResolvedDocumentJob: React.Dispatch<React.SetStateAction<{ documentId: string; jobId: string }>>;
  missingDocumentJob: { documentId: string; jobId: string };
  setMissingDocumentJob: React.Dispatch<React.SetStateAction<{ documentId: string; jobId: string }>>;
  documentJobId: string;
  rejectedDocumentJobId: string;
  sessionJobId: string;
  resolvedJobDocument: ResolvedJobDocument;
  setResolvedJobDocument: React.Dispatch<React.SetStateAction<ResolvedJobDocument>>;
  jobDocumentId: string;
  documentId: string;
  sourceOnly: boolean;
  committedDocumentSource: CommittedDocumentSource | null;
  setCommittedDocumentSource: React.Dispatch<React.SetStateAction<CommittedDocumentSource | null>>;
  activeCommittedDocumentSource: CommittedDocumentSource | null;
  sourceViewOnly: boolean;
  refreshCommittedDocument: (input: { documentId: string; revision: string }) => void;
  /** 窄命令：session-assets 只经此 typed event 改身份，不直接拿一串 setter。 */
  applyIdentityEvent: (event: SessionIdentityEvent) => void;
};

/**
 * 跨模块身份变更的 discriminated event。
 * 由 useSessionDocuments 内部翻译成具体 setState，调用方无需知道 state 切分。
 */
export type SessionIdentityEvent =
  /** document 链路解析出 active job：对外暴露该 job 身份。 */
  | { type: "resolved-document-job"; documentId: string; jobId: string }
  /** stale active job 404：清空该 document 的 job 解析。 */
  | { type: "cleared-resolved-document-job" }
  /** stale active job 404：记住该 link 已失效，本 session 不再跟随。 */
  | { type: "missing-document-job"; documentId: string; jobId: string }
  /** job 链路回填 document 身份（保持引用稳定：相同时不重建对象）。 */
  | { type: "resolved-job-document"; jobId: string; documentId: string }
  /** 提交/恢复为文档当前源版本（source 视图）。 */
  | { type: "committed-source"; documentId: string; revision: string; sessionIdentity: string };

export function useSessionDocuments(options: {
  routeDocumentId: string;
  jobId: string;
  sessionIdentity: string;
  sessionIdentityRef: React.MutableRefObject<string>;
  documentIdRef: React.MutableRefObject<string>;
  sessionJobIdRef: React.MutableRefObject<string>;
  /** 提交新文档版本时强制切到 source 视图（由 reader-mode 侧提供，内部仅用稳定 setter）。 */
  switchToSourceMode: () => void;
}): SessionDocuments {
  const {
    routeDocumentId,
    jobId,
    sessionIdentity,
    sessionIdentityRef,
    documentIdRef,
    sessionJobIdRef,
    switchToSourceMode,
  } = options;
  const [resolvedDocumentJob, setResolvedDocumentJob] = useState({
    documentId: "",
    jobId: "",
  });
  const [missingDocumentJob, setMissingDocumentJob] = useState({
    documentId: "",
    jobId: "",
  });
  const documentJobId = resolvedDocumentJob.documentId === routeDocumentId
    ? resolvedDocumentJob.jobId
    : "";
  const rejectedDocumentJobId = missingDocumentJob.documentId === routeDocumentId
    ? missingDocumentJob.jobId
    : "";
  const sessionJobId = jobId || documentJobId;
  const [resolvedJobDocument, setResolvedJobDocument] = useState<ResolvedJobDocument>({
    jobId: "",
    documentId: "",
  });
  const jobDocumentId = resolvedJobDocument.jobId === sessionJobId
    ? resolvedJobDocument.documentId
    : "";
  const documentId = routeDocumentId || jobDocumentId;
  const sourceOnly = Boolean(routeDocumentId) && !sessionJobId;
  const [committedDocumentSource, setCommittedDocumentSource] = useState<CommittedDocumentSource | null>(null);
  const activeCommittedDocumentSource = committedDocumentSource?.sessionIdentity === sessionIdentity
    && committedDocumentSource.documentId === documentId
    ? committedDocumentSource
    : null;
  // sourceOnly 表示“没有任务 job”，用于判断 Markdown/AI 能力。
  // sourceViewOnly 只表示当前没有可安全并排的译文，两者不能混用。
  const sourceViewOnly = sourceOnly || Boolean(activeCommittedDocumentSource);

  const refreshCommittedDocument = useCallback((input: {
    documentId: string;
    revision: string;
  }) => {
    const nextDocumentId = `${input.documentId || ""}`.trim();
    if (!nextDocumentId) return;
    if (documentIdRef.current && documentIdRef.current !== nextDocumentId) return;
    if (!documentIdRef.current && sessionJobIdRef.current) {
      setResolvedJobDocument({
        jobId: sessionJobIdRef.current,
        documentId: nextDocumentId,
      });
    } else if (!documentIdRef.current) {
      return;
    }
    const nextRevision = `${input.revision || ""}`.trim() || `${Date.now()}`;
    setCommittedDocumentSource({
      documentId: nextDocumentId,
      revision: nextRevision,
      sessionIdentity: sessionIdentityRef.current,
    });
    switchToSourceMode();
  }, []);

  useEffect(() => {
    setCommittedDocumentSource((current) => (
      current && current.sessionIdentity !== sessionIdentity ? null : current
    ));
  }, [sessionIdentity]);

  const applyIdentityEvent = useCallback((event: SessionIdentityEvent) => {
    switch (event.type) {
      case "resolved-document-job":
        setResolvedDocumentJob({ documentId: event.documentId, jobId: event.jobId });
        break;
      case "cleared-resolved-document-job":
        setResolvedDocumentJob({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        setMissingDocumentJob({ documentId: event.documentId, jobId: event.jobId });
        break;
      case "resolved-job-document":
        setResolvedJobDocument((current) => (
          current.jobId === event.jobId && current.documentId === event.documentId
            ? current
            : { jobId: event.jobId, documentId: event.documentId }
        ));
        break;
      case "committed-source":
        setCommittedDocumentSource({
          documentId: event.documentId,
          revision: event.revision,
          sessionIdentity: event.sessionIdentity,
        });
        break;
    }
  }, []);

  return {
    resolvedDocumentJob,
    setResolvedDocumentJob,
    missingDocumentJob,
    setMissingDocumentJob,
    documentJobId,
    rejectedDocumentJobId,
    sessionJobId,
    resolvedJobDocument,
    setResolvedJobDocument,
    jobDocumentId,
    documentId,
    sourceOnly,
    committedDocumentSource,
    setCommittedDocumentSource,
    activeCommittedDocumentSource,
    sourceViewOnly,
    refreshCommittedDocument,
    applyIdentityEvent,
  };
}
