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
  bindButton: (handlers: { onCheck: () => void }) => unknown;
};

export type AppUpdateFeatureDeps = {
  enabled?: boolean;
  cachePort?: UpdateCachePortLike;
  fetchLatestRelease?: () => Promise<GithubReleasePayload>;
  normalizeRelease?: typeof normalizeReleaseInfo;
  viewPort: AppUpdateViewPort;
};

export function mountAppUpdateFeature({
  enabled = true,
  cachePort = defaultUpdateCachePort,
  fetchLatestRelease = fetchLatestGithubRelease,
  normalizeRelease = normalizeReleaseInfo,
  viewPort,
}: AppUpdateFeatureDeps) {
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
  });

  if (!enabled) {
    viewPort.setReady();
    return {
      checkForUpdates,
    };
  }

  const cached = cachePort.read();
  // 缓存 info 由 state.ts 的 normalizeCachedInfo 产出，形状即 AppUpdateInfo；端口类型在装配层被放宽为 unknown，这里收回。
  applyUpdateInfo(cached.info as AppUpdateInfo | undefined);
  if (cached.fresh) {
    return {
      checkForUpdates,
    };
  }

  window.setTimeout(() => {
    void checkForUpdates({ manual: false });
  }, 1200);

  return {
    checkForUpdates,
  };
}
