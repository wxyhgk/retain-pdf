import type { ArtifactUrlConfigPortDeps } from "./types.js";
export declare function createArtifactUrlConfigPort({ resolveApiBase, }?: ArtifactUrlConfigPortDeps): Readonly<{
    resolveApiBase: () => string;
}>;
export declare const defaultArtifactUrlConfigPort: Readonly<{
    resolveApiBase: () => string;
}>;
export declare function configureDefaultArtifactUrlConfigPort({ resolveApiBase, }?: ArtifactUrlConfigPortDeps): Readonly<{
    resolveApiBase: () => string;
}>;
