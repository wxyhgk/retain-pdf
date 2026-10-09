import * as MockBackups from "../mocks/backups.js";
import {
  fetchBackupStatus as _canonFetchBackupStatus,
  createBackup as _canonCreateBackup,
  restoreBackup as _canonRestoreBackup,
  deleteBackup as _canonDeleteBackup,
} from "@retainpdf/api/backups";
import { mockable } from "./_mockable.js";

export const fetchBackupStatusApi = mockable(_canonFetchBackupStatus, MockBackups.fetchBackupStatus);
export const createBackupApi = mockable(_canonCreateBackup, MockBackups.createBackup);
export const restoreBackupApi = mockable(_canonRestoreBackup, MockBackups.restoreBackup);
export const deleteBackupApi = mockable(_canonDeleteBackup, MockBackups.deleteBackup);
