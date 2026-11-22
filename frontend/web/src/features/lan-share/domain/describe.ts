// 局域网共享状态 → 面板上的一句话（纯函数，不 import React）。
import type { DesktopLanShareStatus } from "@/platform/desktop/host.js";

export function lanShareHeadline(status: Pick<DesktopLanShareStatus, "enabled" | "running" | "urls">): string {
  if (!status.enabled) return "未开启：只有这台电脑能用";
  if (!status.running) return "已开启，但没能启动，请关掉再打开试试";
  if (!status.urls.length) return "已开启，等这台电脑连上局域网";
  return status.urls.length === 1 ? "已开启：局域网里的设备可以访问" : `已开启：局域网里的设备可以通过 ${status.urls.length} 个地址访问`;
}
