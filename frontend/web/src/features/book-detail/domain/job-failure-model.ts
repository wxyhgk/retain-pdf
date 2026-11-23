/** 把后端那份失败简报翻成「用户该做什么」。
 *
 * # 为什么需要这一层
 *
 * 后端给的是分类代号（provider / timeout / translation / render / internal）和一句
 * 通用 summary。真实数据里那句 summary 常常是「任务失败，但暂未识别出明确根因」——
 * 对用户没有任何信息量，而旁边的 `failure_category=provider` + `provider=mineru`
 * 其实已经说清了「上游的问题，重试大概率能过」。
 *
 * 所以这里不直接把后端文案摆上去，而是按分类给出**该怎么办**。
 *
 * # 真实分布（15 本书 61 个任务里的 17 次失败）
 *
 *     provider / ocr          6   MinerU 解析失败，错误里自己写着 try again later
 *     translation             4   导出闸拦住（后来已修）
 *     timeout / ocr           3   上传超时
 *     render                  2
 *     internal                2   SQLite 锁冲突
 *
 * 17/17 都是 retryable。
 */

import type { JobFailureBrief } from "@/platform/contracts/library-payloads.js";
import type { JobFailureFacts } from "./job-failure-detail.js";

export type FailureAdvice = {
  /** 一行标题：说清是谁的问题。 */
  title: string;
  /** 该怎么办。后端 suggestion 质量参差，这里按分类给确定的说法。 */
  action: string;
  /** 重试大概率有用吗 —— 决定重试按钮是主按钮还是次按钮。 */
  retryLikelyHelps: boolean;
  /** 要先去设置里改（换 Key）才能修好：卡片上给一个直达「设置 → 接口」的按钮，值是按钮上的字。 */
  settingsAction?: string;
};

/** 键必须覆盖 Python 侧 `_failure_category_for` 发得出的全部取值。
 *
 * 取值不是我们这边定的 —— 产生方是
 * `backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py`。
 * 第一版这里只写了 5 个，而产生方发 9 个，于是「API Key 错了」会被说成
 * 「可以先重试一次」，用户照着点必然再失败一次。
 *
 * `job-failure-categories.test.mjs` 从产生方抽取值对账，不是循环这里的键 ——
 * 循环自己实现了的那几个，等于只证明了「我写了的我写了」。
 */
const BY_CATEGORY: Record<string, FailureAdvice> = {
  provider: {
    title: "上游服务没能处理这份文件",
    action: "多数是对方临时故障，隔一会儿重试通常能过。连续几次都失败再换解析方式。",
    retryLikelyHelps: true,
  },
  timeout: {
    title: "等待上游超时",
    action: "文件大或网络慢时会这样，直接重试。",
    retryLikelyHelps: true,
  },
  translation: {
    title: "翻译阶段中断",
    action: "已翻好的部分有断点记录，从断点继续只翻剩下的，不会整本重翻、不会重复付费。",
    retryLikelyHelps: true,
  },
  render: {
    title: "生成最终 PDF 时失败",
    action: "译文还在，从断点继续只重跑排版这一步，不调用模型。",
    retryLikelyHelps: true,
  },
  internal: {
    title: "本机内部错误",
    action: "通常是并发写同一个库导致的瞬时冲突，重试即可。反复出现请把诊断信息发出来。",
    retryLikelyHelps: true,
  },

  // 下面五类是补的。它们的共同点是：**重试不解决问题**，所以不能把用户往重试上引。
  auth: {
    title: "凭据被拒",
    action: "上游不认这个 API Key —— 原样重试解决不了。去设置里换一个有效的 Key（确认额度没用完、没过期），再点重试：重试会用设置里的新 Key。",
    retryLikelyHelps: false,
    settingsAction: "去设置换 Key",
  },
  // 上游 HTTP 402（余额不足、欠费）。OCR 和翻译都可能。能不能从翻译接着跑看后端的 resume_from，
  // 状态行的主按钮照它显示，这里不写死「从翻译继续」。
  billing: {
    title: "上游账户余额不足",
    action: "服务商那边余额不足或欠费，充值前原样重试会同样失败。先去服务商充值、或在设置里换一个有余额的 Key，再点重试。",
    retryLikelyHelps: false,
    settingsAction: "去设置",
  },
  input: {
    title: "这份文件本身有问题",
    action: "源文件读不出来或结构损坏 —— 重试解决不了。换一份文件，或先用别的工具修一下这个 PDF。",
    retryLikelyHelps: false,
  },
  rate_limit: {
    title: "被上游限流了",
    action: "请求太密。等几分钟再重试；如果经常这样，去设置里把并发调小。",
    retryLikelyHelps: true,
  },
  network: {
    title: "连不上上游",
    action: "先确认本机能上网、代理没挂。网络恢复后重试即可。",
    retryLikelyHelps: true,
  },
  // 2026-11-23 后端加的：内存不够、路径太长、没有权限、软件运行环境坏了（out_of_memory、path_too_long、
  // local_permission_denied、runtime_environment_broken）。都是这台电脑上的事，原样重试没用。
  environment: {
    title: "这台电脑上的环境出了问题",
    action: "内存不够、文件路径太长、没有权限或软件文件损坏 —— 重试解决不了。看下面的原因：内存不够就关掉别的程序或少翻几页；路径太长就把书名改短；没权限检查安装目录和杀毒软件；软件文件损坏就重新安装。",
    retryLikelyHelps: false,
  },
  normalization: {
    title: "整理 OCR 结果时失败",
    action: "OCR 产物的结构不是预期的样子，重跑同一份大概率还是这样。建议换一种解析方式重做 OCR。",
    retryLikelyHelps: false,
  },
};

