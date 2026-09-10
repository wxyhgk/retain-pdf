// React 阅读会话（组合层）：
// 1) 解析 job/document → URL
// 2) 整文件下载完原文/译文 PDF（遮罩不关）
// 3) 再展示阅读器；可见页渲染等优化在显示之后进行
//
// 职责已拆到 ./reader-session/*：
// - route-identity：URL/history 监听与 route 身份
// - job-identity：job/document 权威身份与 committed 文档源
// - job-status：权威 job 载荷与轻量 status 轮询
// - session-assets：编排与本地展示状态（唯一允许写 boot/URL/文件的层）
// - session-load-plan：document/job/source/artifact 纯解析，返回 discriminated load plan
// - session-pdf-download：PDF 下载与 abort/stale fencing，不写展示状态
// - reader-mode：mode 状态与 body class 同步
// - session-helpers/types：纯函数与公共类型
// 本文件只做组合：维护跨模块的 session epoch/refs 栅栏，拼出 ReaderSessionState。

import { useCallback, useMemo, useRef } from "react";
import { defaultReaderDataPort } from "../external.js";
import type {
  ReaderDownloadContext,
  ReaderSessionState,
} from "./reader-session/types.js";
import { buildCommittedDocumentSourceUrl } from "./reader-session/session-helpers.js";
import { useRouteIdentity } from "./reader-session/route-identity.js";
import { useSessionDocuments } from "./reader-session/job-identity.js";
import { useJobStatusPolling } from "./reader-session/job-status.js";
import { useReaderMode } from "./reader-session/reader-mode.js";
import { useSessionAssets } from "./reader-session/session-assets.js";

export type {
  ReaderDownloadContext,
  ReaderMode,
  ReaderSessionState,
} from "./reader-session/types.js";
export { buildCommittedDocumentSourceUrl } from "./reader-session/session-helpers.js";

export function useReaderSession(): ReaderSessionState {
  const closingRef = useRef(false);
  const activeLoadAbortRef = useRef<AbortController | null>(null);
  const { locationKey, jobId, routeDocumentId, sessionIdentity } = useRouteIdentity();

  const sessionEpochRef = useRef({ identity: "", value: 0 });
  if (sessionEpochRef.current.identity !== sessionIdentity) {
    sessionEpochRef.current = {
      identity: sessionIdentity,
      value: sessionEpochRef.current.value + 1,
    };
    closingRef.current = false;
  }

  const sessionIdentityRef = useRef(sessionIdentity);
  const documentIdRef = useRef("");
  const sessionJobIdRef = useRef("");

  // mode setter 经 ref 转发给 job-identity：refreshCommittedDocument 用 useCallback([])
  // 捕获首帧闭包，转发层保证它永远调用到最新的稳定 setter，不引入 stale。
  const switchToSourceModeRef = useRef(() => {});
  const switchToSourceMode = useCallback(() => switchToSourceModeRef.current(), []);
  const docs = useSessionDocuments({
    routeDocumentId,
    jobId,
    sessionIdentity,
    sessionIdentityRef,
    documentIdRef,
    sessionJobIdRef,
    switchToSourceMode,
  });
  const {
    sessionJobId,
    documentId,
    sourceOnly,
    sourceViewOnly,
    activeCommittedDocumentSource,
  } = docs;

  const { mode, setMode, switchSessionMode } = useReaderMode(sourceViewOnly);
  switchToSourceModeRef.current = () => {
    switchSessionMode("source");
  };

  sessionIdentityRef.current = sessionIdentity;
  documentIdRef.current = documentId;
  sessionJobIdRef.current = sessionJobId;

  const status = useJobStatusPolling({
    sessionJobId,
    sessionIdentity,
    sessionIdentityRef,
    sessionJobIdRef,
    sessionEpochRef,
    closingRef,
  });
  const {
    scopedJobPayload,
    scopedManifestPayload,
    jobStatus,
    jobTerminal,
    jobRefreshRevision,
    refreshJobArtifacts,
    refreshJobStatus,
  } = status;

  const assets = useSessionAssets({
    sessionJobId,
    jobId,
    routeDocumentId,
    documentJobId: docs.documentJobId,
    rejectedDocumentJobId: docs.rejectedDocumentJobId,
    sourceOnly,
    locationKey,
    sessionIdentity,
    committedSource: docs.activeCommittedDocumentSource,
    applyIdentityEvent: docs.applyIdentityEvent,
    publishPayload: status.publishPayload,
    clearPayload: status.clearPayload,
    switchSessionMode,
    jobRefreshRevision,
    sessionEpochRef,
    closingRef,
    activeLoadAbortRef,
  });

  const prepareClose = useCallback(() => {
    closingRef.current = true;
    activeLoadAbortRef.current?.abort();
  }, []);

  const download = useMemo<ReaderDownloadContext>(
    () => ({
      fetchProtected: defaultReaderDataPort.fetchProtected,
      jobId: sessionJobId,
      jobPayload: scopedJobPayload,
      manifestPayload: scopedManifestPayload,
      sourceUrl: assets.sourceUrl,
      translatedUrl: assets.translatedUrl,
      sourceOnly: sourceViewOnly,
    }),
    [sessionJobId, scopedJobPayload, scopedManifestPayload, assets.sourceUrl, assets.translatedUrl, sourceViewOnly],
  );

  return {
    jobId: sessionJobId,
    jobStatus,
    workflow: `${scopedJobPayload?.workflow || ""}`.trim().toLowerCase(),
    jobTerminal,
    documentId,
    sourceOnly,
    mode,
    setMode,
    sourceUrl: assets.sourceUrl,
    translatedUrl: assets.translatedUrl,
    sourceFile: assets.sourceFile,
    translatedFile: assets.translatedFile,
    assetsReady: assets.assetsReady,
    boot: assets.boot,
    title: assets.title,
    regions: assets.regions,
    readerMetadata: assets.readerMetadata,
    download,
    refreshJobArtifacts,
    refreshJobStatus,
    refreshCommittedDocument: docs.refreshCommittedDocument,
    prepareClose,
  };
}
