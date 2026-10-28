import { buildUploadsEndpoint } from "@/platform/api/index.js";

export function createUploadConfigPort({
  buildUploadUrl = buildUploadsEndpoint,
}: { buildUploadUrl?: (apiPrefix?: string) => string } = {}) {
  return Object.freeze({
    buildUploadUrl: (apiPrefix = "") => buildUploadUrl(apiPrefix),
  });
}

export const defaultUploadConfigPort = createUploadConfigPort();
