// 重跑类请求（retry-stage / resume / rerun）带上设置里当前的翻译密钥：用户换了 Key 之后，
// 不该还用原任务那把被拒的旧 Key。
import test from "node:test";
import assert from "node:assert/strict";
import {
  createTranslationSecretInjector,
  jobIdFromActionUrl,
  withCurrentTranslationSecret,
} from "../../src/platform/api/translation-secret.js";

const DASHSCOPE = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const NEW_KEY = "test-new-key";

function injector({ sourceBaseUrl = DASHSCOPE, current, readFails = false } = {}) {
  const reads = [];
  const inject = createTranslationSecretInjector({
    readJob: async (jobId, apiPrefix) => {
      reads.push({ jobId, apiPrefix });
      if (readFails) throw new Error("boom");
      return { request_payload: { translation: { base_url: sourceBaseUrl, credential_ref: "cred_old" } } };
    },
    readCurrent: () => current ?? { baseUrl: `${DASHSCOPE}/`, modelApiKey: NEW_KEY, translationCredentialRef: "" },
  });
  return { inject, reads };
}

test("换了 Key 之后重跑：overrides.translation 带上新 api_key，后端给的其它字段原样保留", async () => {
  const { inject, reads } = injector();
  const body = await inject("job-1", "/api/v1", {
    ambiguous_request_policy: "accept_duplicate_risk",
    overrides: { translation: { workers: 4 }, render: { compile_workers: 2 } },
  });
  assert.deepEqual(body, {
    ambiguous_request_policy: "accept_duplicate_risk",
    overrides: { translation: { workers: 4, api_key: NEW_KEY }, render: { compile_workers: 2 } },
  });
  assert.deepEqual(reads, [{ jobId: "job-1", apiPrefix: "/api/v1" }]);
});

test("续跑 / 重跑不带请求体时也补上 overrides.translation", async () => {
  const { inject } = injector();
  assert.deepEqual(await inject("job-1", "/api/v1", {}), { overrides: { translation: { api_key: NEW_KEY } } });
});

test("精修：mode / start_page 保留，新 Key 一起带上（后端原地精修现在收明文 Key）", async () => {
  const { inject } = injector();
  const body = await inject("job-1", "/api/v1", { create_new_job: false, refine: { mode: "editorial", start_page: 24 } });
  assert.deepEqual(body, {
    create_new_job: false,
    refine: { mode: "editorial", start_page: 24 },
    overrides: { translation: { api_key: NEW_KEY } },
  });
});

test("只存了凭据库引用时带 credential_ref", async () => {
  const { inject } = injector({ current: { baseUrl: DASHSCOPE, modelApiKey: "", translationCredentialRef: "cred_new" } });
  assert.deepEqual(await inject("job-1", "/api/v1", {}), { overrides: { translation: { credential_ref: "cred_new" } } });
});

test("当前设置是别家接口：不注入，免得密钥和原任务的接口对不上", async () => {
  const { inject } = injector({ current: { baseUrl: "https://api.deepseek.com/v1", modelApiKey: NEW_KEY } });
  const body = { overrides: { translation: { workers: 4 } } };
  assert.equal(await inject("job-1", "/api/v1", body), body);
});

test("读不到原任务、没有任务号、设置里没有 Key：都照原样发，后两种不去读任务", async () => {
  assert.deepEqual(await injector({ readFails: true }).inject("job-1", "/api/v1", {}), {});
  const noId = injector();
  assert.deepEqual(await noId.inject("", "/api/v1", {}), {});
  const noKey = injector({ current: { baseUrl: DASHSCOPE } });
  assert.deepEqual(await noKey.inject("job-1", "/api/v1", {}), {});
  assert.equal(noId.reads.length + noKey.reads.length, 0);
});

test("调用方已指定密钥时不覆盖；换了接口时按它要换去的接口判断", () => {
  const explicit = { overrides: { translation: { base_url: DASHSCOPE, api_key: "chosen" } } };
  assert.equal(withCurrentTranslationSecret(explicit, {
    sourceBaseUrl: DASHSCOPE, current: { baseUrl: DASHSCOPE, modelApiKey: NEW_KEY },
  }), explicit);
  const switched = withCurrentTranslationSecret({ overrides: { translation: { base_url: DASHSCOPE } } }, {
    sourceBaseUrl: "https://api.deepseek.com/v1", current: { baseUrl: DASHSCOPE, modelApiKey: NEW_KEY },
  });
  assert.equal(switched.overrides.translation.api_key, NEW_KEY);
});

test("rerun / resume 的动作链接里取任务号", () => {
  assert.equal(jobIdFromActionUrl("http://127.0.0.1:41000/api/v1/jobs/20261010-ab12/rerun"), "20261010-ab12");
  assert.equal(jobIdFromActionUrl("http://127.0.0.1:41000/api/v1/jobs/20261010-ab12/resume"), "20261010-ab12", "后端会把 rerun 链接换成 resume");
  assert.equal(jobIdFromActionUrl("/api/v1/jobs/job%2F1/rerun?x=1"), "job/1");
  assert.equal(jobIdFromActionUrl("/api/v1/jobs"), "");
  assert.equal(jobIdFromActionUrl(""), "");
});
