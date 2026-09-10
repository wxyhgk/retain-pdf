import type { ArtifactRuntimePortDeps, ArtifactRuntimeState, JobLike, JobPayload, ManifestPayload, UploadSnapshot } from "./types.js";
export declare function createArtifactRuntimePort({ getCurrentJobId, getCurrentJobSnapshot, getCachedManifestFor, getUploadSnapshot, }?: ArtifactRuntimePortDeps): Readonly<{
    currentJobId: (state: any) => string;
    currentJobSnapshot: (state: any) => JobLike | JobPayload;
    cachedManifestFor: (state: any, jobId: any) => ManifestPayload;
    uploadSnapshot: (state: any) => UploadSnapshot;
}>;
export declare const defaultArtifactRuntimePort: Readonly<{
    currentJobId: (state?: ArtifactRuntimeState | null) => string;
    currentJobSnapshot: (state?: ArtifactRuntimeState | null) => JobLike | JobPayload;
    cachedManifestFor: (state: ArtifactRuntimeState | null | undefined, jobId: string) => ManifestPayload;
    uploadSnapshot: (state?: ArtifactRuntimeState | null) => UploadSnapshot;
}>;
export declare function configureDefaultArtifactRuntimePort(deps?: ArtifactRuntimePortDeps): Readonly<{
    currentJobId: (state?: ArtifactRuntimeState | null) => string;
    currentJobSnapshot: (state?: ArtifactRuntimeState | null) => JobLike | JobPayload;
    cachedManifestFor: (state: ArtifactRuntimeState | null | undefined, jobId: string) => ManifestPayload;
    uploadSnapshot: (state?: ArtifactRuntimeState | null) => UploadSnapshot;
}>;
