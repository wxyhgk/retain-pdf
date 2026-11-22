// 桌面壳的自动更新接口（platform/desktop/host.ts）接成 app-update 功能要的 DesktopUpdaterPort。
// 网页端没有桌面壳：null，更新检查照旧查 GitHub Releases。
import type { DesktopUpdaterPort } from "@/features/app-update/index.js";
import { getDesktopHost } from "@/platform/desktop/host.js";

export function desktopUpdaterFromHost(): DesktopUpdaterPort | null {
  const host = getDesktopHost();
  if (!host) return null;
  return {
    status: () => host.updateStatus(),
    check: () => host.checkForUpdate(),
    install: () => host.installUpdate(),
    onStatus: (callback) => host.onUpdateStatus(callback),
  };
}
