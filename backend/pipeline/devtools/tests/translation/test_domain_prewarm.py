"""OCR 期间先做识别领域：辅助进程填好共享缓存，翻译阶段到时直接命中，不再发这个请求。"""

from __future__ import annotations

import json
from pathlib import Path

import fitz
import pytest

from retainpdf_pipeline.translate.entrypoints import domain_prewarm
from retainpdf_translation.llm import domain_context

ANSWER = json.dumps({"domain": "计算化学", "summary": "教材章节", "translation_guidance": "术语前后一致"}, ensure_ascii=False)


@pytest.fixture()
def pdf(tmp_path: Path) -> Path:
    path = tmp_path / "book.pdf"
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), "Geometry optimization finds stationary points on the potential energy surface.")
    doc.save(path)
    doc.close()
    return path


@pytest.fixture()
def calls(monkeypatch, tmp_path: Path) -> list[dict]:
    import retainpdf_base.paths as paths

    monkeypatch.setattr(paths, "DOMAIN_CONTEXT_CACHE_DIR", tmp_path / "_domain_context_cache")
    monkeypatch.setenv("RETAIN_TRANSLATION_API_KEY", "sk-test")
    seen: list[dict] = []

    def fake_request(messages, **kwargs):
        seen.append(kwargs)
        return ANSWER

    monkeypatch.setattr(domain_context, "request_chat_content", fake_request)
    return seen


def _spec(pdf: Path, **params) -> dict:
    base = {"mode": "sci", "model": "claude-haiku-5-5", "base_url": "https://api.anthropic.com/v1", "api_protocol": "anthropic", "thinking": "off", "credential_ref": "env:RETAIN_TRANSLATION_API_KEY"}
    return {"schema_version": domain_prewarm.SCHEMA_VERSION, "stage": "domain_prewarm", "inputs": {"source_pdf": str(pdf)}, "params": {**base, **params}}


def test_prewarm_fills_the_shared_cache_and_the_translation_stage_hits_it(pdf: Path, calls: list[dict], tmp_path: Path) -> None:
    assert domain_prewarm.run(_spec(pdf)) == "done: domain=计算化学"
    assert len(calls) == 1
    # 翻译阶段：同一个 PDF、同一个模型，不再发请求
    translated = tmp_path / "translated"
    translated.mkdir()
    context = domain_context.infer_domain_context(
        source_pdf_path=pdf, api_key="sk-test", model="claude-haiku-5-5", base_url="https://api.anthropic.com/v1", output_dir=translated
    )
    assert context["domain"] == "计算化学" and len(calls) == 1


@pytest.mark.parametrize(
    "change, reason",
    [({"mode": "fast"}, "domain inference off"), ({"credential_ref": "env:NOT_SET_ANYWHERE"}, "no api key")],
)
def test_prewarm_does_nothing_when_the_translation_would_not_ask(pdf: Path, calls: list[dict], change: dict, reason: str, monkeypatch) -> None:
    monkeypatch.delenv("NOT_SET_ANYWHERE", raising=False)
    assert reason in domain_prewarm.run(_spec(pdf, **change))
    assert calls == []


def test_a_missing_pdf_or_a_failure_never_breaks_anything(tmp_path: Path, calls: list[dict], monkeypatch, capsys) -> None:
    assert "source pdf not found" in domain_prewarm.run(_spec(tmp_path / "missing.pdf"))
    spec_path = tmp_path / "domain-prewarm.spec.json"
    spec_path.write_text("{not json", encoding="utf-8")
    assert domain_prewarm.main(["--spec", str(spec_path)]) == 0
    assert "failed" in capsys.readouterr().out
