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
import { documentSourcePdfPath } from "@retainpdf/domain/job";
import type { ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";
import {
  isMockMode,
  MOCK_DOCUMENT_SOURCE_PDF_URL,
  readerSessionDataPort,
  READER_PROGRESS_COPY,
  API_PREFIX,
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
  ReaderOptionalArtifactErrors,
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
  expiredMergedReadingDocumentId,
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
import { reopenExpiredMergedReading } from "./merged-reading-recovery.js";

export type SessionAssets = {
  sourceUrl: string;
  translatedUrl: string;
  sourceFile: ProtectedPdfFile | null;
  translatedFile: ProtectedPdfFile | null;
  assetsReady: boolean;
  title: string;
  regions: ReaderRegion[];
  readerMetadata: ReaderMetadata;
  readerErrors: ReaderOptionalArtifactErrors;
  boot: ReaderSessionState["boot"];
};

const NO_OPTIONAL_ARTIFACT_ERRORS: ReaderOptionalArtifactErrors = {
  regions: null,
  metadata: null,
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
  const [readerErrors, setReaderErrors] = useState<ReaderOptionalArtifactErrors>(
    NO_OPTIONAL_ARTIFACT_ERRORS,
  );
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
    const dataPort = readerSessionDataPort();

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
          : dataPort.resolveResourceUrl(documentSourcePdfPath(routeDocumentId));
    }

    async function loadSourceOnlyDocument(): Promise<void> {
      // OCR 吸怪：document_id 直开时，若文档已有 active_job_id（OCR-only 已回填），则按 job 链路加载以提供 Markdown/译文
      let link: DocumentLink = { activeJobId: "", activeVersionId: "" };
      try {
        const doc = await dataPort.fetchDocument?.(routeDocumentId);
        if (doc) link = parseDocumentLink(doc);
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
      // committedSource 分支会丢弃 regions/metadata（旧页序已失效），
      // 直接跳过这两个可选请求，避免无效网络往返。
      const wantOptional = !committedSource;
      // 宿主能单独给可选产物时，snapshot 只取 job / manifest，regions / metadata
      // 并行另取：PDF 地址只依赖前者，下载不必排在 regions（可达数百 KB）后面。
      // loadReaderOptionalArtifacts 永不 reject（失败降级进 readerErrors）。
      const splitOptional = Boolean(
        wantOptional && dataPort.loadSessionSnapshot && dataPort.loadReaderOptionalArtifacts,
      );
      const optionalPromise = splitOptional
        ? dataPort.loadReaderOptionalArtifacts!(sessionJobId)
        : null;
      const snapshot = await dataPort.loadSessionSnapshot?.({
        jobId: sessionJobId,
        documentId: routeDocumentId,
        routeDocumentId,
        committedSource,
        includeOptionalArtifacts: wantOptional && !splitOptional,
      });
      const payload = snapshot ? {
        jobPayload: snapshot.sourcePayload,
        manifestPayload: snapshot.manifestPayload,
        readerMetadata: snapshot.readerMetadata,
        regionsPayload: snapshot.regions,
        readerErrors: snapshot.readerErrors,
      } : await dataPort.loadReaderPayload(sessionJobId, {
        includeOptionalArtifacts: wantOptional,
      });
      if (fence.isInactive()) return;
      let linkedDocument: LinkedDocumentRecord | null = null;
      if (jobId && !routeDocumentId) {
        if (snapshot && snapshot.linkedDocument !== undefined) {
          // 宿主在 snapshot 里已经查过（和 job / manifest 并行），不再串行查第二遍。
          linkedDocument = snapshot.linkedDocument;
        } else {
          try {
            linkedDocument = await dataPort.fetchDocumentByJobId(API_PREFIX, sessionJobId) as LinkedDocumentRecord | null;
          } catch {
            // Standalone/package consumers may not provide document lookup.
          }
          if (fence.isInactive()) return;
        }
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

      const source = dataPort.resolveReaderSourcePdf(payload.manifestPayload);
      const translated = dataPort.resolveReaderTranslatedPdfUrl(payload.jobPayload, payload.manifestPayload);
      const resolvedSourceFinal = typeof source === "string"
        ? source
        : dataPort.resolveReaderArtifactUrl(source);
      // OCR-only job 未必生成 PDF artifact；从 document_id 进入时继续使用
      // 馆藏源文件，同时保留真实 jobId 供 Markdown/AI 使用。
      const sourceDocumentId = routeDocumentId || payloadDocumentId;
      const sourceFinal = committedSource?.documentId
        ? buildCommittedDocumentSourceUrl(
          committedSource.documentId,
          committedSource.revision,
        )
        : resolvedSourceFinal || (sourceDocumentId
          ? dataPort.resolveResourceUrl(documentSourcePdfPath(sourceDocumentId))
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
      // 拆开加载可选产物时，PDF 下载先发出去，再等 regions / metadata —— 两者并行。
      // 下载的失败要等发布完可选产物后在下面的 await 里照旧抛出；先挂一个空
      // catch，免得等 regions 的这段时间里被当成未处理的 rejection。
      const startDownloads = () => downloadJobPdfs({
        sourceFinal: sourceFinal || "",
        translatedFinal,
        fence,
        setBoot,
      });
      const hasPdf = Boolean(sourceFinal || translatedFinal);
      const earlyDownload = optionalPromise && hasPdf ? startDownloads() : null;
      earlyDownload?.catch(() => {});
      const optional = optionalPromise ? await optionalPromise : payload;
      // 被关闭 / 换会话：已发出的下载会被同一个 abort 掐掉，它的 rejection 已被上面吞掉。
      if (fence.isInactive()) return;

      setRegions(committedSource ? [] : normalizeReaderRegions(optional.regionsPayload));
      setReaderMetadata(committedSource
        ? { source: null, translated: null }
        : normalizeReaderMetadata(optional.readerMetadata));
      setReaderErrors(committedSource
        ? NO_OPTIONAL_ARTIFACT_ERRORS
        : optional.readerErrors ?? NO_OPTIONAL_ARTIFACT_ERRORS);

      if (!hasPdf) {
        failBoot(READER_PROGRESS_COPY.failed, READER_PROGRESS_COPY.failed);
        return;
      }

      // 先下完所有 PDF，再允许界面挂载 Document
      const result = await (earlyDownload ?? startDownloads());
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
      setReaderErrors(NO_OPTIONAL_ARTIFACT_ERRORS);
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
        const reason = `${(err as Error & { reason?: string })?.reason || ""}`;
        const expiredMergeDocumentId = expiredMergedReadingDocumentId({ status, reason, sessionJobId });
        if (expiredMergeDocumentId) {
          // 合并阅读的临时目录被清理了：按书号重新问阅读入口，换成新编号重开（见 merged-reading-recovery）。
          const reopened = await reopenExpiredMergedReading({
            apiPrefix: API_PREFIX,
            documentId: expiredMergeDocumentId,
            expiredJobId: sessionJobId,
          });
          if (reopened || fence.isClosedOrStale()) return;
        }
        if (isStaleDocumentJobFailure({
          status,
          reason,
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
    readerErrors,
    boot,
  };
}
