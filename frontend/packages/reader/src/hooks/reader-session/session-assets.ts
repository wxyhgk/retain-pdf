// 职责 3（编排层）：本地展示状态（source/translated URL 与文件、title、
// regions/metadata、boot）+ 加载流程编排。解析决策与下载 fencing
// 已外包：
// - session-load-plan：document/job/source/artifact 的 typed resolution，
//   返回 discriminated load plan；
// - session-pdf-download：PDF 下载与 abort/stale fencing；
// - job-identity / job-status / reader-mode：窄命令（typed event），
//   本模块不再接收并直接调用一串 React setState setter。
// 网络语义、调用顺序、boot 文案与进度数字与拆分前逐行一致。

import { useEffect, useState } from "react";
import type { ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";
import {
  isMockMode,
  resolveResourceUrl,
  MOCK_DOCUMENT_SOURCE_PDF_URL,
  defaultReaderDataPort,
  resolveReaderArtifactUrl,
  resolveReaderSourcePdf,
  resolveReaderTranslatedPdfUrl,
  READER_PROGRESS_COPY,
  API_PREFIX,
  fetchDocumentByJobId,
} from "../../external.js";
import {
  normalizeReaderMetadata,
  normalizeReaderRegions,
  type ReaderMetadata,
  type ReaderRegion,
} from "../../shared/data/reader-regions.js";
import type {
  CommittedDocumentSource,
  LinkedDocumentRecord,
  ReaderMode,
  ReaderSessionState,
} from "./types.js";
import type { SessionIdentityEvent } from "./job-identity.js";
import {
  buildCommittedDocumentSourceUrl,
  pickDisplayTitle,
  postProgress,
  resolveJobDocumentId,
  setBootProgress,
} from "./session-helpers.js";
import {
  isStaleDocumentJobFailure,
  parseDocumentLink,
  planJobLoad,
  planSourceOnlyLoad,
  type DocumentLink,
} from "./session-load-plan.js";
import {
  createSessionLoadFence,
  downloadJobPdfs,
  downloadOnePdf,
} from "./session-pdf-download.js";

export type SessionAssets = {
  sourceUrl: string;
  translatedUrl: string;
  sourceFile: ProtectedPdfFile | null;
  translatedFile: ProtectedPdfFile | null;
  assetsReady: boolean;
  title: string;
  regions: ReaderRegion[];
  readerMetadata: ReaderMetadata;
  boot: ReaderSessionState["boot"];
};

export type SessionAssetCommands = {
  applyIdentityEvent: (event: SessionIdentityEvent) => void;
  publishPayload: (input: {
    jobPayload: Record<string, unknown> | null;
    manifestPayload: Record<string, unknown> | null;
    sessionIdentity: string;
  }) => void;
  clearPayload: (sessionIdentity: string) => void;
  switchSessionMode: (mode: ReaderMode) => void;
};

export function useSessionAssets(options: {
  sessionJobId: string;
  jobId: string;
  routeDocumentId: string;
  documentJobId: string;
  rejectedDocumentJobId: string;
  sourceOnly: boolean;
  locationKey: string;
  sessionIdentity: string;
  committedSource: CommittedDocumentSource | null;
  applyIdentityEvent: SessionAssetCommands["applyIdentityEvent"];
  publishPayload: SessionAssetCommands["publishPayload"];
  clearPayload: SessionAssetCommands["clearPayload"];
  switchSessionMode: SessionAssetCommands["switchSessionMode"];
  jobRefreshRevision: number;
  sessionEpochRef: React.MutableRefObject<{ identity: string; value: number }>;
  closingRef: React.MutableRefObject<boolean>;
  activeLoadAbortRef: React.MutableRefObject<AbortController | null>;
}): SessionAssets {
  const {
    sessionJobId,
    jobId,
    routeDocumentId,
    documentJobId,
    rejectedDocumentJobId,
    sourceOnly,
    locationKey,
    sessionIdentity,
    committedSource,
    applyIdentityEvent,
    publishPayload,
    clearPayload,
    switchSessionMode,
    jobRefreshRevision,
    sessionEpochRef,
    closingRef,
    activeLoadAbortRef,
  } = options;

  const [sourceUrl, setSourceUrl] = useState("");
  const [translatedUrl, setTranslatedUrl] = useState("");
  const [sourceFile, setSourceFile] = useState<ProtectedPdfFile | null>(null);
  const [translatedFile, setTranslatedFile] = useState<ProtectedPdfFile | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const [title, setTitle] = useState("");
  const [regions, setRegions] = useState<ReaderRegion[]>([]);
  const [readerMetadata, setReaderMetadata] = useState<ReaderMetadata>(() => ({
    source: null,
    translated: null,
  }));
  const [boot, setBoot] = useState<ReaderSessionState["boot"]>({
    loading: true,
    percent: 4,
    text: READER_PROGRESS_COPY.boot,
    stage: "progress",
    failed: false,
  });

  useEffect(() => {
    const abort = new AbortController();
    const sessionEpoch = sessionEpochRef.current.value;
    const fence = createSessionLoadFence({
      sessionEpochRef,
      closingRef,
      abort,
      sessionEpoch,
    });
    activeLoadAbortRef.current = abort;

    if (closingRef.current) {
      abort.abort();
      return () => {
        if (activeLoadAbortRef.current === abort) {
          activeLoadAbortRef.current = null;
        }
      };
    }

    function failBoot(text: string, progressText: string): void {
      fence.markFailed();
      setBoot({
        loading: false,
        percent: 100,
        text,
        stage: "failed",
        failed: true,
      });
      postProgress({ percent: 100, text: progressText, stage: "failed" });
    }

    function readyBoot(): void {
      setAssetsReady(true);
      setBoot({
        loading: false,
        percent: 100,
        text: READER_PROGRESS_COPY.ready,
        stage: "ready",
        failed: false,
      });
      postProgress({ percent: 100, text: READER_PROGRESS_COPY.ready, stage: "ready" });
    }

    function resolveSourceOnlyUrl(): string {
      return committedSource?.documentId
        ? buildCommittedDocumentSourceUrl(
          committedSource.documentId,
          committedSource.revision,
        )
        : isMockMode()
          ? MOCK_DOCUMENT_SOURCE_PDF_URL
          : resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(routeDocumentId)}/source.pdf`);
    }

    async function loadSourceOnlyDocument(): Promise<void> {
      // OCR 吸怪：document_id 直开时，若文档已有 active_job_id（OCR-only 已回填），则按 job 链路加载以提供 Markdown/译文
      let link: DocumentLink = { activeJobId: "", activeVersionId: "" };
      try {
        const docResp = await defaultReaderDataPort.fetchProtected(
          resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(routeDocumentId)}`),
        );
        if (docResp?.ok) {
          const docJson: unknown = await docResp.json().catch(() => null);
          link = parseDocumentLink(docJson);
        }
      } catch {
        /* ignore, fallback to pure source */
      }
      const plan = planSourceOnlyLoad({
        link,
        rejectedDocumentJobId,
        hasCommittedSource: Boolean(committedSource),
      });
      if (plan.kind === "follow-active-job") {
        if (fence.isInactive()) return;
        // 记录实际 job 后重新进入统一 job 加载分支。session 对外也必须暴露
        // 这个 id，否则 Markdown/AI/下载仍会把馆藏入口误判为纯源文档。
        applyIdentityEvent({
          type: "resolved-document-job",
          documentId: routeDocumentId,
          jobId: plan.jobId,
        });
        if (plan.activeVersionId) {
          if (!committedSource) {
            applyIdentityEvent({
              type: "committed-source",
              documentId: routeDocumentId,
              revision: plan.activeVersionId,
              sessionIdentity,
            });
          }
          switchSessionMode("source");
        } else {
          // Legacy document_id links should behave like canonical job links:
          // the first useful screen is the comparison workspace.
          switchSessionMode("compare");
        }
        return;
      }
      if (plan.kind === "open-committed-source") {
        if (fence.isInactive()) return;
        applyIdentityEvent({
          type: "committed-source",
          documentId: routeDocumentId,
          revision: plan.revision,
          sessionIdentity,
        });
        switchSessionMode("source");
        return;
      }
      const url = resolveSourceOnlyUrl();
      if (fence.isInactive()) return;
      setSourceUrl(url);
      setTranslatedUrl("");
      setTitle("");
      clearPayload(sessionIdentity);
      const file = await downloadOnePdf({
        url,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence,
        setBoot,
      });
      if (fence.isInactive()) return;
      if (!file) {
        failBoot("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
        return;
      }
      setSourceFile(file);
      readyBoot();
      // URL 锚点跳页见 useUrlAnchorJump（react-pdf 控制器）
    }

    async function loadJobSnapshots(): Promise<void> {
      // 显式 job_id 表示流水线的不可变阅读快照。即使所属文档后来被
      // Agent 修改，也必须继续加载该 job 自己配套的原文和译文；否则
      // 历史翻译任务会因为 document.active_version_id 而失去对照阅读。
      // Reader 当前会话内完成 Agent 提交时，refreshCommittedDocument
      // 会显式设置 committedDocumentSource，并切换到新的文档源版本。
      const payload = await defaultReaderDataPort.loadReaderPayload(sessionJobId);
      if (fence.isInactive()) return;
      let linkedDocument: LinkedDocumentRecord | null = null;
      if (jobId && !routeDocumentId) {
        try {
          linkedDocument = await fetchDocumentByJobId(API_PREFIX, sessionJobId) as LinkedDocumentRecord | null;
        } catch {
          // Standalone/package consumers may not provide document lookup.
        }
        if (fence.isInactive()) return;
      }
      const payloadDocumentId = resolveJobDocumentId(payload.jobPayload)
        || `${linkedDocument?.document_id || ""}`.trim();
      if (payloadDocumentId && !routeDocumentId) {
        applyIdentityEvent({
          type: "resolved-job-document",
          jobId: sessionJobId,
          documentId: payloadDocumentId,
        });
      }
      const plan = planJobLoad({
        payloadDocumentId,
        linkedActiveJobId: `${linkedDocument?.active_job_id || ""}`.trim(),
        linkedActiveVersionId: `${linkedDocument?.active_version_id || ""}`.trim(),
        sessionJobId,
        hasCommittedSource: Boolean(committedSource),
      });
      if (plan.kind === "restore-committed-source") {
        if (fence.isInactive()) return;
        applyIdentityEvent({
          type: "committed-source",
          documentId: plan.documentId,
          revision: plan.revision,
          sessionIdentity,
        });
        switchSessionMode("source");
        return;
      }

      const source = resolveReaderSourcePdf(payload.manifestPayload);
      const translated = resolveReaderTranslatedPdfUrl(payload.jobPayload, payload.manifestPayload);
      const resolvedSourceFinal = typeof source === "string"
        ? source
        : resolveReaderArtifactUrl(source);
      // OCR-only job 未必生成 PDF artifact；从 document_id 进入时继续使用
      // 馆藏源文件，同时保留真实 jobId 供 Markdown/AI 使用。
      const sourceDocumentId = routeDocumentId || payloadDocumentId;
      const sourceFinal = committedSource?.documentId
        ? buildCommittedDocumentSourceUrl(
          committedSource.documentId,
          committedSource.revision,
        )
        : resolvedSourceFinal || (sourceDocumentId
          ? resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(sourceDocumentId)}/source.pdf`)
          : "");
      // 文档操作产生的是新的源版本；旧 job 的译文、region 与 metadata
      // 仍对应旧页序，不能继续和新源文件并排显示。
      const translatedFinal = committedSource ? "" : translated || "";

      setSourceUrl(sourceFinal || "");
      setTranslatedUrl(translatedFinal);
      setTitle(pickDisplayTitle(payload.jobPayload as Record<string, unknown>, sessionJobId));
      publishPayload({
        jobPayload: (payload.jobPayload as Record<string, unknown>) || null,
        manifestPayload: (payload.manifestPayload as Record<string, unknown>) || null,
        sessionIdentity,
      });
      setRegions(committedSource ? [] : normalizeReaderRegions(payload.regionsPayload));
      setReaderMetadata(committedSource
        ? { source: null, translated: null }
        : normalizeReaderMetadata(payload.readerMetadata));

      if (!sourceFinal && !translatedFinal) {
        failBoot(READER_PROGRESS_COPY.failed, READER_PROGRESS_COPY.failed);
        return;
      }

      // 先下完所有 PDF，再允许界面挂载 Document
      const result = await downloadJobPdfs({
        sourceFinal: sourceFinal || "",
        translatedFinal,
        fence,
        setBoot,
      });
      if (result.status === "inactive") return;
      if (result.status === "incomplete") {
        failBoot("PDF 下载失败，请重试", "PDF 下载失败");
        return;
      }

      setSourceFile(result.sourceBytes);
      setTranslatedFile(result.translatedBytes);
      readyBoot();
      // URL 锚点跳页见 useUrlAnchorJump（react-pdf 控制器）
    }

    async function load() {
      setAssetsReady(false);
      setSourceFile(null);
      setTranslatedFile(null);
      setRegions([]);
      setReaderMetadata({ source: null, translated: null });
      setBootProgress(setBoot, 8, READER_PROGRESS_COPY.metadata, "metadata");

      try {
        if (sourceOnly) {
          await loadSourceOnlyDocument();
          return;
        }

        if (!sessionJobId) {
          failBoot(READER_PROGRESS_COPY.failed, READER_PROGRESS_COPY.failed);
          return;
        }

        await loadJobSnapshots();
      } catch (err) {
        if (fence.isClosedOrStale()) return;
        // AbortError from fetch is not a real failure
        if ((err as Error)?.name === "AbortError") return;
        // Promise.all rejects on the first failed PDF. Fence the still-running
        // sibling download before publishing the failure so it cannot later
        // overwrite this terminal state with another progress update.
        fence.markFailed();
        const status = Number((err as Error & { status?: number })?.status);
        if (isStaleDocumentJobFailure({
          status,
          jobId,
          routeDocumentId,
          documentJobId,
          sessionJobId,
        })) {
          // A document may retain an active_job_id after the task DB was
          // replaced or cleaned. Reject that one stale link for this document
          // and immediately reopen its still-valid source PDF instead of
          // presenting a fatal "job not found" screen.
          applyIdentityEvent({ type: "missing-document-job", documentId: routeDocumentId, jobId: sessionJobId });
          applyIdentityEvent({ type: "cleared-resolved-document-job" });
          switchSessionMode("source");
          return;
        }
        const text = err instanceof Error ? err.message : READER_PROGRESS_COPY.failed;
        failBoot(text, text);
      }
    }

    void load();
    return () => {
      abort.abort();
      if (activeLoadAbortRef.current === abort) {
        activeLoadAbortRef.current = null;
      }
    };
  }, [sessionJobId, routeDocumentId, documentJobId, rejectedDocumentJobId, sourceOnly, locationKey, committedSource, jobRefreshRevision, jobId, sessionIdentity, applyIdentityEvent, publishPayload, clearPayload, switchSessionMode]);

  return {
    sourceUrl,
    translatedUrl,
    sourceFile,
    translatedFile,
    assetsReady,
    title,
    regions,
    readerMetadata,
    boot,
  };
}
