import {
  fetchLatestGithubRelease,
  normalizeReleaseInfo,
} from "./github-release.js";
import {
  defaultUpdateCachePort,
} from "./state.js";

export function mountAppUpdateFeature({
  enabled = true,
  cachePort = defaultUpdateCachePort,
  fetchLatestRelease = fetchLatestGithubRelease,
  normalizeRelease = normalizeReleaseInfo,
  viewPort,
}: any = {}) {
  function applyUpdateInfo(info) {
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

  async function checkForUpdates({ manual = false }: any = {}) {
    if (!enabled) {
      return false;
    }
    if (manual) {
      viewPort.setChecking();
    }
    try {
      const release = await fetchLatestRelease();
      const info = normalizeRelease(release);
      cachePort.write(info);
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
  applyUpdateInfo(cached.info);
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
