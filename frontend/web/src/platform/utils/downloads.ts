/** File System Access API 的保存对话框入口（lib.dom 未收录，这里按运行时用到的最小形状声明）。 */
type WindowWithFilePicker = Window & {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<unknown>;
};

function canStreamToLocalFile() {
  return typeof window !== "undefined"
    && typeof (window as WindowWithFilePicker).showSaveFilePicker === "function"
    && typeof WritableStream !== "undefined";
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function sanitizeSuggestedName(filename) {
  const normalized = `${filename || "download"}`.trim() || "download";
  return normalized.replace(/[\\/:*?"<>|]+/g, "_");
}

function normalizeTotalBytes(response) {
  const headerValue = response?.headers?.get?.("content-length") || "";
  const totalBytes = Number(headerValue);
  return Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : NaN;
}

function emitProgress(onProgress, payload) {
  if (typeof onProgress === "function") {
    onProgress(payload);
  }
}

async function collectResponseBlob(response, { filename, totalBytes, onProgress }) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const blob = await response.blob();
    emitProgress(onProgress, {
      filename,
      receivedBytes: blob.size,
      totalBytes,
      percent: Number.isFinite(totalBytes) && totalBytes > 0
        ? Math.min(100, (blob.size / totalBytes) * 100)
        : NaN,
      done: true,
    });
    return blob;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    chunks.push(value);
    receivedBytes += value.byteLength;
    emitProgress(onProgress, {
      filename,
      receivedBytes,
      totalBytes,
      percent: Number.isFinite(totalBytes) && totalBytes > 0
        ? Math.min(100, (receivedBytes / totalBytes) * 100)
        : NaN,
      done: false,
    });
  }

  emitProgress(onProgress, {
    filename,
    receivedBytes,
    totalBytes,
    percent: 100,
    done: true,
  });
  return new Blob(chunks);
}

async function writeResponseStream(response, writable, { filename, totalBytes, onProgress }) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const blob = await response.blob();
    await writable.write(blob);
    await writable.close();
    emitProgress(onProgress, {
      filename,
      receivedBytes: blob.size,
      totalBytes,
      percent: Number.isFinite(totalBytes) && totalBytes > 0
        ? Math.min(100, (blob.size / totalBytes) * 100)
        : NaN,
      done: true,
    });
    return;
  }

  const reader = response.body.getReader();
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    await writable.write(value);
    receivedBytes += value.byteLength;
    emitProgress(onProgress, {
      filename,
      receivedBytes,
      totalBytes,
      percent: Number.isFinite(totalBytes) && totalBytes > 0
        ? Math.min(100, (receivedBytes / totalBytes) * 100)
        : NaN,
      done: false,
    });
  }

  await writable.close();
  emitProgress(onProgress, {
    filename,
    receivedBytes,
    totalBytes,
    percent: 100,
    done: true,
  });
}

export function fileNameFromDisposition(disposition, fallback) {
  if (!disposition || typeof disposition !== "string") {
    return fallback;
  }
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (_err) {
      return utf8Match[1];
    }
  }
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch && plainMatch[1] ? plainMatch[1] : fallback;
}

export function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = sanitizeSuggestedName(filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function prepareDownloadTarget(suggestedName) {
  if (!canStreamToLocalFile()) {
    return { kind: "blob" };
  }
  try {
    const handle = await (window as WindowWithFilePicker).showSaveFilePicker({
      suggestedName: sanitizeSuggestedName(suggestedName),
    });
    return { kind: "file-system", handle };
  } catch (error) {
    if (isAbortError(error)) {
      return { kind: "aborted" };
    }
    return { kind: "blob" };
  }
}

export function formatTransferSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) {
    return "";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export async function saveResponseDownload(response, { target, filename, onProgress }) {
  if (target?.kind === "aborted") {
    return;
  }
  const totalBytes = normalizeTotalBytes(response);
  emitProgress(onProgress, {
    filename,
    receivedBytes: 0,
    totalBytes,
    percent: 0,
    done: false,
  });
  if (target?.kind === "file-system") {
    let writable = null;
    try {
      writable = await target.handle.createWritable();
    } catch (_error) {
      downloadBlob(await collectResponseBlob(response, {
        filename,
        totalBytes,
        onProgress,
      }), filename);
      return;
    }
    try {
      await writeResponseStream(response, writable, {
        filename,
        totalBytes,
        onProgress,
      });
    } catch (error) {
      try {
        await writable.abort();
      } catch (_err) {
        // Preserve the original write failure.
      }
      throw error;
    }
    return;
  }
  downloadBlob(await collectResponseBlob(response, {
    filename,
    totalBytes,
    onProgress,
  }), filename);
}

export async function downloadProtectedResponse({
  fetchResponse,
  url = "",
  fallbackName,
  preferredName = "",
  target,
  onProgress,
}) {
  const resp = await fetchResponse();
  if (resp.ok === false) {
    const text = await resp.text();
    const error = new Error(`下载失败: ${resp.status} ${text || "unknown error"}`) as Error & { status?: number; url?: string };
    error.status = resp.status;
    error.url = url;
    throw error;
  }
  const disposition = resp.headers.get("content-disposition") || "";
  // 后端给的文件名优先：所有下载的命名规则都在后端（services/download_names.rs，
  // 「类型前缀_书名_后缀」）。以前前端的 preferredName 排在前面，于是同一个译文 PDF
  // 从左栏下载叫 `…-translated.pdf`、从阅读器下载叫 `zh_….pdf`。前端自己的名字只在
  // 响应没带文件名时兜底（旧后端）。
  const filename = fileNameFromDisposition(disposition, "") || preferredName || fallbackName;
  // target 允许传一个函数:那样**要等响应确认成功之后**才去问保存位置。
  //
  // 提前创建 target 是有代价的:`showSaveFilePicker` 在用户点确定的那一刻就把文件
  // 建出来了（0 字节）。随后请求失败、抛异常，磁盘上就留下一个空文件——用户看到的
  // 不是错误提示，而是一份"打开什么都没有的文档"。Word 导出在打包环境里失败时就是
  // 这么表现的，排查了很久才发现根本没请求成功。
  //
  // 函数会收到最终文件名，「另存为」对话框里预填的就是它，和直接下载得到的名字一致。
  const resolvedTarget = typeof target === "function" ? await target(filename) : target;
  if (resolvedTarget?.kind === "aborted") return "";
  await saveResponseDownload(resp, {
    target: resolvedTarget,
    filename,
    onProgress,
  });
  return filename;
}
