function canStreamToLocalFile() {
  return typeof window !== "undefined"
    && typeof (window as any).showSaveFilePicker === "function"
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
    const handle = await (window as any).showSaveFilePicker({
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
