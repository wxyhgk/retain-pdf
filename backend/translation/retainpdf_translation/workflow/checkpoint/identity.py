from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from retainpdf_translation.core.engine_identity import translation_engine_identity

if TYPE_CHECKING:
    from retainpdf_translation.workflow.execution import TranslationExecutionRequest
    from retainpdf_translation.workflow.execution_plan import TranslationExecutionPlan


def _sha256_file(path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sha256_json(payload: object) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def build_document_identity(
    *,
    normalized_document_path: Path,
    parameters_sha256: str,
) -> dict[str, str]:
    """Bind normalized document bytes to an existing translation parameter identity."""
    payload = {
        "normalized_document_sha256": _sha256_file(normalized_document_path),
        "parameters_sha256": parameters_sha256,
    }
    return {**payload, "fingerprint": _sha256_json(payload)}


def resumes_streamed_attempt(previous: dict, identity: dict, source_pdf_path: str | Path | None) -> bool:
    """跟着 OCR 翻的那次留下的检查点，能不能让这次不跟着 OCR 的接着用。

    跟着 OCR 翻时指纹按原文 PDF 算（归一化文档每来一批页都在变），OCR 做完以后再翻（重试翻译）指纹按规范化文档算，
    两种指纹永远对不上：以前跟着 OCR 翻了 6.86 万条的书一重试就从头翻（2026-11-03，任务 20261103044311-4bdc13）。
    翻译参数一样、原文 PDF 是同一份就接得上；页里每一条照旧按条目指纹核对（`_replay_durable_checkpoint`），
    原文变了的页不会沿用。
    """
    streamed_pdf_sha256 = str(previous.get("ocr_stream_source_pdf_sha256") or "")
    if not streamed_pdf_sha256 or "ocr_stream_source_pdf_sha256" in identity:
        return False
    if not previous.get("parameters_sha256") or previous.get("parameters_sha256") != identity.get("parameters_sha256"):
        return False
    if source_pdf_path is None:
        return False
    path = Path(source_pdf_path)
    return path.is_file() and _sha256_file(path) == streamed_pdf_sha256


# 续跑指纹里不放模型产出的东西（2026-11-26 审查一级第 2 条）。
#
# 指纹管的是「拿旧译文接着翻还对不对」，应该只由输入决定：原文、页范围、模式、规则、术语表、模型、引擎。
# 以前 `vars(policy_config)` 整个进了指纹，里面的 `domain_context` 是领域识别模型的输出；目录 agent 的定译
# （`fixed_translations_sha256`）也是模型产出。两样都会在续跑时变：
#
# - 第一次识别失败（Windows 上 SIGALRM 不存在，#224 以前每次都失败；网络错误；目录 agent 失败）结果是空的、
#   不写缓存，下一次成功了；
# - 换了任务目录（Rust 导入断点时不拷目录 agent 的产物），模型重新跑一遍，结果不逐字节一致。
#
# 指纹一变：跨任务续跑丢掉全部已译页从头翻（`discard_copied_resume_candidate`），同一任务内续跑报
# fingerprint mismatch、以后永远失败。#224 修好 Windows 的领域识别以后，Windows 上的旧任务重试时识别第一次
# 真的成功，指纹必变，整本重翻。
#
# 拿掉以后的代价：续跑时用的领域上下文、定译可能和第一次不同——已经译好的块不动，后面的块按这一次的领域提示、
# 定译翻。领域上下文只是给模型的风格提示（领域摘要和翻译建议），不改规则、术语表；定译只管目录标题那几块，
# 已经译好的标题不重翻。最坏是同一本书前后两段的措辞风格略有差别，比起整本作废重翻（白花钱、等几个小时）
# 或者永远失败，这个代价可以接受。把这些模型决定第一次产生时冻结进断点、续跑只读不重算，是下一步的设计
# （见 docs/ops/planning/translation-state/），这次不做。
MODEL_OUTPUT_POLICY_FIELDS = ("domain_context",)


def _resolved_policy(policy_config) -> dict[str, Any]:
    resolved = dict(vars(policy_config))
    for field_name in MODEL_OUTPUT_POLICY_FIELDS:
        resolved.pop(field_name, None)
    return resolved


def _legacy_resolved_policy(policy_config, domain_context: dict[str, str] | None) -> dict[str, Any]:
    """旧算法：整个 `vars(policy_config)`；`domain_context` 不是 None 时换成猜的那一种旧结果。"""
    resolved = dict(vars(policy_config))
    if domain_context is not None:
        resolved["domain_context"] = domain_context
    return resolved


def _translation_parameters(
    request: TranslationExecutionRequest,
    plan: TranslationExecutionPlan,
    *,
    resolved_policy: dict[str, Any],
    fixed_translations: dict[str, str] | None = None,
) -> dict[str, Any]:
    parameters = {
        "start_page": plan.start,
        "end_page": plan.stop,
        "mode": request.mode,
        "math_mode": request.math_mode,
        "batch_size": max(1, request.batch_size),
        "classify_batch_size": max(1, request.classify_batch_size),
        "skip_title_translation": bool(request.skip_title_translation),
        "model": request.model,
        "base_url": request.base_url,
        "rule_profile_name": plan.policy_config.rule_profile_name,
        "custom_rules_text": plan.policy_config.custom_rules_text,
        "resolved_policy_sha256": _sha256_json(resolved_policy),
        "context_mode": request.context_mode,
        "glossary_mode": request.glossary_mode,
        "memory_mode": request.memory_mode,
        "translation_engine": _engine_identity(request),
        "glossary": [
            {
                "source": entry.source,
                "target": entry.target,
                "level": entry.level,
                "match_mode": entry.match_mode,
                "context": entry.context,
                "note": entry.note,
            }
            for entry in plan.glossary_entries
        ],
    }
    preparation = getattr(plan, "preparation", None)
    if preparation is not None:
        # 只有开了译前准备才加这个键：off 时参数集合与改动前逐字节相同，
        # 旧 checkpoint 照常续跑。冻结产物的哈希进指纹，产物换了就不能拿旧译文续跑。
        parameters["preparation"] = preparation.identity()
    if fixed_translations:
        # 旧算法（legacy_translation_identities）才有这个键：只有有定译（目录 agent，workflow/fixed_translations.py）时才加
        parameters["fixed_translations_sha256"] = _sha256_json(fixed_translations)
    return parameters


class _IdentityDigests:
    """原文的两个哈希，一次续跑只读一遍文件（旧算法要按几种候选各算一遍指纹）。"""

    def __init__(self, request: TranslationExecutionRequest) -> None:
        self.request = request
        self._document_sha256: str | None = None
        self._source_pdf_sha256: str | None = None

    @property
    def streamed(self) -> bool:
        return getattr(self.request, "ocr_stream_dir", None) is not None and self.request.source_pdf_path is not None

    def identity(self, parameters: dict[str, Any]) -> dict[str, Any]:
        if self.streamed:
            # 跟着 OCR 翻：归一化文档每来一批页都在变，按原文 PDF 认（OCR 断点续跑时同一份原文出同样的页，见 glm_ocr_driver）。
            if self._source_pdf_sha256 is None:
                self._source_pdf_sha256 = _sha256_file(Path(self.request.source_pdf_path))
            payload = {
                "ocr_stream_source_pdf_sha256": self._source_pdf_sha256,
                "parameters_sha256": _sha256_json(parameters),
            }
            return {**payload, "fingerprint": _sha256_json(payload)}
        if self._document_sha256 is None:
            self._document_sha256 = _sha256_file(self.request.source_json_path)
        payload = {
            "normalized_document_sha256": self._document_sha256,
            "parameters_sha256": _sha256_json(parameters),
        }
        return {**payload, "fingerprint": _sha256_json(payload)}


def build_translation_identity(
    request: TranslationExecutionRequest,
    plan: TranslationExecutionPlan,
) -> dict[str, Any]:
    """这次续跑的指纹：只由输入决定，不含领域识别结果和定译（见上面 MODEL_OUTPUT_POLICY_FIELDS 的说明）。"""
    parameters = _translation_parameters(
        request,
        plan,
        resolved_policy=_resolved_policy(plan.policy_config),
    )
    return _IdentityDigests(request).identity(parameters)


def _empty_domain_context(preview_text: str) -> dict[str, str]:
    return {"domain": "", "summary": "", "translation_guidance": "", "preview_text": preview_text}


def _legacy_domain_context_candidates(plan: TranslationExecutionPlan) -> list[dict[str, str] | None]:
    """旧断点记指纹时领域识别可能是什么结果：这一次的结果，或者识别失败、超时时写下的空结果。

    空结果的 `preview_text` 有几种来源：识别抛异常（Windows 上的 SIGALRM、网络错误）时是 OCR 前两页的文字
    （services/policy/config.py 的 build_book_translation_policy_config）；总时限超时时是交给模型的那段预览，
    和成功时记下的 `preview_text` 一样（llm/domain_context.py）；没有预览时是空串。不识别的模式是 `{}`。
    第一个 None 表示照这一次的原样算（领域识别结果没变，只是升级前后算法不同）。"""
    current = dict(getattr(plan.policy_config, "domain_context", None) or {})
    candidates: list[dict[str, str] | None] = [None, {}, _empty_domain_context(str(current.get("preview_text", "") or ""))]
    ocr_preview_text = str(getattr(plan, "ocr_preview_text", "") or "")
    if ocr_preview_text:
        candidates.append(_empty_domain_context(ocr_preview_text))
    candidates.append(_empty_domain_context(""))
    unique: list[dict[str, str] | None] = []
    for candidate in candidates:
        if candidate not in unique:
            unique.append(candidate)
    return unique


def legacy_translation_identities(
    request: TranslationExecutionRequest,
    plan: TranslationExecutionPlan,
) -> list[dict[str, Any]]:
    """按旧算法（2026-11-26 以前，领域识别结果和定译都进指纹）算出的几种可能的指纹，给已有断点对账用。

    旧算法要的是旧断点记下时的领域识别结果和定译，这些现在不知道，只能把会出现的几种都算一遍：领域识别取
    `_legacy_domain_context_candidates`，定译取这一次的结果或者没有（目录 agent 失败、没开）。对上任何一个，
    就说明只是模型产出变了，断点照常续跑，并改记新指纹（`TranslationCheckpointSession._initialize`）。"""
    digests = _IdentityDigests(request)
    fixed_candidates: list[dict[str, str] | None] = [None]
    fixed = getattr(plan, "fixed_translations", None)
    if fixed:
        fixed_candidates.insert(0, fixed)
    identities: list[dict[str, Any]] = []
    for domain_context in _legacy_domain_context_candidates(plan):
        resolved = _legacy_resolved_policy(plan.policy_config, domain_context)
        for fixed_translations in fixed_candidates:
            parameters = _translation_parameters(
                request,
                plan,
                resolved_policy=resolved,
                fixed_translations=fixed_translations,
            )
            identity = digests.identity(parameters)
            if identity not in identities:
                identities.append(identity)
    return identities


def _engine_identity(request) -> dict:
    """换引擎不能沿用另一个引擎的 checkpoint。legacy 的身份保持原样（不加键），正在跑的旧任务续跑不受影响。"""
    identity = translation_engine_identity(mode=request.mode)
    engine = getattr(request, "engine", "legacy") or "legacy"
    if engine != "legacy":
        from retainpdf_translation.workflow.engines import engine_spec
        from retainpdf_translation.workflow.engines import load

        spec = engine_spec(engine)
        extra = load(spec.checkpoint_identity)() if spec.checkpoint_identity else {}
        identity = {**identity, "engine": engine, **extra}
    return identity
