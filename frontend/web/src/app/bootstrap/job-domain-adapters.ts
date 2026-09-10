import {
  configureDefaultArtifactRuntimePort,
  configureDefaultArtifactUrlConfigPort,
} from "@retainpdf/domain/job";
import { apiBase } from "@/platform/config/runtime.js";
import { getUploadState } from "@/features/ingest/domain.js";

// The domain package owns artifact naming and URL rules. The web host owns the
// live upload store and runtime API configuration, so wire those capabilities
// before any page composition reads the package defaults.
configureDefaultArtifactRuntimePort({
  getUploadSnapshot: () => {
    const snapshot = getUploadState();
    return {
      uploadId: snapshot.uploadId,
      uploadedFileName: snapshot.uploadedFileName,
      uploadedPageCount: snapshot.uploadedPageCount,
      uploadedBytes: snapshot.uploadedBytes,
      appliedPageRange: snapshot.appliedPageRange,
      submitBusy: snapshot.submitBusy,
    };
  },
});

configureDefaultArtifactUrlConfigPort({
  resolveApiBase: apiBase,
});
