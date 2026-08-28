import { APP_VERSION, GITHUB_REPO } from "../../generated/app-version.js";

const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

function normalizeVersion(value = "") {
  return `${value || ""}`.trim().replace(/^v/i, "");
}

function numericPart(value = "") {
  const match = `${value || ""}`.match(/\d+/);
  const num = Number.parseInt(match?.[0] || "0", 10);
  return Number.isFinite(num) ? num : 0;
}

function betaNumber(value = "") {
  const match = `${value || ""}`.trim().match(/^beta(?:[.+-]?(\d+))?$/i);
  if (!match) {
    return null;
  }
  return numericPart(match[1] || "0");
}

function versionParts(value = "") {
  const [withoutBuild = ""] = normalizeVersion(value).split("+");
  const prereleaseIndex = withoutBuild.indexOf("-");
  const core = prereleaseIndex >= 0 ? withoutBuild.slice(0, prereleaseIndex) : withoutBuild;
  const prerelease = prereleaseIndex >= 0 ? withoutBuild.slice(prereleaseIndex + 1) : "";
  return {
    core: core.split(".").map(numericPart),
    beta: betaNumber(prerelease),
    stable: !prerelease,
  };
}

function compareCoreVersion(latestParts, currentParts) {
  const length = Math.max(latestParts.length, currentParts.length);
  for (let index = 0; index < length; index += 1) {
    const latestPart = latestParts[index] || 0;
    const currentPart = currentParts[index] || 0;
    if (latestPart > currentPart) {
      return 1;
    }
    if (latestPart < currentPart) {
      return -1;
    }
  }
  return 0;
}

function compareBetaVersion(latestParts, currentParts) {
  const latestIsBeta = latestParts.beta !== null;
  const currentIsBeta = currentParts.beta !== null;
  if (latestParts.stable && currentIsBeta) {
    return 1;
  }
  if (latestIsBeta && currentParts.stable) {
    return -1;
  }
  if (!latestIsBeta || !currentIsBeta) {
    return 0;
  }
  return latestParts.beta - currentParts.beta;
}

function compareVersions(latest, current) {
  const latestParts = versionParts(latest);
  const currentParts = versionParts(current);
  const coreResult = compareCoreVersion(latestParts.core, currentParts.core);
  if (coreResult !== 0) {
    return coreResult;
  }
  return compareBetaVersion(latestParts, currentParts);
}

export function isNewerVersion(latest = "", current = APP_VERSION) {
  return compareVersions(latest, current) > 0;
}

export async function fetchLatestGithubRelease() {
  const resp = await fetch(GITHUB_LATEST_RELEASE_URL, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });
  if (!resp.ok) {
    throw new Error(`Không kiểm tra được bản cập nhật: GitHub ${resp.status}`);
  }
  return await resp.json();
}

export function normalizeReleaseInfo(release: any = {}) {
  const latestVersion = release.tag_name || release.name || "";
  return {
    currentVersion: APP_VERSION,
    latestVersion,
    hasUpdate: isNewerVersion(latestVersion, APP_VERSION),
    title: release.name || latestVersion || "Cập nhật RetainPDF",
    body: release.body || "",
    htmlUrl: release.html_url || `https://github.com/${GITHUB_REPO}/releases`,
    publishedAt: release.published_at || "",
  };
}
