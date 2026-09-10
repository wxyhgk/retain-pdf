#!/usr/bin/env node

import {
  configureDefaultArtifactRuntimePort,
  configureDefaultArtifactUrlConfigPort,
  resolveJobSourcePdfAction,
  resolveOriginalPdfBaseName,
  resolveResourceUrl,
  resolveSourcePdfDownloadName,
  resolveTranslatedPdfDownloadName,
} from "@retainpdf/domain/job";

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

configureDefaultArtifactRuntimePort({
  getUploadSnapshot: () => ({
    uploadId: "upload-smoke",
    uploadedFileName: "Host Upload.pdf",
    uploadedPageCount: 12,
    uploadedBytes: 4096,
    appliedPageRange: "1-12",
    submitBusy: false,
  }),
});

assertEqual(resolveOriginalPdfBaseName({}), "Host Upload", "host upload filename");
assertEqual(resolveSourcePdfDownloadName({}), "Host Upload.pdf", "source download name");
assertEqual(resolveTranslatedPdfDownloadName({}), "zh_Host Upload.pdf", "translated download name");

configureDefaultArtifactUrlConfigPort({
  resolveApiBase: () => "https://retainpdf.example.test/custom/api/v1",
});

assertEqual(
  resolveResourceUrl("/api/v1/jobs/job-1/artifacts/source_pdf"),
  "https://retainpdf.example.test/custom/api/v1/jobs/job-1/artifacts/source_pdf",
  "custom API base resource URL",
);
assertEqual(
  resolveJobSourcePdfAction({ job_id: "job/1", source_pdf_ready: true }).url,
  "https://retainpdf.example.test/custom/api/v1/jobs/job%2F1/artifacts/source_pdf",
  "custom API base source fallback",
);

console.log("job domain host ports smoke passed");
