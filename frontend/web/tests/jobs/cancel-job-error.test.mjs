/** 取消失败时，原因要落在发起取消的那张任务卡上。
 *
 * 以前只写进 error-box，而 error-box 只在「添加 PDF」弹窗里显示；从书籍详情取消
 * 失败时用户什么都看不到，按钮恢复可点，像是什么都没发生。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createCancelCurrentJob } from "../../src/features/jobs/domain/runtime/cancel-job.js";

function harness({ cancelJob }) {
  const calls = { disabled: [], errors: [], texts: [] };
  const cancel = createCancelCurrentJob({
    currentJobPort: { jobId: () => "job-1", snapshot: () => ({ workflow: "book" }) },
    shellViewPort: {
      setCancelDisabled: (value) => calls.disabled.push(value),
      setCancelError: (message) => calls.errors.push(message),
    },
    setText: (id, value) => calls.texts.push([id, value]),
    cancelJob,
    cancelOcrJob: async () => ({}),
    apiPrefix: "/api",
    fetchJob: async () => ({}),
  });
  return { cancel, calls };
}

test("取消请求失败：原因写进任务卡，按钮恢复可点", async () => {
  const { cancel, calls } = harness({ cancelJob: async () => { throw new Error("服务暂时不可用 (503)"); } });
  await cancel();
  assert.deepEqual(calls.disabled, [true, false]);
  assert.equal(calls.errors[0], "", "开始取消时要清掉上一次的失败原因");
  assert.match(calls.errors.at(-1), /503/, "失败原因没落到任务卡上");
});

test("取消成功：不留失败原因，按钮保持锁定直到状态变为已取消", async () => {
  const { cancel, calls } = harness({ cancelJob: async () => ({ status: "canceled" }) });
  await cancel();
  assert.deepEqual(calls.disabled, [true]);
  assert.deepEqual(calls.errors, [""]);
});
