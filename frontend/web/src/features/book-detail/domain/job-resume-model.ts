// 失败 / 取消后的「从断点继续」：把后端续跑计划（GET /jobs/:id/resume-plan）翻成按钮上的话。
//
// 以前失败卡片上的「重试」接的是「翻译整本」：新建任务、从 OCR 起全部重跑。渲染失败点一下，
// 白花一整本的翻译费用。后端早有续跑计划，说得清从哪一步接着跑、沿用哪些已有结果：
//   - 已有译文 → 从渲染继续，只重新排版，不调用模型；
//   - 只有 OCR → 从翻译继续；有翻译断点时只翻没翻完的部分；
//   - OCR 都没成 / 模型连接不支持 / 有重复计费风险 → 不能续跑，说清原因。
// 这里只做翻译，不发请求（请求在 ui/use-book-detail-resume.ts）。

export type JobResumePlan = {
  can_resume?: boolean;
  job_id?: string;
  from_stage?: string | null;
  reuses_artifacts?: string[] | null;
  reruns_stages?: string[] | null;
  reason?: string | null;
};

export type ResumeDescription = {
  /** 能不能一键续跑。 */
  available: boolean;
  /** 主按钮文字，例如「从渲染继续」。 */
  label: string;
  /** 按钮下面一句：沿用什么、重跑什么、花不花钱。 */
  hint: string;
  /** 不能续跑时的原因（给用户看的中文）。 */
  unavailableReason: string;
};

const STAGE_LABEL: Record<string, string> = {
  ocr: "OCR",
  translate: "翻译",
  translation: "翻译",
  render: "渲染",
  rendering: "渲染",
};

function text(value: unknown): string {
  return `${value ?? ""}`.trim();
}

export function resumeStageLabel(stage: unknown): string {
  return STAGE_LABEL[text(stage).toLowerCase()] || "";
}

function unavailableReasonOf(plan: JobResumePlan): string {
  const reason = text(plan.reason);
  if (!text(plan.from_stage)) {
    return "OCR 没有完成，没有可以接着用的结果，只能从 OCR 重新开始。";
  }
  if (/rust model|execution_connection/i.test(reason)) {
    return "这次翻译用的模型连接不支持断点续跑，只能重新翻译。";
  }
  if (/recovery is blocked|retry polic/i.test(reason)) {
    return "上次有翻译请求发出后没收到结果，接着跑可能重复计费。要继续请在「重新处理」里确认后重新翻译。";
  }
  if (/queued or running/i.test(reason)) {
    return "任务还在运行，先取消才能重新处理。";
  }
  return reason ? `暂时不能从断点继续（${reason}）。` : "暂时不能从断点继续。";
}

export function describeResume(plan: JobResumePlan | null | undefined): ResumeDescription {
  if (!plan) {
    return { available: false, label: "", hint: "", unavailableReason: "" };
  }
  if (!plan.can_resume) {
    return { available: false, label: "", hint: "", unavailableReason: unavailableReasonOf(plan) };
  }
  const stage = text(plan.from_stage).toLowerCase();
  const reuses = new Set((plan.reuses_artifacts || []).map(text));
  if (stage === "render") {
    return {
      available: true,
      label: "从渲染继续",
      hint: "沿用已有译文，只重新排版。不调用模型，不产生费用。",
      unavailableReason: "",
    };
  }
  if (stage === "translate" || stage === "translation") {
    return {
      available: true,
      label: "从翻译继续",
      hint: reuses.has("translation_checkpoint_json")
        ? "沿用 OCR 和已经翻好的部分，接着翻译剩下的，再排版。剩下的部分会产生翻译费用。"
        : "沿用 OCR，重新翻译再排版。会产生翻译费用。",
      unavailableReason: "",
    };
  }
  const label = resumeStageLabel(stage);
  return {
    available: true,
    label: label ? `从${label}继续` : "从断点继续",
    hint: "沿用已经完成的部分，从中断的地方接着处理。",
    unavailableReason: "",
  };
}
