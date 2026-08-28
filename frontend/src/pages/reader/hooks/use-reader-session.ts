// Session đọc React:
// 1) Resolve job/document -> URL
// 2) Tải xong toàn bộ PDF gốc/bản dịch (overlay chưa tắt)
// 3) Sau đó mới hiển thị reader; các tối ưu render page nhìn thấy chạy sau khi đã hiển thị.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadProtectedPdfFile,
  type ProtectedPdfFile,
} from "../pdf/useProtectedPdfFile.js";
import {
  isMockMode,
  resolveResourceUrl,
  MOCK_DOCUMENT_SOURCE_PDF_URL,
  READER_DIALOG_MESSAGES,
  defaultReaderDataPort,
  defaultReaderPageConfigPort,
  resolveReaderDocumentId,
  resolveReaderJobId,
  resolveReaderArtifactUrl,
  resolveReaderSourcePdf,
  resolveReaderTranslatedPdfUrl,
  READER_PROGRESS_COPY,
} from "../external.js";

export type ReaderMode = "source" | "translated" | "compare";

/** Download context giống legacy ReaderDownloadMenu. */
export type ReaderDownloadContext = {
  fetchProtected: typeof defaultReaderDataPort.fetchProtected;
  jobId: string;
  jobPayload: Record<string, unknown> | null;
  manifestPayload: Record<string, unknown> | null;
  /** Khi chỉ đọc thư viện và không có job, dùng trực tiếp URL đã resolve. */
  sourceUrl: string;
  translatedUrl: string;
  sourceOnly: boolean;
};

export type ReaderSessionState = {
  jobId: string;
  documentId: string;
  sourceOnly: boolean;
  mode: ReaderMode;
  setMode: (mode: ReaderMode) => void;
  sourceUrl: string;
  translatedUrl: string;
  /** Bytes PDF đã predownload; sẵn sàng trước khi hiển thị. */
  sourceFile: ProtectedPdfFile | null;
  translatedFile: ProtectedPdfFile | null;
  /** Tải xong, có thể mount Document. */
  assetsReady: boolean;
  boot: {
    loading: boolean;
    percent: number;
    text: string;
    stage: string;
    failed: boolean;
  };
  // display title; react chrome currently does not render it
  title: string;
  download: ReaderDownloadContext;
};

/** Keep body `reader-mode-*` in sync (legacy CSS + chrome). */
function applyBodyReaderMode(mode: ReaderMode) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare",
  );
  document.body.classList.add(`reader-mode-${mode}`);
}

