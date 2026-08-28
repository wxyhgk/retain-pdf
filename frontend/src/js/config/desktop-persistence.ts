import { getDesktopHost, isDesktopHostAvailable } from "../desktop/host.js";
import { runtimeConfig, setRuntimeConfig } from "./runtime.js";
import {
  buildRuntimeConfig,
  desktopRuntimeToBrowserConfig,
  isObject,
  normalizeBrowserStoredConfig,
  normalizeDeveloperStoredConfig,
  readBrowserStoredConfig,
  readDeveloperStoredConfig,
  writeBrowserStoredConfig,
  writeDeveloperStoredConfig,
} from "./storage.js";

let desktopPersistedSnapshot = null;

const desktopBridge = getDesktopHost();

export function isDesktopMode() {
  return isDesktopHostAvailable();
}

export function persistedDesktopSnapshot() {
  return desktopPersistedSnapshot;
}

function normalizeDesktopPersistedConfig(payload: any = {}, fallback: any = {}) {
  const source = isObject(payload) ? payload : {};
  const base = isObject(fallback) ? fallback : {};
  const runtimeSource = {
    ...(isObject(base.runtimeConfig) ? base.runtimeConfig : {}),
    ...(isObject(source.runtimeConfig) ? source.runtimeConfig : {}),
  };
  const browserConfig = normalizeBrowserStoredConfig({
    ...(isObject(base.browserConfig) ? base.browserConfig : {}),
    ...desktopRuntimeToBrowserConfig(runtimeSource),
    ...(isObject(source.browserConfig) ? source.browserConfig : {}),
  });
  const developerConfig = normalizeDeveloperStoredConfig(
    source.developerConfig
      ?? runtimeSource.developerConfig
      ?? base.developerConfig
      ?? {},
  );
  return {
    firstRunCompleted: source.firstRunCompleted ?? base.firstRunCompleted ?? false,
    closeToTrayHintShown: source.closeToTrayHintShown ?? base.closeToTrayHintShown ?? false,
    browserConfig,
    developerConfig,
    runtimeConfig: buildRuntimeConfig(browserConfig, developerConfig, runtimeSource),
  };
}

function persistShadowConfig(browserConfig, developerConfig) {
  writeBrowserStoredConfig(browserConfig);
  writeDeveloperStoredConfig(developerConfig);
}

async function saveDesktopPersistedConfig(partial: any = {}) {
  const baseline = desktopPersistedSnapshot || normalizeDesktopPersistedConfig({}, {
    browserConfig: readBrowserStoredConfig(),
    developerConfig: readDeveloperStoredConfig(),
    runtimeConfig,
  });
  const merged = normalizeDesktopPersistedConfig({
    ...baseline,
    ...partial,
    browserConfig: partial.browserConfig
      ? { ...baseline.browserConfig, ...partial.browserConfig }
      : baseline.browserConfig,
    developerConfig: partial.developerConfig
      ? { ...baseline.developerConfig, ...partial.developerConfig }
      : baseline.developerConfig,
    runtimeConfig: {
      ...baseline.runtimeConfig,
      ...(isObject(partial.runtimeConfig) ? partial.runtimeConfig : {}),
    },
  });
  const savePayload = {
    firstRunCompleted: merged.firstRunCompleted,
    closeToTrayHintShown: merged.closeToTrayHintShown,
    ocrProvider: merged.browserConfig.ocrProvider,
    paddleToken: merged.browserConfig.paddleToken,
    modelApiKey: merged.browserConfig.modelApiKey,
    developerConfig: merged.developerConfig,
    runtimeConfig: merged.runtimeConfig,
  };
  const response = await desktopBridge.saveDesktopConfig(savePayload);
  desktopPersistedSnapshot = normalizeDesktopPersistedConfig(response, savePayload);
  setRuntimeConfig(desktopPersistedSnapshot.runtimeConfig);
  persistShadowConfig(desktopPersistedSnapshot.browserConfig, desktopPersistedSnapshot.developerConfig);
  return desktopPersistedSnapshot;
}

export async function savePersistedDesktopConfig(partial: any = {}) {
  if (!isDesktopMode()) {
    return {
      browserConfig: normalizeBrowserStoredConfig(partial.browserConfig),
      developerConfig: normalizeDeveloperStoredConfig(partial.developerConfig),
      runtimeConfig: buildRuntimeConfig(
        partial.browserConfig,
        partial.developerConfig,
        partial.runtimeConfig,
      ),
      firstRunCompleted: !!partial.firstRunCompleted,
      closeToTrayHintShown: !!partial.closeToTrayHintShown,
    };
  }
  return saveDesktopPersistedConfig(partial);
}

export async function loadPersistedConfig() {
  const shadowBrowserConfig = readBrowserStoredConfig();
  const shadowDeveloperConfig = readDeveloperStoredConfig();
  if (!isDesktopMode()) {
    return {
      browserConfig: normalizeBrowserStoredConfig(shadowBrowserConfig),
      developerConfig: normalizeDeveloperStoredConfig(shadowDeveloperConfig),
      runtimeConfig,
      firstRunCompleted: false,
      closeToTrayHintShown: false,
    };
  }
  const payload = await desktopBridge.loadDesktopConfig();
  desktopPersistedSnapshot = normalizeDesktopPersistedConfig(payload, {
    browserConfig: shadowBrowserConfig,
    developerConfig: shadowDeveloperConfig,
    runtimeConfig,
  });
  setRuntimeConfig(desktopPersistedSnapshot.runtimeConfig);
  persistShadowConfig(desktopPersistedSnapshot.browserConfig, desktopPersistedSnapshot.developerConfig);
  return desktopPersistedSnapshot;
}

export async function savePersistedBrowserConfig(nextBrowserConfig) {
  if (!isDesktopMode()) {
    return {
      browserConfig: nextBrowserConfig,
      developerConfig: normalizeDeveloperStoredConfig(readDeveloperStoredConfig()),
      runtimeConfig,
      firstRunCompleted: false,
      closeToTrayHintShown: false,
    };
  }
  return saveDesktopPersistedConfig({ browserConfig: nextBrowserConfig });
}

export async function savePersistedDeveloperConfig(nextDeveloperConfig) {
  if (!isDesktopMode()) {
    return {
      browserConfig: normalizeBrowserStoredConfig(readBrowserStoredConfig()),
      developerConfig: nextDeveloperConfig,
      runtimeConfig,
      firstRunCompleted: false,
      closeToTrayHintShown: false,
    };
  }
  return saveDesktopPersistedConfig({ developerConfig: nextDeveloperConfig });
}

export async function desktopInvoke(command, args = {}) {
  if (!desktopBridge) {
    throw new Error("Giao diện desktop không khả dụng");
  }
  return desktopBridge.invoke(command, args);
}

export async function openDesktopOutputDirectory() {
  if (!desktopBridge) {
    throw new Error("Giao diện desktop không khả dụng");
  }
  return desktopBridge.openOutputDirectory();
}
