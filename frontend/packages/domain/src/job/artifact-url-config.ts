import type { ArtifactUrlConfigPortDeps } from "./types.js";

const DEFAULT_API_BASE = "http://127.0.0.1:41000";

function fallbackApiBase(): string {
  return DEFAULT_API_BASE;
}

export function createArtifactUrlConfigPort({
  resolveApiBase = fallbackApiBase,
}: ArtifactUrlConfigPortDeps = {}) {
  return Object.freeze({
    resolveApiBase,
  });
}

let defaultResolveApiBase: () => string = fallbackApiBase;

// Stable for consumers that create their default resolver during import.
export const defaultArtifactUrlConfigPort = Object.freeze({
  resolveApiBase: () => defaultResolveApiBase(),
});

export function configureDefaultArtifactUrlConfigPort({
  resolveApiBase = fallbackApiBase,
}: ArtifactUrlConfigPortDeps = {}) {
  defaultResolveApiBase = resolveApiBase;
  return defaultArtifactUrlConfigPort;
}
