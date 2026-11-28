import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "reader-data.v1.schema.json"), "utf8"));
const definitions = contract.definitions;

function propertyNames(definitionName) {
  return Object.keys(definitions[definitionName].properties).sort();
}

test("reader data schema publishes the complete independent read surfaces", () => {
  // 取成品文件（files/output/*name）是 binary，没有 output（2026-11-24 登记）；版面的底图也是（2026-11-28）。
  const binary = contract.endpoints.filter((endpoint) => endpoint.transport === "binary");
  assert.deepEqual(binary.map(({ method, path, output }) => [method, path, output]), [
    ["GET", "/api/v1/jobs/:job_id/reader/layout/background", undefined],
    ["GET", "/api/v1/jobs/:job_id/reader/layout/fonts/:name", undefined],
    ["GET", "/api/v1/jobs/:job_id/reader/layout/math/:name", undefined],
    ["GET", "/api/v1/jobs/:job_id/files/output/*name", undefined],
  ]);
  assert.deepEqual(
    contract.endpoints.filter((endpoint) => endpoint.transport !== "binary").map((endpoint) => endpoint.output),
    [
      "JobFilesView",
      "MarkdownDocumentView",
      "ReaderRegionsView",
      "ReaderMetadataView",
      "ReaderLayoutView",
      "ReaderLayoutPage",
      "LiveTranslationLayout",
      "LiveTranslationPageSnapshot",
      "LiveTranslationCommitEvent",
    ],
  );

  for (const definitionName of contract.endpoints.filter((endpoint) => endpoint.output).map((endpoint) => endpoint.output)) {
    assert.ok(Object.hasOwn(definitions, definitionName), `missing ${definitionName}`);
  }
});

test("reader layout: the manifest says why there is none and each page is rpr_layout_v1 as the engine wrote it (2026-11-28)", () => {
  assert.deepEqual(definitions.ReaderLayoutView.properties.reason.anyOf[0].enum, [
    "no_translated_pdf", "not_engine_route", "unsupported_render", "merged_reading", "not_kept",
  ]);
  assert.equal(definitions.ReaderLayoutView.properties.generate.anyOf[1].type, "null");
  assert.equal(definitions.ReaderLayoutView.properties.background.anyOf[1].type, "null");
  assert.deepEqual(definitions.ReaderLayoutBackground.required, ["url", "pages"]);
  assert.deepEqual(definitions.ReaderLayoutFont.required, ["key", "family", "weight", "url"]);
  assert.equal(definitions.ReaderLayoutItem.properties.font.type, "string");
  assert.equal(definitions.ReaderLayoutItem.properties.svg.type, "string");
  assert.deepEqual(definitions.ReaderLayoutPage.required, ["index", "width", "height", "covers", "blocks"]);
  // 版面以后只加字段（比如字簇的 font）：一页里的对象不封口
  for (const name of ["ReaderLayoutPage", "ReaderLayoutCover", "ReaderLayoutBlock", "ReaderLayoutLine", "ReaderLayoutItem"]) {
    assert.equal(definitions[name].additionalProperties, undefined, name);
  }
});

test("the region list carries ReaderRegionItem; the single-region endpoint was deleted 2026-11-14", () => {
  assert.equal(definitions.ReaderRegionsView.properties.items.items.$ref, "#/definitions/ReaderRegionItem");
  assert.equal(contract.endpoints.some((entry) => entry.path === "/api/v1/jobs/:job_id/reader/regions/:item_id"), false);
});

