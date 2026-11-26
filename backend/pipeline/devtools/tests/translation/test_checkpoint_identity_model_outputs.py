"""续跑指纹不含模型产出（领域识别结果、目录 agent 的定译），旧断点照常续跑（2026-11-26 审查一级第 2 条）。

以前 `identity.py` 把 `vars(policy_config)`（含领域识别结果 `domain_context`）和定译的哈希放进指纹：第一次识别失败
（Windows 上 SIGALRM 不存在，#224 以前每次都失败）、重试时成功，指纹就变——跨任务续跑丢掉全部已译页从头翻，
同一任务内续跑永远报 fingerprint mismatch。#224 修好 Windows 的领域识别以后，Windows 上的旧任务重试时必然这样。

现在指纹只由输入决定；已有断点按旧算法再对一遍（猜几种旧的领域识别结果、有没有定译），对上了照常续跑、改记新指纹。
"""
from __future__ import annotations

import json
import shutil
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from retainpdf_base.events import PipelineEventWriter
from retainpdf_base.events import pipeline_event_writer_scope
from retainpdf_translation.core.payload import load_translations
from retainpdf_translation.core.payload import save_translations
from retainpdf_translation.services.policy.config import extract_ocr_preview_text
from retainpdf_translation.workflow.checkpoint import TRANSLATION_CHECKPOINT_FILE_NAME
from retainpdf_translation.workflow.checkpoint import ResumeCandidateFingerprintMismatch
from retainpdf_translation.workflow.checkpoint import TranslationCheckpointSession
from retainpdf_translation.workflow.checkpoint import discard_copied_resume_candidate
from retainpdf_translation.workflow.checkpoint import identity as identity_module
from retainpdf_translation.workflow.checkpoint import session as session_module
from retainpdf_translation.workflow.checkpoint.identity import build_translation_identity
from retainpdf_translation.workflow.execution import TranslationExecutionRequest
from retainpdf_translation.workflow.execution_plan import build_translation_execution_plan

FILLED = {
    "domain": "physics",
    "summary": "A textbook on quantum mechanics.",
    "translation_guidance": "Keep standard physics terminology.",
    "preview_text": "[Page 1]\nPDF text layer",
}


def _old_identity(request, plan) -> dict[str, Any]:
    """2026-11-26 以前的算法，原样抄下来当金样：`vars(policy_config)` 整个进指纹，有定译时再加定译的哈希。"""
    resolved_policy = dict(vars(plan.policy_config))
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
        "resolved_policy_sha256": identity_module._sha256_json(resolved_policy),
        "context_mode": request.context_mode,
        "glossary_mode": request.glossary_mode,
        "memory_mode": request.memory_mode,
        "translation_engine": identity_module._engine_identity(request),
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
    if getattr(plan, "preparation", None) is not None:
        parameters["preparation"] = plan.preparation.identity()
    if getattr(plan, "fixed_translations", None):
        parameters["fixed_translations_sha256"] = identity_module._sha256_json(plan.fixed_translations)
    return identity_module.build_document_identity(
        normalized_document_path=request.source_json_path,
        parameters_sha256=identity_module._sha256_json(parameters),
    )


def _block(index: int, text: str) -> dict:
    bbox = [10, 10 + index * 30, 190, 30 + index * 30]
    return {
        "block_id": f"p001-b{index:04d}", "page_index": 0, "order": index, "type": "text", "sub_type": "",
        "geometry": {"bbox": bbox}, "content": {"kind": "text", "text": text}, "bbox": bbox, "text": text,
        "lines": [], "segments": [], "layout_role": "paragraph", "semantic_role": "body", "structure_role": "body",
        "policy": {"translate": True, "translate_reason": "test"},
        "provenance": {"provider": "test", "raw_label": "text", "raw_sub_type": "", "raw_bbox": bbox, "raw_path": f"$.b{index}"},
        "continuation_hint": {"source": "", "group_id": "", "role": "", "scope": "", "reading_order": -1, "confidence": 0.0},
        "metadata": {}, "source": {"provider": "test", "raw_type": "text"},
    }


@pytest.fixture
def document(tmp_path: Path) -> Path:
    path = tmp_path / "document.v1.json"
    path.write_text(json.dumps({
        "schema": "normalized_document_v1", "schema_version": "1.1", "document_id": "identity-test",
        "source": {"provider": "test", "provider_version": "test", "raw_files": {}}, "page_count": 1,
        "pages": [{"page_index": 0, "width": 200.0, "height": 200.0, "unit": "pt", "blocks": [
            _block(0, "Quantum mechanics describes nature at small scales."),
            _block(1, "The wave function evolves under the Schrodinger equation."),
        ]}],
        "derived": {}, "markers": {},
    }), encoding="utf-8")
    return path


def _request(document: Path, job_dir: Path, **kwargs) -> TranslationExecutionRequest:
    kwargs.setdefault("model", "test-model")
    return TranslationExecutionRequest(source_json_path=document, output_dir=job_dir / "translated", api_key="sk-test", **kwargs)


