import { buildApiUrl } from "@/platform/config/runtime.js";

export function createUploadConfigPort({
  buildEndpoint = buildApiUrl,
}: any = {}) {
  function buildUploadUrl(apiPrefix = "") {
    return buildEndpoint(apiPrefix, "uploads");
  }

  return Object.freeze({
    buildUploadUrl,
  });
}

export const defaultUploadConfigPort = createUploadConfigPort();
