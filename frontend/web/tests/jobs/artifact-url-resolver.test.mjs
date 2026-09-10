import test, { before } from "node:test";
import assert from "node:assert/strict";

let artifacts;
let artifactUrlConfig;
let jobActions;

before(async () => {
  if (typeof Promise.withResolvers !== "function") {
    Promise.withResolvers = function withResolvers() {
      let resolve;
      let reject;
      const promise = new Promise((resolveFn, rejectFn) => {
        resolve = resolveFn;
        reject = rejectFn;
      });
      return { promise, resolve, reject };
    };
  }
  global.window = {
    __FRONT_RUNTIME_CONFIG__: {
      apiBase: "http://retainpdf.local:41000/api/v1",
    },
    location: {
      protocol: "http:",
      hostname: "localhost",
      origin: "http://localhost",
      href: "http://localhost/index.html",
    },
  };
  const jobDomain = await import("@retainpdf/domain/job");
  jobDomain.configureDefaultArtifactUrlConfigPort({
    resolveApiBase: () => global.window.__FRONT_RUNTIME_CONFIG__.apiBase,
  });
  artifacts = jobDomain;
  artifactUrlConfig = jobDomain;
  jobActions = jobDomain;
});

test("resource resolver normalizes api paths without duplicating api prefix", () => {
  assert.equal(
    artifacts.resolveResourceUrl("/api/v1/jobs/1/artifacts/pdf"),
    "http://retainpdf.local:41000/api/v1/jobs/1/artifacts/pdf",
  );
  assert.equal(
    artifacts.resolveResourceUrl("api/v1/jobs/1/artifacts/pdf"),
    "http://retainpdf.local:41000/api/v1/jobs/1/artifacts/pdf",
  );
  assert.equal(
    artifacts.resolveResourceUrl("jobs/1/artifacts/pdf"),
    "http://retainpdf.local:41000/jobs/1/artifacts/pdf",
  );
});

test("artifact url resolver accepts injected api base", () => {
  const resolver = artifacts.createArtifactUrlResolver({
    resolveApiBase: () => "http://injected.local/api/v1",
  });

  assert.equal(
    resolver.resolve("/api/v1/jobs/1/artifacts/pdf"),
    "http://injected.local/api/v1/jobs/1/artifacts/pdf",
  );
  assert.equal(
    artifacts.resolveResourceUrl("api/v1/jobs/1/artifacts/pdf", { resolver }),
    "http://injected.local/api/v1/jobs/1/artifacts/pdf",
  );
  assert.equal(
    artifacts.resolveResourceUrl("jobs/1/artifacts/pdf", { resolver }),
    "http://injected.local/jobs/1/artifacts/pdf",
  );
  assert.equal(
    artifacts.resolveResourceUrl("https://cdn.example/a.pdf", { resolver }),
    "https://cdn.example/a.pdf",
  );
});

test("artifact url config port owns default api base dependency", () => {
  const configPort = artifactUrlConfig.createArtifactUrlConfigPort({
    resolveApiBase: () => "http://config-port.local/api/v1",
  });
  const resolver = artifacts.createArtifactUrlResolver({
    resolveApiBase: configPort.resolveApiBase,
  });

  assert.equal(
    resolver.resolve("/api/v1/jobs/job-1/pdf"),
    "http://config-port.local/api/v1/jobs/job-1/pdf",
  );
});

test("resource resolver preserves existing schemes and appends query once", () => {
  assert.equal(
    artifacts.resolveResourceUrl("https://cdn.example/a.pdf"),
    "https://cdn.example/a.pdf",
  );
  assert.equal(
    artifacts.resolveResourceUrl("mock://artifact.zip"),
    "mock://artifact.zip",
  );
  assert.equal(
    artifacts.appendResourceQuery("http://x.test/a.zip?include_job_dir=true", {
      include_job_dir: "true",
    }),
    "http://x.test/a.zip?include_job_dir=true",
  );
  assert.equal(
    artifacts.appendResourceQuery("http://x.test/a.zip?download=1", {
      include_job_dir: "true",
    }),
    "http://x.test/a.zip?download=1&include_job_dir=true",
  );
});

