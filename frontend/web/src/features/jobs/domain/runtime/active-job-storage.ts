const ACTIVE_JOB_STORAGE_KEY = "retainpdf.activeJobId";

function localStorageHandle() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch (_err) {
    return null;
  }
}

export function readActiveJobId() {
  try {
    return `${localStorageHandle()?.getItem(ACTIVE_JOB_STORAGE_KEY) || ""}`.trim();
  } catch (_err) {
    return "";
  }
}

export function writeActiveJobId(jobId) {
  const normalized = `${jobId || ""}`.trim();
  try {
    if (normalized) {
      localStorageHandle()?.setItem(ACTIVE_JOB_STORAGE_KEY, normalized);
    } else {
      localStorageHandle()?.removeItem(ACTIVE_JOB_STORAGE_KEY);
    }
  } catch (_err) {
    // Storage can be unavailable in private mode; polling still works in-memory.
  }
}

export function clearActiveJobId(jobId = "") {
  const stored = readActiveJobId();
  const normalized = `${jobId || ""}`.trim();
  if (normalized && stored && stored !== normalized) {
    return;
  }
  writeActiveJobId("");
}