const FALLBACK: FailureAdvice = {
  title: "任务失败",
  action: "可以先用下面的按钮再试一次；仍然失败请复制诊断信息。",
  retryLikelyHelps: true,
};

export function failureAdvice(failure?: JobFailureBrief | null): FailureAdvice {
  if (!failure) return FALLBACK;
  const base = BY_CATEGORY[`${failure.category || ""}`.trim().toLowerCase()] ?? FALLBACK;
  // 后端说不可重试时，不管分类怎么写都不能怂恿用户去点重试。
  // 但分类本来就是「重试没用、该先做别的」（换 Key、换文件、换解析方式）时，它那句说法就是答案，
  // 不能盖成「请复制诊断信息」：Key 被拒（auth_failed）后端一律标不可重试，盖掉以后用户就不知道该去换 Key 了。
  if (!failure.retryable) {
    if (!base.retryLikelyHelps && base !== FALLBACK) return base;
    return { ...base, retryLikelyHelps: false, action: "这次失败重试解决不了，请复制诊断信息。" };
  }
  return base;
}

/** 卡片上那行副标题：谁、哪一段。 */
export function failureSubtitle(failure?: JobFailureBrief | null): string {
  if (!failure) return "";
  const stage = { ocr: "OCR", translation: "翻译", render: "渲染" }[`${failure.stage || ""}`.trim()]
    ?? failure.stage;
  const raw = `${failure.upstream?.provider || failure.provider || ""}`.trim();
  // 「OCR · ocr」「翻译 · translation」不提供信息，去掉；厂商编号换成用户在设置里看到的名字。
  const provider = raw === "ocr" || raw === "translation" ? "" : PROVIDER_LABELS[raw] ?? raw;
  return provider ? `${stage} · ${provider}` : `${stage}`;
}

/** 厂商编号（错误码目录的 vendor id）→ 设置里显示的名字；认不出的原样返回。 */
export function providerLabel(id: string): string {
  return PROVIDER_LABELS[id] ?? id;
}

/** 失败里的厂商编号（错误码目录的 vendor id）→ 设置里显示的名字。 */
const PROVIDER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  paddle: "PaddleOCR",
  mineru: "MinerU",
  glm_ocr: "GLM-OCR",
  local: "本机 OCR",
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  zhipu: "智谱",
  qwen: "Qwen",
  opencode: "OpenCode Go",
  custom: "自定义接口",
});

/** 复制给排查用的那段文本。
 *
 * 刻意是纯文本而不是 JSON：用户是粘进聊天框发给我的，JSON 在那里会被折行糊成一团。
 * 也刻意**不含**任何路径和 key —— 诊断信息会被贴到外面去。
 */
export function failureDiagnosticText(input: {
  failure?: JobFailureBrief | null;
  jobId?: string;
  detail?: string;
  /** 任务详情里的失败码、上游的码和地址、这次用的 OCR 和模型（见 job-failure-detail.ts）。取不到时只用简报。 */
  facts?: JobFailureFacts | null;
  /** 软件版本和运行环境，比如「2026.11.22 · 桌面版 darwin」。 */
  environment?: string;
}): string {
  const { failure, jobId, facts, environment } = input;
  const detail = input.detail || facts?.detail || "";
  const upstream = [
    facts?.provider || failure?.provider,
    facts?.providerCode ? `码 ${facts.providerCode}` : "",
    facts?.upstreamHost,
  ].filter(Boolean).join(" · ");
  const lines = [
    `任务: ${jobId || "(未知)"}`,
    environment ? `版本: ${environment}` : "",
    facts?.failureCode ? `失败码: ${facts.failureCode}` : "",
    failure ? `分类: ${failure.category} / ${facts?.failedStage || failure.stage}` : "",
    upstream ? `上游: ${upstream}` : "",
    facts?.ocrProvider ? `OCR: ${facts.ocrProvider}` : "",
    facts?.translationModel || facts?.translationHost
      ? `翻译模型: ${[facts?.translationModel, facts?.translationHost].filter(Boolean).join(" @ ")}`
      : "",
    failure ? `可重试: ${failure.retryable ? "是" : "否"}` : "",
    failure?.root_cause ? `根因: ${failure.root_cause}` : "",
    facts?.recoveryHint ? `建议: ${facts.recoveryHint}` : "",
    detail ? `\n完整错误:\n${detail}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
