import test from "node:test";
import assert from "node:assert/strict";

import {
  buildArtifactCenterSections,
  formatArtifactBytes,
  formatArtifactTime,
  mergeArtifactLinksIntoManifest,
  selectArtifactQuickDownloads,
} from "../../src/features/book-detail/domain/artifact-center-model.js";
import { readerCompatibleArtifactLinks } from "../../src/features/book-detail/ui/use-book-detail-artifact-center.js";

const source = {
  filename: "paper.pdf",
  url: "/api/v1/documents/doc-1/source.pdf",
  sizeBytes: 2_097_152,
  generatedAt: "2026-09-01T08:30:00Z",
};

const jobs = [
  {
    job_id: "ocr-1",
    workflow: "ocr",
    status: "succeeded",
    current_attempt: 2,
    created_at: "2026-09-01T09:00:00Z",
    updated_at: "2026-09-01T09:05:00Z",
  },
  {
    job_id: "translate-1",
    workflow: "book",
    status: "succeeded",
    attempt: 3,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:10:00Z",
  },
];

test("artifact center: 只映射后端 ready 且有资源地址的真实产物", () => {
  const sections = buildArtifactCenterSections({
    documentId: "doc-1",
    source,
    jobs,
    manifests: {
      "ocr-1": {
        items: [
          {
            artifact_key: "normalized_document_json",
            ready: true,
            file_name: "document.v1.json",
            content_type: "application/json",
            size_bytes: 4096,
            updated_at: "2026-09-01T09:05:00Z",
            resource_url: "/api/v1/ocr/jobs/ocr-1/normalized-document",
          },
          {
            artifact_key: "normalization_report_json",
            ready: true,
            file_name: "normalization-report.json",
            resource_url: "/api/v1/ocr/jobs/ocr-1/normalization-report",
          },
          {
            artifact_key: "provider_raw_zip",
            ready: false,
            resource_url: "/should-not-render.zip",
          },
          {
            artifact_key: "source_pdf",
            ready: true,
            resource_url: "/duplicate-source.pdf",
          },
          {
            artifact_key: "markdown_images_dir",
            artifact_kind: "directory",
            ready: true,
            resource_url: "/api/v1/ocr/jobs/ocr-1/markdown/images/",
          },
        ],
      },
      "translate-1": {
        items: [
          {
            artifact_key: "translated_pdf",
            ready: true,
            file_name: "paper.zh.pdf",
            size_bytes: 8_388_608,
            resource_url: "/api/v1/jobs/translate-1/pdf",
          },
          {
            artifact_key: "markdown_bundle_zip",
            ready: true,
            file_name: "paper-markdown.zip",
            resource_url: "/api/v1/jobs/translate-1/download",
          },
          {
            artifact_key: "missing_url",
            ready: true,
          },
        ],
      },
    },
  });

  assert.deepEqual(sections.map((section) => section.id), [
    "source",
    "ocr",
    "translation",
    "diagnostics",
  ]);
  assert.equal(sections.find((section) => section.id === "source").items.length, 1);
  assert.equal(sections.find((section) => section.id === "ocr").items.length, 1);
  assert.equal(sections.find((section) => section.id === "translation").items.length, 2);
  assert.equal(sections.find((section) => section.id === "diagnostics").items.length, 1);
  assert.equal(
    sections.flatMap((section) => section.items).some((item) => item.url === "/should-not-render.zip"),
    false,
  );
  assert.equal(
    sections.find((section) => section.id === "ocr").items[0].attempt,
    2,
    "manifest 未给 attempt 时使用后端 job 字段",
  );
});

test("artifact center: Agent 只在上游提供真实候选 URL 时进入版本分组", () => {
  const sections = buildArtifactCenterSections({
    documentId: "doc-1",
    source,
    agentOperations: [
      {
        operation_id: "op-ready",
        status: "result_ready",
        current_attempt: 1,
        updated_at: "2026-09-01T11:00:00Z",
        candidate: { version_id: "candidate-1", url: "/api/v1/ai/operations/op-ready/candidate" },
      },
      {
        operation_id: "op-draft",
        status: "draft",
        candidate: null,
      },
    ],
  });
  const agent = sections.find((section) => section.id === "agent");
  assert.ok(agent);
  assert.equal(agent.items.length, 1);
  assert.equal(agent.items[0].label, "候选 PDF");
  assert.equal(agent.items[0].attempt, 1);
});

