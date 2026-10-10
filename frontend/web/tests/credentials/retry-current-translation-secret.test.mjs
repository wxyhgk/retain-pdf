// 重试带上设置里当前的翻译密钥：用户换了 Key 之后，重试不该还用原任务那把被拒的旧 Key。
import test from "node:test";
import assert from "node:assert/strict";
import {
  createRetryWithCurrentTranslationSecret,
  withCurrentTranslationSecret,
} from "../../src/features/credentials/domain/retry-translation-secret.js";

const DASHSCOPE = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const NEW_KEY = "test-new-key";

function harness({ sourceBaseUrl = DASHSCOPE, current, fetchFails = false } = {}) {
  const calls = [];
  const retry = createRetryWithCurrentTranslationSecret({
    retryJobStage: async (jobId, apiPrefix, stage, payload) => {
      calls.push({ jobId, apiPrefix, stage, payload });
      return { job_id: "next" };
    },
    fetchJobPayload: async () => {
      if (fetchFails) throw new Error("boom");
      return { request_payload: { translation: { base_url: sourceBaseUrl, credential_ref: "cred_old" } } };
    },
    readCurrent: () => current ?? { baseUrl: `${DASHSCOPE}/`, modelApiKey: NEW_KEY, translationCredentialRef: "" },
  });
  return { retry, calls };
}

test("换了 Key 之后重试：overrides.translation 带上新 api_key，后端给的其它 overrides 原样保留", async () => {
  const { retry, calls } = harness();
  await retry("job-1", "/api/v1", "translation", {
    ambiguous_request_policy: "accept_duplicate_risk",
    overrides: { translation: { workers: 4 }, render: { compile_workers: 2 } },
  });
  assert.deepEqual(calls[0].payload, {
    ambiguous_request_policy: "accept_duplicate_risk",
    overrides: { translation: { workers: 4, api_key: NEW_KEY }, render: { compile_workers: 2 } },
  });
});

test("当前设置是别家接口：不注入，免得密钥和原任务的接口对不上", async () => {
  const { retry, calls } = harness({ current: { baseUrl: "https://api.deepseek.com/v1", modelApiKey: NEW_KEY } });
  const body = { overrides: { translation: { workers: 4 } } };
  await retry("job-1", "/api/v1", "translation", body);
  assert.equal(calls[0].payload, body);
});

test("读不到原任务时照原样重试", async () => {
  const { retry, calls } = harness({ fetchFails: true });
  await retry("job-1", "/api/v1", "render", {});
  assert.deepEqual(calls[0].payload, {});
});

test("精修：只带凭据库引用（后端原地精修不收明文 Key），mode / start_page 不丢", () => {
  const body = { create_new_job: false, refine: { mode: "editorial", start_page: 24 } };
  const withRef = withCurrentTranslationSecret("refine", body, {
    sourceBaseUrl: DASHSCOPE,
    current: { baseUrl: DASHSCOPE, modelApiKey: NEW_KEY, translationCredentialRef: "cred_new" },
  });
  assert.deepEqual(withRef, { ...body, overrides: { translation: { credential_ref: "cred_new" } } });
  const keyOnly = withCurrentTranslationSecret("refine", body, {
    sourceBaseUrl: DASHSCOPE,
    current: { baseUrl: DASHSCOPE, modelApiKey: NEW_KEY },
  });
  assert.equal(keyOnly, body);
});

test("调用方已指定密钥或换了接口（「重新翻译」用当前配置）时按它的接口判断、不覆盖", () => {
  const explicit = { overrides: { translation: { base_url: DASHSCOPE, api_key: "chosen" } } };
  assert.equal(withCurrentTranslationSecret("translation", explicit, {
    sourceBaseUrl: DASHSCOPE, current: { baseUrl: DASHSCOPE, modelApiKey: NEW_KEY },
  }), explicit);
  const switched = withCurrentTranslationSecret("translation", { overrides: { translation: { base_url: DASHSCOPE } } }, {
    sourceBaseUrl: "https://api.deepseek.com/v1", current: { baseUrl: DASHSCOPE, modelApiKey: NEW_KEY },
  });
  assert.equal(switched.overrides.translation.api_key, NEW_KEY);
});
