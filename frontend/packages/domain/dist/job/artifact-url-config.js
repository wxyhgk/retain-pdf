const DEFAULT_API_BASE = "http://127.0.0.1:41000";
function fallbackApiBase() {
    return DEFAULT_API_BASE;
}
export function createArtifactUrlConfigPort({ resolveApiBase = fallbackApiBase, } = {}) {
    return Object.freeze({
        resolveApiBase,
    });
}
let defaultResolveApiBase = fallbackApiBase;
// Stable for consumers that create their default resolver during import.
export const defaultArtifactUrlConfigPort = Object.freeze({
    resolveApiBase: () => defaultResolveApiBase(),
});
export function configureDefaultArtifactUrlConfigPort({ resolveApiBase = fallbackApiBase, } = {}) {
    defaultResolveApiBase = resolveApiBase;
    return defaultArtifactUrlConfigPort;
}
