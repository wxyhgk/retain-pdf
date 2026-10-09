import { getDesktopHost, isDesktopHostAvailable } from "@/platform/desktop/host.js";
import type { DesktopHost, DesktopInvokeArgs } from "@/platform/desktop/host.js";
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
import type {
  BrowserStoredConfig,
  DeveloperStoredConfig,
  RuntimeConfig,
} from "./storage.js";

/** 归一化后的桌面持久化配置（desktopPersistedSnapshot 的形状）。 */
export type DesktopPersistedConfig = {
  firstRunCompleted: boolean;
  closeToTrayHintShown: boolean;
  browserConfig: BrowserStoredConfig;
  developerConfig: DeveloperStoredConfig;
  runtimeConfig: RuntimeConfig;
};

/** 调用方传入的局部配置：各段都可以只带一部分字段。 */
export type DesktopPersistedConfigPatch = Partial<Omit<DesktopPersistedConfig, "browserConfig" | "developerConfig" | "runtimeConfig">> & {
  browserConfig?: Partial<BrowserStoredConfig>;
  developerConfig?: Partial<DeveloperStoredConfig>;
  runtimeConfig?: Partial<RuntimeConfig>;
};

let desktopPersistedSnapshot: DesktopPersistedConfig | null = null;

const desktopBridge = getDesktopHost();

/** 只在 isDesktopMode() 为真之后调用；宿主缺失时报与 desktopInvoke 相同的错误。 */
function requireDesktopBridge(): DesktopHost {
  if (!desktopBridge) {
    throw new Error("桌面接口不可用");
  }
  return desktopBridge;
}

export function isDesktopMode() {
  return isDesktopHostAvailable();
}

export function persistedDesktopSnapshot() {
  return desktopPersistedSnapshot;
}

/** isObject 只返回 boolean、不收窄类型，这里统一把对象断言成宽松记录，其余值给空对象。 */
function asRecord(value: unknown): Record<string, unknown> {
  return isObject(value) ? (value as Record<string, unknown>) : {};
}

function normalizeDesktopPersistedConfig(payload: unknown = {}, fallback: unknown = {}): DesktopPersistedConfig {
  const source = asRecord(payload);
  const base = asRecord(fallback);
  const runtimeSource = {
    ...asRecord(base.runtimeConfig),
    ...asRecord(source.runtimeConfig),
  };
  const browserConfig = normalizeBrowserStoredConfig({
    ...asRecord(base.browserConfig),
    ...desktopRuntimeToBrowserConfig(runtimeSource),
    ...asRecord(source.browserConfig),
  });
  const developerConfig = normalizeDeveloperStoredConfig(
    asRecord(
      source.developerConfig
        ?? runtimeSource.developerConfig
        ?? base.developerConfig,
    ),
  );
  return {
    // 持久化 JSON 里的值未经校验，保持原样透传（与历史行为一致）。
    firstRunCompleted: (source.firstRunCompleted ?? base.firstRunCompleted ?? false) as boolean,
    closeToTrayHintShown: (source.closeToTrayHintShown ?? base.closeToTrayHintShown ?? false) as boolean,
    browserConfig,
    developerConfig,
    runtimeConfig: buildRuntimeConfig(browserConfig, developerConfig, runtimeSource),
  };
}

function persistShadowConfig(browserConfig: BrowserStoredConfig, developerConfig: DeveloperStoredConfig) {
  writeBrowserStoredConfig(browserConfig);
  writeDeveloperStoredConfig(developerConfig);
}

async function saveDesktopPersistedConfig(partial: DesktopPersistedConfigPatch = {}) {
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
    ocrCredentialRef: merged.browserConfig.ocrCredentialRef,
    paddleToken: merged.browserConfig.paddleToken,
    mineruToken: merged.browserConfig.mineruToken,
    translationCredentialRef: merged.browserConfig.translationCredentialRef,
    modelApiKey: merged.browserConfig.modelApiKey,
    developerConfig: merged.developerConfig,
    runtimeConfig: merged.runtimeConfig,
  };
  const response = await requireDesktopBridge().saveDesktopConfig(savePayload);
  desktopPersistedSnapshot = normalizeDesktopPersistedConfig(response, savePayload);
  setRuntimeConfig(desktopPersistedSnapshot.runtimeConfig);
  persistShadowConfig(desktopPersistedSnapshot.browserConfig, desktopPersistedSnapshot.developerConfig);
  return desktopPersistedSnapshot;
}

export async function savePersistedDesktopConfig(partial: DesktopPersistedConfigPatch = {}) {
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
  const payload = await requireDesktopBridge().loadDesktopConfig();
  desktopPersistedSnapshot = normalizeDesktopPersistedConfig(payload, {
    browserConfig: shadowBrowserConfig,
    developerConfig: shadowDeveloperConfig,
    runtimeConfig,
  });
  setRuntimeConfig(desktopPersistedSnapshot.runtimeConfig);
  persistShadowConfig(desktopPersistedSnapshot.browserConfig, desktopPersistedSnapshot.developerConfig);
  return desktopPersistedSnapshot;
}

export async function savePersistedBrowserConfig(nextBrowserConfig: BrowserStoredConfig) {
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

export async function savePersistedDeveloperConfig(nextDeveloperConfig: DeveloperStoredConfig) {
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

export async function desktopInvoke(command: string, args: DesktopInvokeArgs = {}) {
  if (!desktopBridge) {
    throw new Error("桌面接口不可用");
  }
  return desktopBridge.invoke(command, args);
}

export async function openDesktopOutputDirectory() {
  if (!desktopBridge) {
    throw new Error("桌面接口不可用");
  }
  return desktopBridge.openOutputDirectory();
}
