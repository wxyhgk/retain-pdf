/** 「从断点继续」走真实接口时必须带 /api/v1 前缀。
 *
 * 事故：书籍详情调 resumeJob(jobId) / fetchResumePlan(jobId) 时没传接口前缀，请求打到
 * /jobs/:id/resume（少了 /api/v1），一律 404；外面的 catch 把它静默降级成显式重跑，
 * 于是「失败先断点恢复」从没在线上生效过，测试也全绿（测试都注入了替身）。
 * 这里不注入替身，直接看发出去的 URL。 */
import test from "node:test";
import assert from "node:assert/strict";
import { makeDom } from "../helpers/dom.mjs";
import { waitFor } from "../helpers/async.mjs";

test("默认实现读续跑计划、提交续跑，URL 都带 /api/v1", async () => {
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div></body></html>" });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useBookDetailResume } = await import("../../src/features/book-detail/ui/use-book-detail-resume.js");
  const urls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(`${url}`);
    const body = `${url}`.endsWith("/resume-plan")
      ? { code: 0, data: { can_resume: true, from_stage: "render" } }
      : { code: 0, data: { job_id: "job-1", status: "queued" } };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  let api = null;
  const submitted = [];
  function Probe() {
    api = useBookDetailResume({
      open: true,
      job: { job_id: "job-1", status: "failed", document_id: "doc-1" },
      onJobSubmitted: (job) => submitted.push(job),
    });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  try {
    root.render(React.createElement(Probe));
    await waitFor(() => api?.plan?.from_stage === "render", "读到续跑计划");
    await api.resume();
    const planUrl = urls.find((url) => url.endsWith("/resume-plan"));
    const resumeUrl = urls.find((url) => url.endsWith("/resume"));
    assert.match(planUrl || "", /\/api\/v1\/jobs\/job-1\/resume-plan$/, `续跑计划请求少了接口前缀：${planUrl}`);
    assert.match(resumeUrl || "", /\/api\/v1\/jobs\/job-1\/resume$/, `续跑请求少了接口前缀：${resumeUrl}`);
    assert.equal(submitted[0]?.job_id, "job-1");
    assert.equal(submitted[0]?.source_job_id, "job-1");
  } finally {
    globalThis.fetch = originalFetch;
    root.unmount();
    dom.window.close();
  }
});
