// 凭据视图端口的类型契约。
//
// 这些类型原在 js/features/credentials/view.ts —— 那是旧世界的 DOM 直写视图层，
// 其运行时代码已被 React 实现完全取代（所有真实调用点都显式传入新世界的
// elementsPort / setupModePort，旧默认值从不执行），随本次迁移删除；
// 但 browser.ts 仍以这些类型描述它接收的视图端口，故单独保留于此。

type UploadTileLockedOptions = {
  locked?: boolean;
  enabled?: boolean;
};

type UploadTileTextOptions = {
  label?: string;
  labelTitle?: string;
  help?: string;
  status?: string;
  statusVisible?: boolean | null;
  labelVisible?: boolean;
  helpVisible?: boolean;
};

/** Minimal tile-port surface used by the credentials gate view. */
export type CredentialUploadTilePort = {
  setUploadTileLocked?: (options?: UploadTileLockedOptions) => void;
  setUploadTileReady?: (ready: boolean) => void;
  setUploadTileText?: (options?: UploadTileTextOptions) => void;
};

export type UpdateCredentialGateViewOptions = {
  desktopMode?: boolean;
  show?: boolean;
  uploadEnabled?: boolean;
  uploadReady?: boolean;
  uploadTilePort?: CredentialUploadTilePort;
};

export type OpenCredentialDialogOptions = {
  setupMode?: boolean;
};

export type BindCredentialViewEventsOptions = {
  resetPaddleValidation?: () => void;
  resetDeepSeekValidation?: () => void;
  validateOcr?: () => void;
  validateDeepSeek?: () => void;
  save?: () => void;
  open?: (options?: OpenCredentialDialogOptions) => void;
  activateCredentialTab?: (tabName: string) => void;
  changeProvider?: (event: Event) => void;
  changeTranslationProvider?: (providerId: string) => void;
};
