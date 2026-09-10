// glossaries + app-update。

import { API_PREFIX } from "@/platform/config/api-constants.js";
import {
  createGlossariesViewFeature,
  mountGlossariesFeature,
} from "@/features/glossaries/index.js";
import {
  createAppUpdateViewFeature,
  mountAppUpdateFeature,
  normalizeReleaseInfo,
} from "@/features/app-update/index.js";
import type {
  AppUpdateFeature,
  AppUpdateViewBag,
  AsyncFn,
  CreateHomeCompositionOptions,
  GlossariesFeature,
  GlossariesViewBag,
  HomeFeatures,
} from "./types.js";
import type { DialogStore } from "@/platform/store/dialog-store.js";
import { createDialogStore } from "@/platform/store/dialog-store.js";

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
  const glossariesDialogStore = createDialogStore();
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
  // viewPort 无默认值，被 `= {}` 默认参从公开类型里吞掉；运行时必传。
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
