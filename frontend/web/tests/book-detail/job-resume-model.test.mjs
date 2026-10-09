/** 续跑计划 → 按钮文案。
 *
 * 失败卡片以前只有一个「重试」，接的是「翻译整本」。现在主按钮按后端续跑计划说清：
 * 从哪一步接着跑、沿用什么、花不花钱；不能续跑时说清原因。文案错一句，用户就会
 * 以为「不花钱」而点了要花钱的那个。 */
import test from "node:test";
import assert from "node:assert/strict";
import { describeResume, resumeStageLabel } from "../../src/features/book-detail/domain/job-resume-model.js";

test("已有译文 → 从渲染继续，不调用模型", () => {
  const d = describeResume({ can_resume: true, from_stage: "render", reruns_stages: ["rendering"] });
  assert.equal(d.available, true);
  assert.equal(d.label, "从渲染继续");
  assert.match(d.hint, /不调用模型/);
});

test("有翻译断点 → 从翻译继续，只翻剩下的", () => {
  const d = describeResume({
    can_resume: true, from_stage: "translate",
    reuses_artifacts: ["normalized_document_json", "translation_checkpoint_json"],
  });
  assert.equal(d.label, "从翻译继续");
  assert.match(d.hint, /已经翻好的部分/);
});

test("没有翻译断点 → 从翻译继续，但要说会产生翻译费用", () => {
  const d = describeResume({ can_resume: true, from_stage: "translate", reuses_artifacts: ["normalized_document_json"] });
  assert.match(d.hint, /会产生翻译费用/);
  assert.doesNotMatch(d.hint, /已经翻好的部分/);
});

test("不能续跑时给中文原因，不把后端英文原样甩给用户", () => {
  assert.match(describeResume({ can_resume: false, from_stage: null }).unavailableReason, /OCR 没有完成/);
  assert.match(
    describeResume({ can_resume: false, from_stage: "translate", reason: "Rust model recovery requires successful receipt reuse" }).unavailableReason,
    /不支持断点续跑/,
  );
  assert.match(
    describeResume({ can_resume: false, from_stage: "translate", reason: "translation recovery is blocked; consult supported retry policies" }).unavailableReason,
    /重复计费/,
  );
  assert.equal(describeResume({ can_resume: true, from_stage: "render" }).unavailableReason, "");
});

test("没有计划时什么都不承诺", () => {
  assert.deepEqual(describeResume(null), { available: false, label: "", hint: "", unavailableReason: "" });
});

test("阶段名翻成中文", () => {
  assert.equal(resumeStageLabel("translate"), "翻译");
  assert.equal(resumeStageLabel("rendering"), "渲染");
  assert.equal(resumeStageLabel("done"), "");
});