def _with(plan, *, domain_context: dict | None = None, fixed: dict | None = None):
    policy = replace(plan.policy_config, domain_context=domain_context if domain_context is not None else {})
    return replace(plan, policy_config=policy, fixed_translations=fixed)


def _failed_inference(plan) -> dict[str, str]:
    """领域识别抛异常时写下的结果（services/policy/config.py）：预览是 OCR 前两页的文字。"""
    return {"domain": "", "summary": "", "translation_guidance": "", "preview_text": extract_ocr_preview_text(plan.data)}


def _timed_out_inference() -> dict[str, str]:
    """领域识别超时时写下的结果（llm/domain_context.py）：预览是交给模型的那一段，和成功时记下的一样。"""
    return {"domain": "", "summary": "", "translation_guidance": "", "preview_text": FILLED["preview_text"]}


def _old_checkpoint(monkeypatch, request, plan) -> Path:
    """旧版本留下的断点：按旧算法记指纹，一页里一块译完、一块没译。"""
    page = request.output_dir / "page-001-test.json"
    payload = [_page_item("p001-b0000", "量子力学描述小尺度上的自然。"), _page_item("p001-b0001")]
    with monkeypatch.context() as patch:
        patch.setattr(session_module, "build_translation_identity", _old_identity)
        with TranslationCheckpointSession.acquire(request, plan) as checkpoint:
            save_translations(page, payload)
            checkpoint.update("translating", {0: payload}, {0: page})
    return page


def _page_item(item_id: str, translated_text: str = "") -> dict:
    return {
        "item_id": item_id, "block_kind": "text", "layout_role": "paragraph", "semantic_role": "body",
        "structure_role": "body", "policy_translate": True, "asset_id": "", "reading_order": 0,
        "raw_block_type": "paragraph", "normalized_sub_type": "body", "source_text": f"source {item_id}",
        "protected_source_text": f"source {item_id}", "translated_text": translated_text, "should_translate": True,
        "continuation_group": "", "formula_map": [], "protected_map": [],
    }


def _copy_to_new_job(old_request, new_request, page: Path) -> Path:
    new_request.output_dir.mkdir(parents=True)
    shutil.copy2(page, new_request.output_dir / page.name)
    shutil.copy2(
        old_request.output_dir / TRANSLATION_CHECKPOINT_FILE_NAME,
        new_request.output_dir / TRANSLATION_CHECKPOINT_FILE_NAME,
    )
    return new_request.output_dir / page.name


def _stored(request) -> dict:
    return json.loads((request.output_dir / TRANSLATION_CHECKPOINT_FILE_NAME).read_text(encoding="utf-8"))


def test_model_outputs_do_not_change_the_fingerprint(document: Path, tmp_path: Path) -> None:
    request = _request(document, tmp_path / "job")
    plan = build_translation_execution_plan(request)
    base = build_translation_identity(request, _with(plan))
    assert build_translation_identity(request, _with(plan, domain_context=FILLED)) == base
    assert build_translation_identity(request, _with(plan, domain_context=_failed_inference(plan))) == base
    assert build_translation_identity(request, _with(plan, fixed={"p001-b0000": "量子力学"})) == base


def test_inputs_still_change_the_fingerprint(document: Path, tmp_path: Path) -> None:
    request = _request(document, tmp_path / "job")
    plan = build_translation_execution_plan(request)
    base = build_translation_identity(request, plan)["fingerprint"]
    assert build_translation_identity(_request(document, tmp_path / "job", model="other"), plan)["fingerprint"] != base
    assert build_translation_identity(_request(document, tmp_path / "job", mode="sci"), plan)["fingerprint"] != base
    changed_rules = replace(plan, policy_config=replace(plan.policy_config, custom_rules_text="Use British spelling."))
    assert build_translation_identity(request, changed_rules)["fingerprint"] != base


@pytest.mark.parametrize("old_domain", ["failed", "timed_out"])
def test_old_checkpoint_from_a_failed_domain_inference_resumes_in_a_new_job(
    document: Path, tmp_path: Path, monkeypatch, old_domain: str
) -> None:
    """Windows 上的旧任务：领域识别每次都失败（结果是空的），重试时识别成功了。以前整本丢弃重翻。"""
    old_request = _request(document, tmp_path / "job-old")
    plan = build_translation_execution_plan(old_request)
    empty = _failed_inference(plan) if old_domain == "failed" else _timed_out_inference()
    page = _old_checkpoint(monkeypatch, old_request, _with(plan, domain_context=empty))

    new_request = _request(document, tmp_path / "job-new")
    new_page = _copy_to_new_job(old_request, new_request, page)
    filled_plan = _with(plan, domain_context=FILLED)
    with TranslationCheckpointSession.acquire(new_request, filled_plan) as checkpoint:
        assert checkpoint.payload["resumed_from_attempt_id"] == "job-old"

    assert load_translations(new_page)[0]["translated_text"] == "量子力学描述小尺度上的自然。"
    stored = _stored(new_request)
    assert stored["fingerprint"] == build_translation_identity(new_request, filled_plan)["fingerprint"]
    assert stored["pages"][0]["pending_item_ids"] == ["p001-b0001"]


