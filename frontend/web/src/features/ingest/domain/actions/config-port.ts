import { apiBase, isMockMode } from "@/platform/config/runtime.js";

export interface CreateAppActionsConfigPortOptions {
  resolveApiBase?: () => string;
  isMock?: () => boolean;
}

export function createAppActionsConfigPort({
  resolveApiBase = apiBase,
  isMock = isMockMode,
}: CreateAppActionsConfigPortOptions = {}) {
  function apiBaseLabel() {
    return resolveApiBase();
  }

  return Object.freeze({
    apiBaseLabel,
    isMock,
  });
}

export const defaultAppActionsConfigPort = createAppActionsConfigPort();
