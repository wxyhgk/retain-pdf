// types-split/credentials.ts — 凭据/术语表/更新域。
import type { DialogStore } from "@/platform/store/dialog-store.js";
import type { HandlersBag, ReadOnlyStore } from "./common.js";
// 装配层的类型引用功能自身的定义，而不是另立一套弱化版本：
// 依赖方向 app -> features，功能是该类型的真值。
import type { AppUpdateReadOnlyStore } from "@/features/app-update/index.js";
import type {
  AppUpdateFeature,
  BrowserCredentialsFeature,
  GlossariesFeature,
} from "./features.js";

export type CredentialsElementsRef = {
  apiKeyInput: HTMLInputElement | null;
  modelBaseUrlInput: HTMLInputElement | null;
  modelNameInput: HTMLInputElement | null;
  translationWorkersInput: HTMLInputElement | null;
  mathModeSelect: HTMLSelectElement | null;
  tokenInputs: Record<string, HTMLInputElement | null | undefined>;
};

export type CredentialsViewBag = {
  store: ReadOnlyStore;
  handlersRef: { current: HandlersBag | null };
  tokenInputRef: (providerId: string) => (node: HTMLInputElement | null) => void;
  elementsRef: CredentialsElementsRef;
  elementsPort?: unknown;
  viewPort?: unknown;
};

export type HomeCredentials = {
  feature: BrowserCredentialsFeature | undefined;
  view: CredentialsViewBag;
  dialogStore: DialogStore;
};

export type HomeSettingsHub = {
  dialogStore: DialogStore<{ tab?: string } | null>;
};

// GlossariesViewBag 的真值在功能内（src/features/glossaries），装配层只引用它：
// 依赖方向 app -> features，禁止功能反向依赖装配层类型。
import type { GlossariesViewFeature as GlossariesViewBag } from "@/features/glossaries/index.js";
export type { GlossariesViewBag };

export type HomeGlossaries = {
  feature: GlossariesFeature | undefined;
  view: GlossariesViewBag;
  dialogStore: DialogStore;
};

export type AppUpdateViewBag = {
  store: AppUpdateReadOnlyStore;
  viewPort?: unknown;
  handlersRef: { current: HandlersBag | null };
};

export type HomeAppUpdate = {
  feature: AppUpdateFeature | undefined;
  view: AppUpdateViewBag;
  handlersRef: AppUpdateViewBag["handlersRef"];
};