def test_old_checkpoint_resumes_within_the_same_job_after_the_domain_inference_starts_working(
    document: Path, tmp_path: Path, monkeypatch
) -> None:
    """同一任务内续跑：以前每次都报 fingerprint mismatch within the same attempt，永远失败。"""
    request = _request(document, tmp_path / "job-a")
    plan = build_translation_execution_plan(request)
    _old_checkpoint(monkeypatch, request, _with(plan, domain_context=_failed_inference(plan)))

    for _ in range(3):
        with TranslationCheckpointSession.acquire(request, _with(plan, domain_context=FILLED)):
            pass
    assert _stored(request)["fingerprint"] == build_translation_identity(request, plan)["fingerprint"]


def test_old_checkpoint_resumes_when_the_toc_agent_succeeds_on_retry(
    document: Path, tmp_path: Path, monkeypatch
) -> None:
    """目录 agent 第一次失败（没有定译），重试时成功：以前定译的哈希进指纹，同样整本丢弃。"""
    old_request = _request(document, tmp_path / "job-old")
    plan = build_translation_execution_plan(old_request)
    page = _old_checkpoint(monkeypatch, old_request, _with(plan, fixed=None))

    new_request = _request(document, tmp_path / "job-new")
    _copy_to_new_job(old_request, new_request, page)
    with TranslationCheckpointSession.acquire(new_request, _with(plan, fixed={"p001-b0000": "量子力学"})):
        pass
    assert _stored(new_request)["pages"][0]["pending_item_ids"] == ["p001-b0001"]


def test_old_checkpoint_with_unchanged_model_outputs_is_upgraded(document: Path, tmp_path: Path, monkeypatch) -> None:
    """领域识别结果和定译都没变（大多数旧断点）：旧算法对得上，改记新指纹；以后领域识别结果再变也不影响。"""
    request = _request(document, tmp_path / "job-a")
    plan = _with(build_translation_execution_plan(request), domain_context=FILLED, fixed={"p001-b0000": "量子力学"})
    _old_checkpoint(monkeypatch, request, plan)
    assert _stored(request)["fingerprint"] == _old_identity(request, plan)["fingerprint"]

    with TranslationCheckpointSession.acquire(request, plan):
        pass
    assert _stored(request)["fingerprint"] == build_translation_identity(request, plan)["fingerprint"]

    monkeypatch.setattr(identity_module, "legacy_translation_identities", lambda *_args: [])
    with TranslationCheckpointSession.acquire(request, _with(plan, domain_context={"domain": "chemistry"})):
        pass


@pytest.mark.parametrize(
    ("change", "reason"),
    [("model", "parameters_changed"), ("document", "document_changed")],
)
def test_a_real_input_change_is_still_rejected_with_a_reason(
    document: Path, tmp_path: Path, monkeypatch, change: str, reason: str
) -> None:
    old_request = _request(document, tmp_path / "job-old")
    plan = build_translation_execution_plan(old_request)
    page = _old_checkpoint(monkeypatch, old_request, plan)

    new_request = _request(document, tmp_path / "job-new", **({"model": "other-model"} if change == "model" else {}))
    if change == "document":
        changed = tmp_path / "changed" / "document.v1.json"
        changed.parent.mkdir()
        changed.write_text(document.read_text(encoding="utf-8").replace("small scales", "large scales"), encoding="utf-8")
        new_request = replace(new_request, source_json_path=changed)
    new_page = _copy_to_new_job(old_request, new_request, page)

    with pytest.raises(ResumeCandidateFingerprintMismatch) as raised:
        TranslationCheckpointSession.acquire(new_request, plan)
    assert raised.value.reason == reason
    assert raised.value.source_attempt_id == "job-old"
    discard_copied_resume_candidate(new_request.output_dir, source_attempt_id="job-old")
    assert not new_page.exists()

    # 同一任务内：照旧报错，错误里带上原因
    same_job = replace(old_request, model=new_request.model, source_json_path=new_request.source_json_path)
    with pytest.raises(RuntimeError, match=f"within the same attempt \\({reason}\\)"):
        TranslationCheckpointSession.acquire(same_job, plan)


def test_discarding_a_copied_checkpoint_emits_a_warning_event(tmp_path: Path, capsys) -> None:
    from retainpdf_translation.workflow.execution_runner import _warn_resume_checkpoint_discarded

    writer = PipelineEventWriter(job_id="job-new", job_root=tmp_path, logs_dir=tmp_path / "logs")
    with pipeline_event_writer_scope(writer):
        _warn_resume_checkpoint_discarded(ResumeCandidateFingerprintMismatch("job-old", "parameters_changed"))

    record = json.loads(writer.path.read_text(encoding="utf-8").splitlines()[-1])
    assert record["level"] == "warning"
    assert record["event_type"] == "stage_progress"
    assert record["payload"]["resume_checkpoint_discarded"] == {"source_attempt_id": "job-old", "reason": "parameters_changed"}
    assert "翻译参数变了" in record["message"]
    stdout = [json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")]
    assert stdout[-1]["schema"] == "pipeline_stage_observation_v1"
    assert stdout[-1]["payload"]["resume_checkpoint_discarded"]["reason"] == "parameters_changed"
