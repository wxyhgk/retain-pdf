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
  return (document.querySelector("download-toast") || document.getElementById("download-toast")) as DownloadToastElement | null;
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
      status: `正在下载 ${safePercent.toFixed(0)}%`,
      meta: `${receivedText} / ${totalText}`,
      percent: safePercent,
    };
  }
  return {
    status: "正在下载...",
    meta: receivedText ? `已接收 ${receivedText}` : "等待响应...",
    percent: NaN,
  };
}

export function showDownloadToast({
  title = "下载中",
  status = "正在准备...",
  meta = "等待响应...",
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
    title: filename ? `下载 ${filename}` : "下载中",
    status: "正在准备...",
    meta: "等待响应...",
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
    title: filename ? `下载 ${filename}` : "下载中",
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
    title: filename ? `下载 ${filename}` : "下载完成",
    status: "已开始保存",
    meta: "文件已交给浏览器保存",
    percent: 100,
    tone: "success",
  });
  hideTimer = window.setTimeout(() => {
    toastElement()?.hide();
    hideTimer = 0;
  }, 1500);
}

export function failDownloadToast(message = "下载失败") {
  clearHideTimer();
  toastElement()?.setState({
    visible: true,
    title: "下载失败",
    status: message,
    meta: "请稍后重试",
    percent: 100,
    tone: "error",
  });
  hideTimer = window.setTimeout(() => {
    toastElement()?.hide();
    hideTimer = 0;
  }, 1800);
}
