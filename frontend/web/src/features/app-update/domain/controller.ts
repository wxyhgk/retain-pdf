import {
  fetchLatestGithubRelease,
  normalizeReleaseInfo,
  type GithubReleasePayload,
} from "./github-release.js";
import {
  createUpdateCachePort,
  defaultUpdateCachePort,
} from "./state.js";

/** 更新信息（normalizeReleaseInfo 的产物，也是缓存读出的形状）。 */
type AppUpdateInfo = ReturnType<typeof normalizeReleaseInfo>;

/** 缓存端口：只用 read / write。 */
export type UpdateCachePortLike = {
  read: () => { info?: unknown; fresh?: boolean };
  write?: (info: AppUpdateInfo) => void;
};

/** 视图端口：由页面注入的更新提示展示面。 */
export type AppUpdateViewPort = {
  setReady: () => unknown;
  setAvailable: (info: AppUpdateInfo) => unknown;
  setLatest: (info: AppUpdateInfo) => unknown;
  setChecking: () => unknown;
  setError: (error: unknown) => unknown;
  /** 桌面端自动更新用（网页端用不到，旧的测试替身可以不给）。 */
  setDownloading?: (info: DesktopUpdateInfo & { percent?: number }) => unknown;
  setDownloaded?: (info: DesktopUpdateInfo) => unknown;
  bindButton: (handlers: { onCheck: () => void; onInstall: () => void }) => unknown;
};

type DesktopUpdateInfo = { latestVersion?: string; currentVersion?: string; body?: string };

/** 桌面端自动更新（electron-updater，见 frontend/desktop/src/main/app-updater.js）的状态。 */
export type DesktopUpdateStatusLike = {
  supported: boolean;
  state: string;
  currentVersion?: string;
  version?: string;
  notes?: string;
  percent?: number;
  error?: string;
};

/** 页面装配层把桌面壳的更新接口接成这个形状；网页端没有。 */
export type DesktopUpdaterPort = {
  status: () => Promise<DesktopUpdateStatusLike>;
  check: () => Promise<DesktopUpdateStatusLike>;
  install: () => Promise<unknown>;
  onStatus: (callback: (status: DesktopUpdateStatusLike) => void) => () => void;
};

export type AppUpdateFeatureDeps = {
  enabled?: boolean;
  cachePort?: UpdateCachePortLike;
  fetchLatestRelease?: () => Promise<GithubReleasePayload>;
  normalizeRelease?: typeof normalizeReleaseInfo;
  viewPort: AppUpdateViewPort;
  /**
   * 桌面端（Windows / Mac 打包版）的自动更新。给了并且主进程说支持，就走它：后台下载、下好提示
   * 「重启即可更新」，不再查 GitHub Releases、不跳转下载页。Linux deb、旧版桌面壳、网页端照旧。
   */
  desktopUpdater?: DesktopUpdaterPort | null;
};

export function mountAppUpdateFeature({
  enabled = true,
  cachePort = defaultUpdateCachePort,
  fetchLatestRelease = fetchLatestGithubRelease,
  normalizeRelease = normalizeReleaseInfo,
  viewPort,
  desktopUpdater = null,
}: AppUpdateFeatureDeps) {
  // 桌面端自动更新接管以后为 true：「检查」走主进程，启动时那次 GitHub 自检不再做。
  let desktopMode = false;
  let unsubscribeDesktop: (() => void) | null = null;
  // 用户点了「检查」、还没出结果：只有这时才显示「检查中」和出错。主进程每 6 小时的后台检查
  // 和网页端一样静默——断网时按钮不会变成出错。
  let manualCheckPending = false;

  function applyDesktopStatus(status: DesktopUpdateStatusLike) {
    if ((status.state === "checking" || status.state === "error") && !manualCheckPending) {
      return;
    }
    if (status.state !== "checking") manualCheckPending = false;
    const info = {
      latestVersion: status.version || "",
      currentVersion: status.currentVersion || undefined,
      body: status.notes || "",
    };
    switch (status.state) {
      case "checking":
        viewPort.setChecking();
        break;
      case "downloading":
        viewPort.setDownloading?.({ ...info, percent: status.percent });
        break;
      case "downloaded":
        viewPort.setDownloaded?.(info);
        break;
      case "latest":
        viewPort.setLatest({ ...normalizeRelease({ tag_name: status.version || status.currentVersion || "" }), htmlUrl: "" });
        break;
      case "error":
        viewPort.setError(new Error(status.error || "检查更新失败"));
        break;
      default:
        viewPort.setReady();
    }
  }

  async function adoptDesktopUpdater() {
    if (!desktopUpdater) return;
    try {
      const status = await desktopUpdater.status();
      if (!status.supported) return;
      desktopMode = true;
      unsubscribeDesktop = desktopUpdater.onStatus(applyDesktopStatus);
      applyDesktopStatus(status);
    } catch {
      // 旧版桌面壳没有 update_status 命令：照旧查 GitHub Releases。
    }
  }

  function applyUpdateInfo(info: AppUpdateInfo | null | undefined) {
    if (!info) {
      viewPort.setReady();
      return;
    }
    if (info.hasUpdate) {
      viewPort.setAvailable(info);
    } else {
      viewPort.setLatest(info);
    }
  }

  async function checkForUpdates({ manual = false }: { manual?: boolean } = {}) {
    if (desktopMode && desktopUpdater) {
      if (manual) {
        manualCheckPending = true;
        viewPort.setChecking();
      }
      try {
        applyDesktopStatus(await desktopUpdater.check());
      } catch (error) {
        if (manual) viewPort.setError(error);
        manualCheckPending = false;
      }
      return true;
    }
    if (!enabled) {
      return false;
    }
    if (manual) {
      viewPort.setChecking();
    }
    try {
      const release = await fetchLatestRelease();
      const info = normalizeRelease(release);
      // write 在端口类型里可选：没有写入能力的端口视为不缓存，与原先的失败静默一致。
      cachePort.write?.(info);
      applyUpdateInfo(info);
    } catch (error) {
      if (manual) {
        viewPort.setError(error);
      }
    }
    return true;
  }

  viewPort.bindButton({
    onCheck: () => {
      void checkForUpdates({ manual: true });
    },
    onInstall: () => {
      if (desktopMode && desktopUpdater) void desktopUpdater.install();
    },
  });
  const desktopReady = adoptDesktopUpdater();

  if (!enabled) {
    viewPort.setReady();
    return {
      checkForUpdates,
      desktopReady,
      dispose: () => unsubscribeDesktop?.(),
    };
  }

  const cached = cachePort.read();
  // 缓存 info 由 state.ts 的 normalizeCachedInfo 产出，形状即 AppUpdateInfo；端口类型在装配层被放宽为 unknown，这里收回。
  applyUpdateInfo(cached.info as AppUpdateInfo | undefined);
  if (cached.fresh) {
    return {
      checkForUpdates,
      desktopReady,
      dispose: () => unsubscribeDesktop?.(),
    };
  }

  window.setTimeout(() => {
    // 桌面端自动更新接管了就不查 GitHub（主进程自己定时检查）。
    if (desktopMode) return;
    void checkForUpdates({ manual: false });
  }, 1200);

  return {
    checkForUpdates,
    desktopReady,
    dispose: () => unsubscribeDesktop?.(),
  };
}