test("manifest artifact url uses unified resource resolver and include_job_dir query", () => {
  const manifest = {
    items: [
      {
        artifact_key: "source_pdf",
        ready: true,
        resource_path: "/api/v1/jobs/job-1/artifacts/source_pdf",
      },
      {
        artifact_key: "markdown_bundle_zip",
        ready: true,
        resource_url: "/api/v1/jobs/job-1/artifacts/markdown_bundle_zip?download=1",
      },
    ],
  };

  assert.equal(
    artifacts.resolveManifestArtifactUrl(manifest, "source_pdf"),
    "http://retainpdf.local:41000/api/v1/jobs/job-1/artifacts/source_pdf",
  );
  assert.equal(
    artifacts.resolveManifestArtifactUrl(manifest, "markdown_bundle_zip", { includeJobDir: true }),
    "http://retainpdf.local:41000/api/v1/jobs/job-1/artifacts/markdown_bundle_zip?download=1&include_job_dir=true",
  );
});

test("artifact runtime port supplies source pdf name for download naming", () => {
  const state = {
    currentJobId: "job-artifact-runtime",
    currentJobSnapshot: {
      job_id: "job-artifact-runtime",
    },
    currentJobManifestJobId: "job-artifact-runtime",
    currentJobManifest: {
      items: [
        {
          artifact_key: "source_pdf",
          file_name: "Runtime Source.pdf",
          ready: true,
        },
      ],
    },
  };

  assert.equal(
    artifacts.resolveSourcePdfDownloadName(state, "fallback.pdf"),
    "Runtime Source.pdf",
  );
  assert.equal(
    artifacts.resolveTranslatedPdfDownloadName(state, "fallback.pdf"),
    "zh_Runtime Source.pdf",
  );
});

test("artifact runtime port supplies uploaded file name for download naming", () => {
  const state = {
    currentJobId: "job-upload-name",
    currentJobSnapshot: {
      job_id: "job-upload-name",
    },
    uploadedFileName: "Uploaded Source.pdf",
  };

  assert.equal(
    artifacts.resolveSourcePdfDownloadName(state, "fallback.pdf"),
    "Uploaded Source.pdf",
  );
  assert.equal(
    artifacts.resolveTranslatedPdfDownloadName(state, "fallback.pdf"),
    "zh_Uploaded Source.pdf",
  );
});

test("job source pdf fallback is encoded and absolute", () => {
  const action = jobActions.resolveJobSourcePdfAction({
    job_id: "job 1/2",
  });
  assert.equal(action.ready, false);
  assert.equal(
    action.url,
    "http://retainpdf.local:41000/api/v1/jobs/job%201%2F2/artifacts/source_pdf",
  );
});

test("job source pdf action becomes ready only from explicit readiness signals", () => {
  const action = jobActions.resolveJobSourcePdfAction({
    job_id: "job-ready",
    source_pdf_ready: true,
  });
  assert.equal(action.ready, true);
  assert.equal(
    action.url,
    "http://retainpdf.local:41000/api/v1/jobs/job-ready/artifacts/source_pdf",
  );
});

test("markdown asset resolver keeps special URLs and resolves relative images", () => {
  assert.equal(
    artifacts.resolveMarkdownAssetUrl("http://retainpdf.local/images/", "page-1.png"),
    "http://retainpdf.local/images/page-1.png",
  );
  assert.equal(
    artifacts.resolveMarkdownAssetUrl("http://retainpdf.local/images/", "/api/v1/jobs/1/markdown/images/p.png"),
    "http://retainpdf.local:41000/api/v1/jobs/1/markdown/images/p.png",
  );
  // path 常带 images/ 前缀，base 已是 .../markdown/images/ —— 不得拼成双 images/
  assert.equal(
    artifacts.resolveMarkdownAssetUrl(
      "http://127.0.0.1:41000/api/v1/jobs/j1/markdown/images/",
      "images/page-1/imgs/chart.png",
    ),
    "http://127.0.0.1:41000/api/v1/jobs/j1/markdown/images/page-1/imgs/chart.png",
  );
  assert.equal(artifacts.resolveMarkdownAssetUrl("", "data:image/png;base64,abc"), "data:image/png;base64,abc");
  assert.equal(artifacts.resolveMarkdownAssetUrl("", "blob:abc"), "blob:abc");
  assert.equal(artifacts.resolveMarkdownAssetUrl("", "#anchor"), "#anchor");
});
