// PDF 下载与 abort/stale fencing。
// 本模块只负责“字节下载 + 存活栅栏”，不写任何展示状态：
// boot 文案与 assetsReady/sourceFile 的发布仍由 useSessionAssets（编排层）决定。
// 语义与拆分前 session-assets.ts 内联实现一致：
// - 双 PDF 全部下载完成才返回；兄弟下载用 loadFailed 栅栏互斥；
// - Promise.all 首个失败直接抛给调用方，调用方先 markFailed 再发布终态，
//   迟到的兄弟下载随后因 isInactive() 返回 null，不再覆盖终态。

import {
  loadProtectedPdfFile,
  type ProtectedPdfFile,
} from "../../pdf/useProtectedPdfFile.js";
import { defaultReaderDataPort } from "../../external.js";
import { setBootProgress } from "./session-helpers.js";
import type { BootState } from "./types.js";

export type BootSetter = React.Dispatch<React.SetStateAction<BootState>>;

export type SessionLoadFence = {
  readonly signal: AbortSignal;
  isClosedOrStale: () => boolean;
  isInactive: () => boolean;
  markFailed: () => void;
};

export function createSessionLoadFence(options: {
  sessionEpochRef: React.MutableRefObject<{ identity: string; value: number }>;
  closingRef: React.MutableRefObject<boolean>;
  abort: AbortController;
  sessionEpoch: number;
}): SessionLoadFence {
  const { sessionEpochRef, closingRef, abort, sessionEpoch } = options;
  let loadFailed = false;
  const isClosedOrStale = () => abort.signal.aborted
    || closingRef.current
    || sessionEpochRef.current.value !== sessionEpoch;
  return {
    signal: abort.signal,
    isClosedOrStale,
    isInactive: () => loadFailed || isClosedOrStale(),
    markFailed: () => {
      loadFailed = true;
    },
  };
}

export async function downloadOnePdf(options: {
  url: string;
  label: string;
  percentStart: number;
  percentEnd: number;
  fence: SessionLoadFence;
  setBoot: BootSetter;
}): Promise<ProtectedPdfFile | null> {
  const { url, label, percentStart, percentEnd, fence, setBoot } = options;
  if (!url) {
    return null;
  }
  if (fence.isInactive()) {
    return null;
  }
  setBootProgress(setBoot, percentStart, label, "download");
  const file = await loadProtectedPdfFile(url, defaultReaderDataPort.fetchProtected, {
    signal: fence.signal,
  });
  if (fence.isInactive()) {
    return null;
  }
  setBootProgress(setBoot, percentEnd, label, "download");
  return file;
}

export type JobPdfDownloadResult =
  | {
    status: "downloaded";
    sourceBytes: ProtectedPdfFile | null;
    translatedBytes: ProtectedPdfFile | null;
  }
  | { status: "inactive" }
  /** 需要的 PDF 未取到字节（调用方发布“PDF 下载失败，请重试”终态）。 */
  | { status: "incomplete" };

/** 先下完所有 PDF 再返回；任一下载抛错时直接抛给调用方处理。 */
export async function downloadJobPdfs(options: {
  sourceFinal: string;
  translatedFinal: string;
  fence: SessionLoadFence;
  setBoot: BootSetter;
}): Promise<JobPdfDownloadResult> {
  const { sourceFinal, translatedFinal, fence, setBoot } = options;
  setBootProgress(setBoot, 25, "正在下载 PDF…", "download");
  const tasks: Promise<void>[] = [];
  let sourceBytes: ProtectedPdfFile | null = null;
  let translatedBytes: ProtectedPdfFile | null = null;

  if (sourceFinal) {
    tasks.push(
      downloadOnePdf({
        url: sourceFinal,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 55,
        fence,
        setBoot,
      }).then((file) => {
        sourceBytes = file;
      }),
    );
  }
  if (translatedFinal) {
    tasks.push(
      downloadOnePdf({
        url: translatedFinal,
        label: "正在下载译文 PDF…",
        percentStart: 55,
        percentEnd: 85,
        fence,
        setBoot,
      }).then((file) => {
        translatedBytes = file;
      }),
    );
  }
  await Promise.all(tasks);
  if (fence.isInactive()) {
    return { status: "inactive" };
  }

  const needSource = Boolean(sourceFinal);
  const needTranslated = Boolean(translatedFinal);
  if ((needSource && !sourceBytes) || (needTranslated && !translatedBytes)) {
    return { status: "incomplete" };
  }
  return { status: "downloaded", sourceBytes, translatedBytes };
}
