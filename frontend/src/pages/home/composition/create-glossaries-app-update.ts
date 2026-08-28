// glossaries + app-update。

import {
  API_PREFIX,
  mountGlossariesFeature,
  mountAppUpdateFeature,
  normalizeReleaseInfo,
} from "./external.js";
import { createGlossariesViewFeature } from "../features/glossaries/glossaries-store.js";
import { createGlossariesDialogStore } from "../features/glossaries/glossaries-dialog-store.js";
import { createAppUpdateViewFeature } from "../features/app-update/app-update-store.js";
import type {
  AppUpdateFeature,
  AppUpdateViewBag,
  AsyncFn,
  CreateHomeCompositionOptions,
  GlossariesFeature,
  GlossariesViewBag,
  HomeFeatures,
} from "./types.js";
import type { DialogStore } from "../state/dialog-store.js";

type CreateGlossariesAndAppUpdateArgs = {
  features: HomeFeatures;
  fetchGlossaries: AsyncFn;
  fetchGlossary: AsyncFn;
  createGlossary: AsyncFn;
  updateGlossary: AsyncFn;
  deleteGlossary: AsyncFn;
  exportGlossaryCsv: AsyncFn;
  parseGlossaryCsv: AsyncFn;
  appUpdateAutoCheckEnabled: boolean;
  appUpdateCachePort: NonNullable<CreateHomeCompositionOptions["appUpdateCachePort"]>;
  fetchLatestRelease: AsyncFn;
};

export function createGlossariesAndAppUpdate({
  features,
  fetchGlossaries,
  fetchGlossary,
  createGlossary,
  updateGlossary,
  deleteGlossary,
  exportGlossaryCsv,
  parseGlossaryCsv,
  appUpdateAutoCheckEnabled,
  appUpdateCachePort,
  fetchLatestRelease,
}: CreateGlossariesAndAppUpdateArgs): {
  glossariesFeature: GlossariesFeature;
  glossariesView: GlossariesViewBag;
  glossariesDialogStore: DialogStore;
  appUpdateFeature: AppUpdateFeature;
  appUpdateView: AppUpdateViewBag;
} {
  const glossariesDialogStore = createGlossariesDialogStore();
  const glossariesView = createGlossariesViewFeature({ dialogStore: glossariesDialogStore });
  const glossariesFeature = mountGlossariesFeature({
    apiPrefix: API_PREFIX,
    fetchGlossaries,
    fetchGlossary,
    createGlossary,
    updateGlossary,
    deleteGlossary,
    exportGlossaryCsv,
    parseGlossaryCsv,
    refreshWorkflowGlossaries: (options?: unknown) => features.workflowFeature.loadGlossaryOptions(options),
    viewPort: glossariesView.viewPort,
  }) as GlossariesFeature;
  glossariesFeature.bindEvents();

  const appUpdateView = createAppUpdateViewFeature();
  // viewPort Không có giá trị mặc định，bị `= {}` Đã nuốt thông số mặc định từ loại công khai；Phải vượt qua trong thời gian chạy。
  const appUpdateFeature = mountAppUpdateFeature({
    enabled: appUpdateAutoCheckEnabled,
    cachePort: appUpdateCachePort,
    fetchLatestRelease,
    normalizeRelease: normalizeReleaseInfo,
    viewPort: appUpdateView.viewPort,
  }) as AppUpdateFeature;

  return {
    glossariesFeature,
    glossariesView: glossariesView as GlossariesViewBag,
    glossariesDialogStore,
    appUpdateFeature,
    appUpdateView: appUpdateView as AppUpdateViewBag,
  };
}
