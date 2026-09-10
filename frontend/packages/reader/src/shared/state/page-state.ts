// 共享真值（原 frontend/web/src/js/reader/page-state.ts），纯常量 + 纯函数，无外部依赖
export const READER_PROGRESS_COPY = Object.freeze({
  boot: "正在准备对照阅读…",
  metadata: "正在读取任务信息…",
  both: "正在加载原始 PDF 和译文 PDF…",
  sourceOnly: "原始 PDF 已加载，正在加载译文 PDF…",
  translatedOnly: "译文 PDF 已加载，正在加载原始 PDF…",
  ready: "对照阅读已就绪",
  failed: "对照阅读加载失败",
});

export function createReaderPageState() {
  return {
    reader: {
      totalPages: 0,
      currentPage: 0,
      primaryViewerKey: "",
    },
    progress: {
      metadataReady: false,
      sourceDone: false,
      translatedDone: false,
    },
    bootProgressBar: {
      value: 0,
      target: 0,
      rafId: 0,
    },
  };
}

export function resetReaderProgressState(state: any) {
  if (!state?.progress) {
    return;
  }
  state.progress.metadataReady = false;
  state.progress.sourceDone = false;
  state.progress.translatedDone = false;
}

export function computeReaderProgressSnapshot(
  progressState: any,
  copy: any = READER_PROGRESS_COPY,
) {
  if (!progressState?.metadataReady) {
    return { percent: 8, text: copy.boot, stage: "boot" };
  }
  const completedPdfs = Number(progressState.sourceDone) + Number(progressState.translatedDone);
  const percent = 24 + completedPdfs * 30;
  if (completedPdfs === 0) {
    return { percent, text: copy.both, stage: "pdfs" };
  }
  if (completedPdfs === 1) {
    return {
      percent,
      text: progressState.sourceDone ? copy.sourceOnly : copy.translatedOnly,
      stage: "pdfs",
    };
  }
  return { percent: 92, text: copy.ready, stage: "readying" };
}
