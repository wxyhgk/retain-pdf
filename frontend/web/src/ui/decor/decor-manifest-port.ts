// FETCH BOUNDARY: decor manifest static-asset fetch.
// This module isolates the only fetch in DecorStage (public/decor/<pack>/manifest.json)
// behind a port so the UI remains testable without network and the boundary is
// explicit. The fetch intentionally bypasses API_PREFIX/buildApiEndpoint — it
// targets a same-origin static asset, not the backend API.

export type DecorManifestFetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const defaultDecorManifestFetch: DecorManifestFetchPort = (url, init) => fetch(url as string, init);

export function createDecorManifestPort({
  fetchImpl = defaultDecorManifestFetch,
}: {
  fetchImpl?: DecorManifestFetchPort;
} = {}) {
  return Object.freeze({
    fetchManifest: (assetBase: string) => fetchImpl(`${assetBase}/manifest.json`),
    fetchImpl,
  });
}

export const defaultDecorManifestPort = createDecorManifestPort();