function isJobIdLikeTitle(title: string, jobId = "") {
  const t = `${title || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  if (!t) return true;
  if (id && (t === id || t === `${id}.pdf`)) return true;
  if (/^\d{8,14}-[0-9a-f]{4,}$/i.test(t)) return true;
  return false;
}

function pickDisplayTitle(jobPayload: Record<string, unknown> | null | undefined, jobId: string) {
  const candidates = [
    jobPayload?.title,
    jobPayload?.display_name,
    jobPayload?.source_file_name,
    (jobPayload as { book_summary?: { source_file_name?: string } } | null)?.book_summary?.source_file_name,
  ];
  for (const raw of candidates) {
    const text = `${raw || ""}`.trim();
    if (text && !isJobIdLikeTitle(text, jobId)) {
      return text.replace(/\.pdf$/i, "");
    }
  }
  return "";
}

function postProgress({
  percent,
  text,
  stage,
}: {
  percent: number;
  text: string;
  stage: string;
}) {
  try {
    window.parent?.postMessage(
      {
        type: READER_DIALOG_MESSAGES.progress,
        stage,
        percent,
        text,
      },
      defaultReaderPageConfigPort.messageTargetOrigin(),
    );
  } catch {
    // ignore
  }
}

type BootState = ReaderSessionState["boot"];

function setBootProgress(
  setBoot: (value: BootState | ((prev: BootState) => BootState)) => void,
  percent: number,
  text: string,
  stage = "progress",
) {
  setBoot({
    loading: true,
    percent,
    text,
    stage,
    failed: false,
  });
  postProgress({ percent, text, stage });
}

export function useReaderSession(): ReaderSessionState {
  const jobId = useMemo(() => resolveReaderJobId(defaultReaderPageConfigPort), []);
  const documentId = useMemo(
    () => (jobId ? "" : resolveReaderDocumentId()),
    [jobId],
  );
  const sourceOnly = Boolean(documentId) && !jobId;

  const [mode, setModeState] = useState<ReaderMode>(sourceOnly ? "source" : "compare");
  const [sourceUrl, setSourceUrl] = useState("");
  const [translatedUrl, setTranslatedUrl] = useState("");
  const [sourceFile, setSourceFile] = useState<ProtectedPdfFile | null>(null);
  const [translatedFile, setTranslatedFile] = useState<ProtectedPdfFile | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const [title, setTitle] = useState("");
  const [jobPayload, setJobPayload] = useState<Record<string, unknown> | null>(null);
  const [manifestPayload, setManifestPayload] = useState<Record<string, unknown> | null>(null);
  const [boot, setBoot] = useState<ReaderSessionState["boot"]>({
    loading: true,
    percent: 4,
    text: READER_PROGRESS_COPY.boot,
    stage: "progress",
    failed: false,
  });

  const setMode = useCallback((next: ReaderMode) => {
    if (sourceOnly && next !== "source") {
      return;
    }
    setModeState(next);
    applyBodyReaderMode(next);
  }, [sourceOnly]);

  useEffect(() => {
    if (sourceOnly) {
      document.documentElement.classList.add("reader-source-only");
    }
    applyBodyReaderMode(mode);
    return () => {
      document.documentElement.classList.remove("reader-source-only");
    };
  }, [sourceOnly, mode]);

  useEffect(() => {
    let cancelled = false;

    async function downloadOne(
      url: string,
      label: string,
      percentStart: number,
      percentEnd: number,
    ): Promise<ProtectedPdfFile | null> {
      if (!url) {
        return null;
      }
      setBootProgress(setBoot, percentStart, label, "download");
      const file = await loadProtectedPdfFile(url, defaultReaderDataPort.fetchProtected);
      if (cancelled) {
        return null;
      }
      setBootProgress(setBoot, percentEnd, label, "download");
      return file;
    }

    async function load() {
      setAssetsReady(false);
      setSourceFile(null);
      setTranslatedFile(null);
      setBootProgress(setBoot, 8, READER_PROGRESS_COPY.metadata, "metadata");

      try {
        if (sourceOnly) {
          const url = isMockMode()
            ? MOCK_DOCUMENT_SOURCE_PDF_URL
            : resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(documentId)}/source.pdf`);
          if (cancelled) return;
          setSourceUrl(url);
          setTranslatedUrl("");
          setTitle("");
          setJobPayload(null);
          setManifestPayload(null);
          const file = await downloadOne(url, "Đang tải PDF gốc...", 30, 85);
          if (cancelled) return;
          if (!file) {
            setBoot({
              loading: false,
              percent: 100,
              text: "Tệp nguồn không khả dụng: tài liệu này không có PDF gốc có thể đọc.",
              stage: "failed",
              failed: true,
            });
            postProgress({ percent: 100, text: "Tải tệp nguồn thất bại", stage: "failed" });
            return;
          }
          setSourceFile(file);
          setAssetsReady(true);
          setBoot({
            loading: false,
            percent: 100,
            text: READER_PROGRESS_COPY.ready,
            stage: "ready",
            failed: false,
          });
          postProgress({ percent: 100, text: READER_PROGRESS_COPY.ready, stage: "ready" });
          // Nhảy trang theo URL anchor nằm ở useUrlAnchorJump (controller react-pdf).
          return;
        }

        if (!jobId) {
          setBoot({
            loading: false,
            percent: 100,
            text: READER_PROGRESS_COPY.failed,
            stage: "failed",
            failed: true,
          });
          postProgress({ percent: 100, text: READER_PROGRESS_COPY.failed, stage: "failed" });
          return;
        }

        const payload = await defaultReaderDataPort.loadReaderPayload(jobId);
        if (cancelled) return;

        const source = resolveReaderSourcePdf(payload.manifestPayload);
        const translated = resolveReaderTranslatedPdfUrl(payload.jobPayload, payload.manifestPayload);
        const sourceFinal = typeof source === "string"
          ? source
          : resolveReaderArtifactUrl(source);
        const translatedFinal = translated || "";

        setSourceUrl(sourceFinal || "");
        setTranslatedUrl(translatedFinal);
        setTitle(pickDisplayTitle(payload.jobPayload as Record<string, unknown>, jobId));
        setJobPayload((payload.jobPayload as Record<string, unknown>) || null);
        setManifestPayload((payload.manifestPayload as Record<string, unknown>) || null);

        if (!sourceFinal && !translatedFinal) {
          setBoot({
            loading: false,
            percent: 100,
            text: READER_PROGRESS_COPY.failed,
            stage: "failed",
            failed: true,
          });
          postProgress({ percent: 100, text: READER_PROGRESS_COPY.failed, stage: "failed" });
          return;
        }

        // Tải xong tất cả PDF trước, rồi mới cho UI mount Document.
        setBootProgress(setBoot, 25, "Đang tải PDF...", "download");
        const tasks: Promise<void>[] = [];
        let sourceBytes: ProtectedPdfFile | null = null;
        let translatedBytes: ProtectedPdfFile | null = null;

        if (sourceFinal) {
          tasks.push(
            downloadOne(sourceFinal, "Đang tải PDF gốc...", 30, 55).then((f) => {
              sourceBytes = f;
            }),
          );
        }
        if (translatedFinal) {
          tasks.push(
            downloadOne(translatedFinal, "Đang tải PDF bản dịch...", 55, 85).then((f) => {
              translatedBytes = f;
            }),
          );
        }
        await Promise.all(tasks);
        if (cancelled) return;

        const needSource = Boolean(sourceFinal);
        const needTranslated = Boolean(translatedFinal);
        if ((needSource && !sourceBytes) || (needTranslated && !translatedBytes)) {
          setBoot({
            loading: false,
            percent: 100,
            text: "Tải PDF thất bại, vui lòng thử lại",
            stage: "failed",
            failed: true,
          });
          postProgress({ percent: 100, text: "Tải PDF thất bại", stage: "failed" });
          return;
        }

        setSourceFile(sourceBytes);
        setTranslatedFile(translatedBytes);
        setAssetsReady(true);
        setBoot({
          loading: false,
          percent: 100,
          text: READER_PROGRESS_COPY.ready,
          stage: "ready",
          failed: false,
        });
        postProgress({ percent: 100, text: READER_PROGRESS_COPY.ready, stage: "ready" });
        // Nhảy trang theo URL anchor nằm ở useUrlAnchorJump (controller react-pdf).
      } catch (err) {
        if (cancelled) return;
        const text = err instanceof Error ? err.message : READER_PROGRESS_COPY.failed;
        setBoot({
          loading: false,
          percent: 100,
          text,
          stage: "failed",
          failed: true,
        });
        postProgress({ percent: 100, text, stage: "failed" });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [jobId, documentId, sourceOnly]);

  const download = useMemo<ReaderDownloadContext>(
    () => ({
      fetchProtected: defaultReaderDataPort.fetchProtected,
      jobId,
      jobPayload,
      manifestPayload,
      sourceUrl,
      translatedUrl,
      sourceOnly,
    }),
    [jobId, jobPayload, manifestPayload, sourceUrl, translatedUrl, sourceOnly],
  );

  return {
    jobId,
    documentId,
    sourceOnly,
    mode,
    setMode,
    sourceUrl,
    translatedUrl,
    sourceFile,
    translatedFile,
    assetsReady,
    boot,
    title,
    download,
  };
}
