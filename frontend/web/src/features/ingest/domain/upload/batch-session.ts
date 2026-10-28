// 一次上传多本的会话（纯逻辑，不碰 React）：一本一本地传，传完以后用同一套选项一起交。
//
// - 按顺序传，同时只传一本：几十本一起传会把带宽和后端都占满，单本的进度也看不清。
// - 上传本身就会把书收进书库（和单本一样），所以「只收进书库」不用再发请求。
// - 关掉弹窗（dispose）以后不再开始传下一本；正在传的那本照样传完、留在书库里。
// - 交任务时没交上的（后端拒收、出错）留在列表里，可以再交一次；交上的不会重复交。

import type { BatchUploadedFile } from "./batch-file-upload.js";

export type BatchItemStatus =
  | "waiting"
  | "uploading"
  | "uploaded"
  | "upload_failed"
  | "submitting"
  | "submitted"
  | "submit_failed";

export type BatchItem = {
  key: string;
  name: string;
  status: BatchItemStatus;
  /** 上传进度 0–100。 */
  progress: number;
  pageCount: number;
  uploadId: string;
  /** 失败原因，或交上以后的任务编号说明。 */
  message: string;
};

export type BatchState = {
  items: BatchItem[];
  submitting: boolean;
};

export type BatchSubmitOutcome = { ok: true; jobId: string } | { ok: false; message: string };

export type BatchSessionDeps = {
  uploadFile: (file: File, onProgress?: (loaded: number, total: number) => void) => Promise<BatchUploadedFile>;
  submitBatch: (
    uploadIds: string[],
    onItem: (uploadId: string, result: BatchSubmitOutcome) => void,
  ) => Promise<{ status: string; submitted: number; failed: number }>;
};

export type BatchSummary = {
  total: number;
  uploading: boolean;
  /** 传上了、还没交上的（包括上次没交上的）。 */
  readyToSubmit: number;
  uploadFailed: number;
  submitted: number;
  submitFailed: number;
};

export function summarizeBatch(state: BatchState): BatchSummary {
  const count = (...statuses: BatchItemStatus[]) => state.items.filter((item) => statuses.includes(item.status)).length;
  return {
    total: state.items.length,
    uploading: count("waiting", "uploading") > 0,
    readyToSubmit: count("uploaded", "submit_failed"),
    uploadFailed: count("upload_failed"),
    submitted: count("submitted"),
    submitFailed: count("submit_failed"),
  };
}

function errorText(err: unknown) {
  return `${(err as { message?: string } | null)?.message || err || "上传失败"}`.trim();
}

export function createBatchUploadSession({ uploadFile, submitBatch }: BatchSessionDeps) {
  let state: BatchState = { items: [], submitting: false };
  let files = new Map<string, File>();
  const listeners = new Set<(snapshot: BatchState) => void>();
  let disposed = false;
  let uploadLoop: Promise<void> | null = null;

  function setState(next: BatchState) {
    state = next;
    for (const listener of listeners) listener(state);
  }

  function patchItem(key: string, patch: Partial<BatchItem>) {
    setState({ ...state, items: state.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) });
  }

  async function uploadAll() {
    for (;;) {
      if (disposed) return;
      const next = state.items.find((item) => item.status === "waiting");
      if (!next) return;
      const file = files.get(next.key);
      if (!file) {
        patchItem(next.key, { status: "upload_failed", message: "找不到这个文件" });
        continue;
      }
      patchItem(next.key, { status: "uploading", progress: 0, message: "" });
      try {
        const uploaded = await uploadFile(file, (loaded, total) => {
          if (total > 0) patchItem(next.key, { progress: Math.min(100, Math.round((loaded / total) * 100)) });
        });
        files.delete(next.key);
        patchItem(next.key, {
          status: "uploaded",
          progress: 100,
          pageCount: uploaded.pageCount,
          uploadId: uploaded.uploadId,
          name: uploaded.fileName || next.name,
        });
      } catch (err) {
        files.delete(next.key);
        patchItem(next.key, { status: "upload_failed", message: errorText(err) });
      }
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: (snapshot: BatchState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** 换一批文件重新开始。 */
    start(selected: File[]) {
      files = new Map();
      const items = selected.map((file, index) => {
        const key = `${index}:${file.name}:${file.size}`;
        files.set(key, file);
        return { key, name: file.name, status: "waiting" as const, progress: 0, pageCount: 0, uploadId: "", message: "" };
      });
      setState({ items, submitting: false });
      uploadLoop = uploadAll().finally(() => {
        uploadLoop = null;
      });
      return uploadLoop;
    },
    /** 把传上了、还没交上的一起交。返回后端的汇总；全交上了 allSubmitted 为 true。 */
    async submit() {
      if (state.submitting) return null;
      const targets = state.items.filter((item) => item.status === "uploaded" || item.status === "submit_failed");
      if (!targets.length) return null;
      setState({
        submitting: true,
        items: state.items.map((item) => (targets.includes(item) ? { ...item, status: "submitting" as const, message: "" } : item)),
      });
      const byUploadId = new Map(targets.map((item) => [item.uploadId, item.key]));
      try {
        const result = await submitBatch(targets.map((item) => item.uploadId), (uploadId, outcome) => {
          const key = byUploadId.get(uploadId);
          if (!key) return;
          // tsconfig 不是 strict，ok 的真假收窄不了联合类型，按字段判断。
          patchItem(key, "message" in outcome
            ? { status: "submit_failed", message: outcome.message }
            : { status: "submitted", message: "" });
        });
        // 被就绪校验拦下（没配凭据之类）：一本都没交，回到可以再交的状态，原因在弹窗的错误框里。
        if (result.status === "blocked") {
          setState({
            submitting: false,
            items: state.items.map((item) => (item.status === "submitting" ? { ...item, status: "uploaded" as const } : item)),
          });
          return { ...result, allSubmitted: false };
        }
        setState({ ...state, submitting: false });
        return { ...result, allSubmitted: summarizeBatch(state).readyToSubmit === 0 && result.failed === 0 };
      } catch (err) {
        setState({
          submitting: false,
          items: state.items.map((item) => (item.status === "submitting"
            ? { ...item, status: "submit_failed" as const, message: errorText(err) }
            : item)),
        });
        return { status: "error", submitted: 0, failed: targets.length, allSubmitted: false };
      }
    },
    /** 等当前这一轮上传结束（测试用）。 */
    whenUploadsSettled: () => uploadLoop ?? Promise.resolve(),
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
}

export type BatchUploadSession = ReturnType<typeof createBatchUploadSession>;
