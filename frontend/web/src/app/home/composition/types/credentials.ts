// credentials：凭据/术语表/更新域。
import type { DialogStore } from "@/platform/store/dialog-store.js";
import type { createCredentialsViewFeature } from "@/features/credentials/index.js";
import type { AppUpdateReadOnlyStore } from "@/features/app-update/index.js";
import type {
  GlossariesFeature,
  GlossariesViewFeature as GlossariesViewBag,
} from "@/features/glossaries/index.js";
import type { HandlersBag, ReadOnlyStore } from "./common.js";
import type { AppUpdateFeature, BrowserCredentialsFeature } from "./features.js";

export type { GlossariesFeature, GlossariesViewBag };

/** 就是凭据功能自己的视图对象（createCredentialsViewFeature 的返回值），不再手抄。 */
export type CredentialsViewBag = ReturnType<typeof createCredentialsViewFeature>;

export type HomeCredentials = {
  feature: BrowserCredentialsFeature;
  view: CredentialsViewBag;
};

/** 设置弹窗的打开参数：选中哪个 tab，以及这次是不是首次配置门。 */
export type SettingsHubDialogPayload = { tab?: string; setupMode?: boolean } | null;

export type HomeSettingsHub = {
  /**
   * payload.tab 选中哪个 tab；payload.setupMode 表示这次是首次配置门。
   * 首配不再另开外壳，就是本弹窗停在 api tab（见 SettingsDialog 的注释）。
   */
  dialogStore: DialogStore<SettingsHubDialogPayload>;
};

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