test("job files view matches the /files response and the old artifact endpoints are marked deprecated", () => {
  assert.deepEqual(propertyNames("JobFilesView"), ["attempt", "internal", "job_id", "output", "pages", "source"]);
  assert.deepEqual(definitions.JobFilesView.required, ["job_id", "attempt", "source", "output", "pages"]);
  assert.equal(definitions.JobFilesView.properties.source.$ref, "#/definitions/JobFileEntryView");
  assert.deepEqual(propertyNames("JobFileEntryView"), [
    "content_type",
    "name",
    "on_demand",
    "ready",
    "size_bytes",
    "stage",
    "updated_at",
    "url",
  ]);
  assert.deepEqual(definitions.JobFileEntryView.properties.updated_at.type, ["string", "null"]);
  assert.deepEqual(definitions.JobFileEntryView.properties.stage.type, ["string", "null"]);
  assert.deepEqual(propertyNames("JobPagesView"), ["page_count", "url_template"]);

  const byPath = Object.fromEntries(contract.endpoints.map((endpoint) => [endpoint.path, endpoint]));
  assert.equal(byPath["/api/v1/jobs/:job_id/files"].output, "JobFilesView");
  // 旧的产物列表、产物清单 2026-10-18 删了。
  for (const path of ["/api/v1/jobs/:job_id/artifacts", "/api/v1/jobs/:job_id/artifacts-manifest"]) {
    assert.equal(byPath[path], undefined, `${path} should be gone`);
  }
});

test("reader regions and live translation keep separate page-index conventions", () => {
  const regionBox = definitions.ReaderRegionBox;
  const layoutPage = definitions.LiveTranslationLayoutPage;
  const snapshot = definitions.LiveTranslationPageSnapshot;
  const event = definitions.LiveTranslationCommitEvent;

  assert.equal(regionBox.properties.page.minimum, 1);
  assert.equal(regionBox.properties.unit.const, "pdf_point");
  assert.equal(regionBox.properties.origin.const, "top_left");
  assert.equal(layoutPage.properties.page_idx.minimum, 0);
  assert.equal(snapshot.properties.page_idx.minimum, 0);
  assert.equal(event.properties.page_idx.minimum, 0);
  assert.match(regionBox.description, /one-based/i);
  assert.match(layoutPage.properties.page_idx.description, /zero-based/i);
});

test("live translation contract retains durable ordering and immutable snapshot fields", () => {
  const snapshot = definitions.LiveTranslationPageSnapshot;
  const event = definitions.LiveTranslationCommitEvent;

  assert.deepEqual(snapshot.required, ["attempt", "generation", "page_idx", "page_hash", "items"]);
  assert.deepEqual(
    event.required,
    ["event", "seq", "attempt", "generation", "page_idx", "page_hash", "changed_item_ids"],
  );
  assert.equal(event.properties.event.const, "translation_units_committed");
  assert.equal(snapshot.properties.page_hash.pattern, "^[0-9A-Fa-f]{64}$");
  assert.equal(event.properties.page_hash.pattern, "^[0-9A-Fa-f]{64}$");
  assert.match(event.description, /refresh hint/i);
});

test("reader contract exposes public resources but no internal path fields", () => {
  const forbidden = /(?:checkpoint|workspace|credential|provider_request|absolute_path)/i;
  for (const definitionName of [
    "JobFileEntryView",
    "MarkdownDocumentView",
    "MarkdownImageView",
    "ReaderRegionItem",
    "LiveTranslationPageSnapshot",
  ]) {
    const names = propertyNames(definitionName);
    assert.equal(
      names.some((name) => forbidden.test(name)),
      false,
      `${definitionName} leaks an internal field name: ${names.join(", ")}`,
    );
  }

  assert.ok(propertyNames("JobFileEntryView").includes("url"));
  assert.equal(Object.hasOwn(definitions.JobFileEntryView.properties, "relative_path"), false);
});

test("reader optional fields mirror serde omission or nullability", () => {
  assert.equal(definitions.LiveTranslationLayoutBlock.required.includes("typography"), false);
  assert.equal(definitions.ReaderRegionItem.required.includes("asset_ids"), true);
  assert.equal(definitions.ReaderRegionItem.required.includes("asset_urls"), true);
  assert.deepEqual(definitions.ReaderRegionItem.properties.asset_ids, { type: "array", items: { type: "string" } });
  assert.deepEqual(definitions.ReaderRegionItem.properties.asset_urls, { type: "array", items: { type: "string" } });
  assert.deepEqual(definitions.ReaderMetadataView.required, ["source", "translated"]);
  assert.equal(definitions.ReaderMetadataView.properties.source.anyOf[1].type, "null");
  assert.equal(definitions.ReaderMetadataView.properties.translated.anyOf[1].type, "null");
});
