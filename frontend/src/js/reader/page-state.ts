export const READER_PROGRESS_COPY = Object.freeze({
  boot: "Đang chuẩn bị đọc đối chiếu…",
  metadata: "Đang đọc thông tin nhiệm vụ…",
  both: "Đang tải PDF gốc và PDF dịch…",
  sourceOnly: "PDF gốc đã tải xong, đang tải PDF dịch…",
  translatedOnly: "PDF dịch đã tải xong, đang tải PDF gốc…",
  ready: "Đọc đối chiếu đã sẵn sàng",
  failed: "Tải đọc đối chiếu thất bại",
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

export function resetReaderProgressState(state) {
  if (!state?.progress) {
    return;
  }
  state.progress.metadataReady = false;
  state.progress.sourceDone = false;
  state.progress.translatedDone = false;
}

export function computeReaderProgressSnapshot(
  progressState,
  copy = READER_PROGRESS_COPY,
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