test("artifact center: 左栏快捷下载只选择四种常用产物并优先原始 Markdown", () => {
  const sections = buildArtifactCenterSections({
    documentId: "doc-1",
    source,
    jobs,
    manifests: {
      "translate-1": {
        items: [
          { artifact_key: "markdown_bundle_zip", ready: true, file_name: "bundle.zip", resource_url: "/bundle.zip" },
          { artifact_key: "markdown_raw", ready: true, file_name: "paper.md", resource_url: "/paper.md" },
          { artifact_key: "translated_pdf", ready: true, file_name: "paper.zh.pdf", resource_url: "/translated.pdf" },
          { artifact_key: "side_by_side_pdf", ready: true, file_name: "paper.compare.pdf", resource_url: "/comparison.pdf" },
        ],
      },
    },
  });

  const downloads = selectArtifactQuickDownloads(sections);
  assert.equal(downloads.source?.url, source.url);
  assert.equal(downloads.markdown?.url, "/paper.md", "优先直接 Markdown，不用任务包替代");
  assert.equal(downloads.translated?.url, "/translated.pdf");
  assert.equal(downloads.comparison?.url, "/comparison.pdf");
});

test("artifact center: 细清单为空时沿用 Reader 的发布产物入口", () => {
  const translationJob = jobs[1];
  const manifest = mergeArtifactLinksIntoManifest(translationJob, {
    items: [
      { artifact_key: "translated_pdf", ready: false, resource_url: null },
      { artifact_key: "side_by_side_pdf", ready: false, resource_url: null },
    ],
  }, {
    pdf_ready: true,
    markdown_ready: true,
    bundle_ready: true,
    pdf_url: "http://127.0.0.1:41000/api/v1/jobs/translate-1/pdf",
    markdown: {
      ready: true,
      raw_url: "http://127.0.0.1:41000/api/v1/jobs/translate-1/markdown?raw=true",
      file_name: "paper.md",
    },
    pdf: {
      ready: true,
      url: "http://127.0.0.1:41000/api/v1/jobs/translate-1/pdf",
      file_name: "paper.zh.pdf",
    },
    bundle_url: "http://127.0.0.1:41000/api/v1/jobs/translate-1/download",
  });
  const sections = buildArtifactCenterSections({
    documentId: "doc-1",
    source,
    jobs: [translationJob],
    manifests: { "translate-1": manifest },
  });
  const downloads = selectArtifactQuickDownloads(sections);

  assert.equal(downloads.markdown?.filename, "paper.md");
  assert.equal(downloads.translated?.filename, "paper.zh.pdf");
  assert.equal(
    downloads.comparison?.url,
    "http://127.0.0.1:41000/api/v1/jobs/translate-1/pdf/side-by-side",
  );
});

test("artifact center: OCR Markdown 使用实际可下载的统一 jobs 路由", () => {
  const links = readerCompatibleArtifactLinks(jobs[0], {
    markdown_ready: true,
    markdown: {
      ready: true,
      raw_url: "http://127.0.0.1:41000/api/v1/ocr/jobs/ocr-1/markdown?raw=true",
    },
  });
  assert.equal(
    links?.markdown?.raw_url,
    "http://127.0.0.1:41000/api/v1/jobs/ocr-1/markdown?raw=true",
  );
});

test("artifact center: 元数据格式只在字段存在时使用", () => {
  assert.equal(formatArtifactBytes(null), "");
  assert.equal(formatArtifactBytes(2_097_152), "2.0 MB");
  assert.equal(formatArtifactTime(""), "");
  assert.match(formatArtifactTime("2026-09-01T08:30:00Z"), /09\/01/);
});
