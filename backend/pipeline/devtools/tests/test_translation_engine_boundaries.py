"""翻译包拆包第 1 步（2026-11-20）：底座、agent 接线不 import 普通翻译；引擎登记表里的路径都加载得到。"""

from __future__ import annotations

import pytest

from devtools.architecture_checks import translation_engines as gate
from devtools.architecture_checks.translation_engines import check_translation_engine_boundaries
from devtools.architecture_checks.translation_engines import translation_module_kind
from retainpdf_translation.workflow import engines


@pytest.mark.parametrize(
    "module,kind",
    [
        ("workflow.book_flow", "classic"),
        ("workflow.batching.plan", "classic"),
        ("llm.shared.orchestration.single_item_flow", "classic"),
        ("services.memory.store", "classic"),
        ("services.memory.updater", "base"),
        ("services.agents.review_artifact", "base"),
        ("services.agents.coordinator", "classic"),
        ("workflow.scheduling.allocation", "base"),
        ("workflow.scheduling.tail_retry", "classic"),
        ("workflow.prepare", "base"),
        ("workflow.engines", "base"),
        ("workflow.execution_runner", "base"),
        ("llm.shared.provider_registry", "base"),
        ("workflow.agent_flow", "agent"),
    ],
)
def test_modules_are_sorted_into_base_classic_and_agent_glue(module: str, kind: str) -> None:
    assert translation_module_kind(module) == kind


def test_the_translation_package_respects_the_engine_boundary() -> None:
    errors: list[str] = []
    check_translation_engine_boundaries(errors)
    assert errors == []


def test_a_base_module_importing_the_classic_engine_is_reported(tmp_path, monkeypatch) -> None:
    root = tmp_path / "retainpdf_translation"
    (root / "workflow").mkdir(parents=True)
    (root / "workflow" / "execution_runner.py").write_text(
        "def run():\n    from retainpdf_translation_classic.workflow.book_flow import translate_book_with_global_continuations\n",
        encoding="utf-8",
    )
    (root / "workflow" / "agent_flow.py").write_text("from retainpdf_translation.llm.shared import prompt_building\n", encoding="utf-8")
    monkeypatch.setattr(gate, "TRANSLATION_ROOT", root)
    monkeypatch.setattr(gate, "TRANSLATION_CLASSIC_PACKAGE_ROOT", tmp_path / "retainpdf_translation_classic")
    monkeypatch.setattr(gate, "rel", lambda path: path)
    errors: list[str] = []
    check_translation_engine_boundaries(errors)
    assert len(errors) == 2, errors
    assert "workflow.book_flow" in errors[0] or "workflow.book_flow" in errors[1], "函数里的延迟 import 也算"
    assert any("llm.shared.prompt_building" in error for error in errors), "from 包 import 子模块 也算"


def test_modules_must_live_in_the_right_package(tmp_path, monkeypatch) -> None:
    base, classic = tmp_path / "retainpdf_translation", tmp_path / "retainpdf_translation_classic"
    (base / "workflow").mkdir(parents=True)
    (classic / "workflow").mkdir(parents=True)
    (base / "workflow" / "book_flow.py").write_text("", encoding="utf-8")  # 普通翻译留在了底座
    (classic / "workflow" / "execution_runner.py").write_text("", encoding="utf-8")  # 底座的模块跑进了普通翻译包
    (base / "workflow" / "execution.py").write_text("from retainpdf_translation_classic.public import translate_table\n", encoding="utf-8")
    monkeypatch.setattr(gate, "TRANSLATION_ROOT", base)
    monkeypatch.setattr(gate, "TRANSLATION_CLASSIC_PACKAGE_ROOT", classic)
    monkeypatch.setattr(gate, "rel", lambda path: path)
    errors: list[str] = []
    check_translation_engine_boundaries(errors)
    assert len(errors) == 3, errors
    assert any("book_flow" in error and "belongs in retainpdf_translation_classic" in error for error in errors)
    assert any("execution_runner" in error and "is not a classic engine module" in error for error in errors)
    assert any("retainpdf_translation_classic.public" in error for error in errors), "底座连普通翻译的门面也不许 import"


@pytest.mark.parametrize("name", sorted(engines.ENGINES))
def test_every_engine_reference_loads(name: str) -> None:
    spec = engines.engine_spec(name)
    for ref in (spec.translate_book, spec.translate_book_streaming, spec.run_preparation, spec.effective_batch_size):
        if ref:
            assert callable(engines.load(ref)), ref
    with pytest.raises(ValueError, match="unknown translation engine"):
        engines.engine_spec("nope")
