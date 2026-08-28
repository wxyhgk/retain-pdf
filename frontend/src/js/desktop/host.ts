import type {
  BrowserStoredConfig,
  DeveloperStoredConfig,
  RuntimeConfig,
} from "../config/storage.js";

/** Payload passed to / returned from desktop config load/save. */
export interface DesktopConfigPayload {
  firstRunCompleted?: boolean;
  closeToTrayHintShown?: boolean;
  ocrProvider?: string;
  paddleToken?: string;
  modelApiKey?: string;
  browserConfig?: Partial<BrowserStoredConfig> | BrowserStoredConfig;
  developerConfig?: DeveloperStoredConfig;
  runtimeConfig?: RuntimeConfig;
  [key: string]: unknown;
}

/** Arguments bag for desktop IPC invoke. */
export interface DesktopInvokeArgs {
  [key: string]: unknown;
}

/**
 * IPC results are host-defined and not modeled here.
 * Keep a permissive result alias so bridge typing does not cascade
 * `unknown` into every desktop consumer (manifest, config load, etc.).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DesktopIpcResult = any;

export interface DesktopInvokeAdapter {
  invoke(command: string, args?: DesktopInvokeArgs): DesktopIpcResult;
}

/** Raw bridge object injected by Tauri / retainPdfDesktop. */
export interface DesktopBridge {
  invoke?: (command: string, args?: DesktopInvokeArgs) => DesktopIpcResult;
  loadDesktopConfig?: () => DesktopIpcResult;
  saveDesktopConfig?: (payload?: DesktopConfigPayload) => DesktopIpcResult;
  onStartupProgress?: (callback: (event: unknown) => void) => () => void;
  platform?: string;
  [key: string]: unknown;
}

/** Normalized host surface used by the rest of the frontend. */
export interface DesktopHost {
  invoke(command: string, args?: DesktopInvokeArgs): DesktopIpcResult;
  loadDesktopConfig(): DesktopIpcResult;
  saveDesktopConfig(payload?: DesktopConfigPayload): DesktopIpcResult;
  openOutputDirectory(): DesktopIpcResult;
  onStartupProgress(callback: (event: unknown) => void): () => void;
  platform: string;
}

declare global {
  interface Window {
    retainPdfDesktop?: DesktopBridge;
    __TAURI_INTERNALS__?: DesktopBridge;
  }
}

function isObject(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

function buildInvokeAdapter(source: unknown): DesktopInvokeAdapter | null {
  if (!isObject(source) || typeof (source as DesktopBridge).invoke !== "function") {
    return null;
  }
  const bridge = source as DesktopBridge;
  return {
    invoke(command: string, args: DesktopInvokeArgs = {}) {
      return bridge.invoke!(command, args);
    },
  };
}

function resolveDesktopHost(): DesktopHost | null {
  if (typeof window === "undefined") {
    return null;
  }
  const preferredBridge = isObject(window.retainPdfDesktop) ? window.retainPdfDesktop : null;
  const legacyBridge = isObject(window.__TAURI_INTERNALS__) ? window.__TAURI_INTERNALS__ : null;
  const invokeAdapter = buildInvokeAdapter(preferredBridge) || buildInvokeAdapter(legacyBridge);

  if (!preferredBridge && !invokeAdapter) {
    return null;
  }

  return {
    invoke(command: string, args: DesktopInvokeArgs = {}) {
      if (!invokeAdapter) {
        throw new Error("Giao diện desktop không khả dụng");
      }
      return invokeAdapter.invoke(command, args);
    },
    loadDesktopConfig() {
      if (preferredBridge && typeof preferredBridge.loadDesktopConfig === "function") {
        return preferredBridge.loadDesktopConfig();
      }
      return invokeAdapter!.invoke("load_desktop_config");
    },
    saveDesktopConfig(payload: DesktopConfigPayload = {}) {
      if (preferredBridge && typeof preferredBridge.saveDesktopConfig === "function") {
        return preferredBridge.saveDesktopConfig(payload);
      }
      return invokeAdapter!.invoke("save_desktop_config", { payload });
    },
    openOutputDirectory() {
      return invokeAdapter!.invoke("open_output_directory");
    },
    onStartupProgress(callback: (event: unknown) => void) {
      if (preferredBridge && typeof preferredBridge.onStartupProgress === "function") {
        return preferredBridge.onStartupProgress(callback);
      }
      return () => {};
    },
    platform: preferredBridge?.platform || "",
  };
}

const desktopHost: DesktopHost | null = resolveDesktopHost();

export function getDesktopHost(): DesktopHost | null {
  return desktopHost;
}

export function isDesktopHostAvailable(): boolean {
  return !!desktopHost;
}
