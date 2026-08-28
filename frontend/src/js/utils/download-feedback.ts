import { $ } from "../dom/query.js";
import { formatTransferSize } from "./downloads.js";

export interface DownloadToastState {
  visible?: boolean;
  title?: string;
  status?: string;
  meta?: string;
  percent?: number;
  tone?: string;
}

export interface DownloadToastElement extends HTMLElement {
  setState(state: DownloadToastState): void;
  hide(): void;
}

export interface ShowDownloadToastOptions {
  title?: string;
  status?: string;
  meta?: string;
  percent?: number;
  tone?: string;
}

export interface UpdateDownloadProgressOptions {
  filename?: string;
  receivedBytes?: number;
  totalBytes?: number;
  percent?: number;
}

let hideTimer = 0;

function toastElement(): DownloadToastElement | null {
  return (document.querySelector("download-toast") || $("download-toast")) as DownloadToastElement | null;
}

function clearHideTimer() {
  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = 0;
  }
}

function summarizeProgress(receivedBytes, totalBytes, percent) {
  const receivedText = formatTransferSize(receivedBytes);
  if (Number.isFinite(totalBytes) && totalBytes > 0) {
    const totalText = formatTransferSize(totalBytes);
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    return {
      status: `Đang tải ${safePercent.toFixed(0)}%`,
      meta: `${receivedText} / ${totalText}`,
      percent: safePercent,
    };
  }
  return {
    status: "Đang tải...",
    meta: receivedText ? `Đã nhận ${receivedText}` : "Đang chờ phản hồi...",
    percent: NaN,
  };
}

export function showDownloadToast({
  title = "Đang tải",
  status = "Đang chuẩn bị...",
  meta = "Đang chờ phản hồi...",
  percent = NaN,
  tone = "progress",
}: ShowDownloadToastOptions = {}) {
  clearHideTimer();
  toastElement()?.setState({
    visible: true,
    title,
    status,
    meta,
    percent,
    tone,
  });
}

export function showDownloadPreparing(filename = "") {
  showDownloadToast({
    title: filename ? `Tải ${filename}` : "Đang tải",
    status: "Đang chuẩn bị...",
    meta: "Đang chờ phản hồi...",
    percent: NaN,
    tone: "progress",
  });
}

export function updateDownloadProgress({
  filename = "",
  receivedBytes = 0,
  totalBytes = NaN,
  percent = NaN,
}: UpdateDownloadProgressOptions = {}) {
  const summary = summarizeProgress(receivedBytes, totalBytes, percent);
  showDownloadToast({
    title: filename ? `Tải ${filename}` : "Đang tải",
    status: summary.status,
    meta: summary.meta,
    percent: summary.percent,
    tone: "progress",
  });
}

export function completeDownloadToast(filename = "") {
  clearHideTimer();
  toastElement()?.setState({
    visible: true,
    title: filename ? `Tải ${filename}` : "Đã tải xong",
    status: "Đã bắt đầu lưu",
    meta: "Tệp đã chuyển đến trình duyệt để lưu",
    percent: 100,
    tone: "success",
  });
  hideTimer = window.setTimeout(() => {
    toastElement()?.hide();
    hideTimer = 0;
  }, 1500);
}

export function failDownloadToast(message = "Tải thất bại") {
  clearHideTimer();
  toastElement()?.setState({
    visible: true,
    title: "Tải thất bại",
    status: message,
    meta: "Vui lòng thử lại sau",
    percent: 100,
    tone: "error",
  });
  hideTimer = window.setTimeout(() => {
    toastElement()?.hide();
    hideTimer = 0;
  }, 1800);
}
