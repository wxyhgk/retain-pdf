import * as MockSync from "../mocks/sync.js";
import {
  fetchSyncStatus as _canonFetchSyncStatus,
  updateSyncSettings as _canonUpdateSyncSettings,
  runSyncNow as _canonRunSyncNow,
  testSyncTarget as _canonTestSyncTarget,
} from "@retainpdf/api/sync";
import { mockable } from "./_mockable.js";

export const fetchSyncStatusApi = mockable(_canonFetchSyncStatus, MockSync.fetchSyncStatus);
export const updateSyncSettingsApi = mockable(_canonUpdateSyncSettings, MockSync.updateSyncSettings);
export const runSyncNowApi = mockable(_canonRunSyncNow, MockSync.runSyncNow);
export const testSyncTargetApi = mockable(_canonTestSyncTarget, MockSync.testSyncTarget);
