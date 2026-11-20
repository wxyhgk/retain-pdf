/** 阅读页显示的译文 PDF 不带导出水印（后端 2026-11-20 起 translated.pdf 默认带，?watermark=0 取原版）；下载菜单照旧带水印。 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveReaderTranslatedPdfUrl,
  withoutExportWatermark,
} from "../../../packages/reader/src/shared/data/resource-resolver.ts";
import { createReaderDialogRuntimePort } from "../../src/features/reader/domain/dialog/runtime-port.ts";

test("加 watermark=0：没有查询串用 ?，有了用 &，# 留在最后，已经写了就不再加，空串不动", () => {
  assert.equal(withoutExportWatermark("/api/v1/jobs/j/files/output/translated.pdf"), "/api/v1/jobs/j/files/output/translated.pdf?watermark=0");
  assert.equal(withoutExportWatermark("/x/translated.pdf?sig=1"), "/x/translated.pdf?sig=1&watermark=0");
  assert.equal(withoutExportWatermark("/x/translated.pdf#page=2"), "/x/translated.pdf?watermark=0#page=2");
  assert.equal(withoutExportWatermark("/x/translated.pdf?watermark=1"), "/x/translated.pdf?watermark=1");
  assert.equal(withoutExportWatermark(""), "");
});

test("阅读页取译文 PDF 的三条路（任务给的地址、清单里的产物、兜底的 translated.pdf）都带 watermark=0", () => {
  const resolveResourceUrl = (value) => `${value || ""}`;
  const viaActions = resolveReaderTranslatedPdfUrl(
    { job_id: "j", actions: { download_pdf: { enabled: true, url: "/api/v1/jobs/j/files/output/translated.pdf" } } },
    null,
  );
  assert.match(viaActions, /translated\.pdf\?watermark=0$/);
  const viaManifest = resolveReaderTranslatedPdfUrl(null, {}, {
    resolveJobActions: () => null,
    findReadyManifestArtifact: (_payload, key) => (key === "translated_pdf" ? { resource_url: "/m/translated.pdf?download=1" } : null),
    resolveReaderArtifactUrl: (item) => item?.resource_url || "",
    resolveResourceUrl,
  });
  assert.equal(viaManifest, "/m/translated.pdf?download=1&watermark=0");
  const viaFallback = resolveReaderTranslatedPdfUrl({ job_id: "j", status: "succeeded", workflow: "book" }, null, {
    resolveJobActions: () => ({ pdfEnabled: false, pdf: "" }),
    findReadyManifestArtifact: () => null,
    resolveReaderArtifactUrl: () => "",
    resolveResourceUrl,
  });
  assert.equal(viaFallback, "/api/v1/jobs/j/files/output/translated.pdf?watermark=0");
  assert.equal(resolveReaderTranslatedPdfUrl({ job_id: "j", status: "running" }, null, {
    resolveJobActions: () => null,
    findReadyManifestArtifact: () => null,
    resolveReaderArtifactUrl: () => "",
    resolveResourceUrl,
  }), "", "没有译文就是空串");
});

test("阅读页下载菜单的译文 PDF、对照 PDF 不加 watermark=0（下载要带水印）", () => {
  const port = createReaderDialogRuntimePort({
    getCurrentJobId: () => "j",
    getCurrentJobSnapshot: () => ({ job_id: "j", status: "succeeded", actions: { download_pdf: { enabled: true, url: "/api/v1/jobs/j/files/output/translated.pdf" } } }),
    getCachedManifestFor: () => ({ items: [{ artifact_key: "source_pdf", ready: true, resource_url: "/s.pdf" }] }),
  });
  const urls = port.currentArtifactUrls({});
  assert.ok(urls.translatedPdf, "有译文下载");
  assert.doesNotMatch(urls.translatedPdf, /watermark/);
  assert.doesNotMatch(urls.sideBySidePdf || "", /watermark/);
});
