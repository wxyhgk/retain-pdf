import type {
  BrowserStoredConfig,
  DeveloperStoredConfig,
  RuntimeConfig,
} from "@/platform/config/storage.js";

/** Payload passed to / returned from desktop config load/save. */
export interface DesktopConfigPayload {
  firstRunCompleted?: boolean;
  closeToTrayHintShown?: boolean;
  ocrProvider?: string;
  ocrCredentialRef?: string;
  paddleToken?: string;
  mineruToken?: string;
  glmOcrToken?: string;
  translationCredentialRef?: string;
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
  onUpdateStatus?: (callback: (status: unknown) => void) => () => void;
  platform?: string;
  [key: string]: unknown;
}

/** 桌面端自动更新的状态（frontend/desktop/src/main/app-updater.js 推过来的）。 */
export interface DesktopUpdateStatus {
  /** Windows 安装版 / Mac 打包版才支持；Linux deb、开发态为 false。 */
  supported: boolean;
  state: "idle" | "checking" | "downloading" | "downloaded" | "latest" | "error";
  currentVersion?: string;
  version?: string;
  notes?: string;
  percent?: number;
  error?: string;
}

/** Normalized host surface used by the rest of the frontend. */
export interface DesktopHost {
  invoke(command: string, args?: DesktopInvokeArgs): DesktopIpcResult;
  loadDesktopConfig(): DesktopIpcResult;
  saveDesktopConfig(payload?: DesktopConfigPayload): DesktopIpcResult;
  openOutputDirectory(): DesktopIpcResult;
  /** 在访达 / 资源管理器里打开数据库备份所在的文件夹。 */
  openBackupDirectory(): DesktopIpcResult;
  /** 把主窗口拿到前面来（缩在托盘、最小化、被别的窗口挡住都算）。点系统通知时用。 */
  focusWindow(): DesktopIpcResult;
  /** 命令行工具 retainpdf：包里有没有、装到了哪里。 */
  cliStatus(): Promise<{ available: boolean; installedAt: string; supported: boolean }>;
  /** 把 retainpdf 链接到终端找得到的地方。 */
  installCli(): Promise<{ ok: boolean; path?: string; onPath?: boolean; hint?: string; error?: string }>;
  /** 系统的文件夹选择框；取消时为 null。 */
  pickDirectory(options?: { title?: string; defaultPath?: string }): Promise<string | null>;
  onStartupProgress(callback: (event: unknown) => void): () => void;
  /** 自动更新：现在的状态 / 立即检查 / 重启并更新 / 订阅状态推送（返回退订函数）。 */
  updateStatus(): Promise<DesktopUpdateStatus>;
  checkForUpdate(): Promise<DesktopUpdateStatus>;
  installUpdate(): Promise<{ ok: boolean }>;
  onUpdateStatus(callback: (status: DesktopUpdateStatus) => void): () => void;
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
        throw new Error("桌面接口不可用");
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
    openBackupDirectory() {
      return invokeAdapter!.invoke("open_backup_directory");
    },
    focusWindow() {
      return invokeAdapter!.invoke("focus_window");
    },
    async cliStatus() {
      const result = await invokeAdapter!.invoke("cli_status");
      return {
        available: Boolean(result?.available),
        installedAt: typeof result?.installedAt === "string" ? result.installedAt : "",
        supported: result?.supported !== false,
      };
    },
    async installCli() {
      return (await invokeAdapter!.invoke("install_cli")) || { ok: false, error: "没有结果" };
    },
    async pickDirectory(options: { title?: string; defaultPath?: string } = {}) {
      const result = await invokeAdapter!.invoke("pick_directory", options);
      return typeof result?.path === "string" && result.path ? result.path : null;
    },
    onStartupProgress(callback: (event: unknown) => void) {
      if (preferredBridge && typeof preferredBridge.onStartupProgress === "function") {
        return preferredBridge.onStartupProgress(callback);
      }
      return () => {};
    },
    async updateStatus() {
      return normalizeUpdateStatus(await invokeAdapter!.invoke("update_status"));
    },
    async checkForUpdate() {
      return normalizeUpdateStatus(await invokeAdapter!.invoke("update_check"));
    },
    async installUpdate() {
      const result = await invokeAdapter!.invoke("update_install");
      return { ok: Boolean(result?.ok) };
    },
    onUpdateStatus(callback: (status: DesktopUpdateStatus) => void) {
      if (preferredBridge && typeof preferredBridge.onUpdateStatus === "function") {
        return preferredBridge.onUpdateStatus((status) => callback(normalizeUpdateStatus(status)));
      }
      return () => {};
    },
    platform: preferredBridge?.platform || "",
  };
}

const UPDATE_STATES: readonly string[] = ["idle", "checking", "downloading", "downloaded", "latest", "error"];

/** 主进程（或旧版桌面壳没有这些命令时）给的东西收成固定形状；认不出的一律当不支持。 */
export function normalizeUpdateStatus(value: unknown): DesktopUpdateStatus {
  const raw = (isObject(value) ? value : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === "string" ? raw[key] as string : "");
  return {
    supported: raw.supported === true,
    state: UPDATE_STATES.includes(text("state")) ? text("state") as DesktopUpdateStatus["state"] : "idle",
    currentVersion: text("currentVersion"),
    version: text("version"),
    notes: text("notes"),
    percent: Number.isFinite(Number(raw.percent)) ? Number(raw.percent) : 0,
    error: text("error"),
  };
}

const desktopHost: DesktopHost | null = resolveDesktopHost();

export function getDesktopHost(): DesktopHost | null {
  return desktopHost;
}

export function isDesktopHostAvailable(): boolean {
  return !!desktopHost;
}
