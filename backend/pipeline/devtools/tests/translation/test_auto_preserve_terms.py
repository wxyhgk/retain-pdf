from __future__ import annotations

import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.services.terms import auto_preserve_glossary_entries_from_texts
from retainpdf_pipeline.translate.workflow.execution import TranslationExecutionRequest
from retainpdf_pipeline.translate.workflow.execution_plan import build_translation_execution_plan


def test_auto_preserve_terms_keeps_hyphenated_scientific_names() -> None:
    entries = auto_preserve_glossary_entries_from_texts(
        [
            "Hartree-Fock and Kohn-Sham density functional theory are compared with DFTB3.",
            "The SCF procedure uses GFN2-xTB parameters.",
        ]
    )
    by_source = {entry.source: entry for entry in entries}

    assert by_source["Hartree-Fock"].target == "Hartree-Fock"
    assert by_source["Hartree-Fock"].level == "preserve"
    assert by_source["Hartree-Fock"].match_mode == "case_insensitive"
    assert by_source["Kohn-Sham"].level == "preserve"
    assert by_source["GFN2-xTB"].level == "preserve"
    assert by_source["SCF"].level == "preserve"
    assert "The" not in by_source


def test_execution_plan_uses_only_explicit_glossary_entries(tmp_path: Path) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text(
        json.dumps(
            {
                "schema": "normalized_document_v1",
                "schema_version": "1.1",
                "document_id": "auto-preserve-test",
                "source": {"provider": "test", "provider_version": "test", "raw_files": {}},
                "page_count": 1,
                "pages": [
                    {
                        "page_index": 0,
                        "width": 200.0,
                        "height": 120.0,
                        "unit": "pt",
                        "blocks": [
                            {
                                "block_id": "p001-b0000",
                                "page_index": 0,
                                "order": 0,
                                "type": "text",
                                "sub_type": "",
                                "geometry": {"bbox": [0, 0, 150, 20]},
                                "content": {
                                    "kind": "text",
                                    "text": "Hartree-Fock theory and SCF iterations are used.",
                                },
                                "bbox": [0, 0, 150, 20],
                                "text": "Hartree-Fock theory and SCF iterations are used.",
                                "lines": [],
                                "segments": [],
                                "layout_role": "paragraph",
                                "semantic_role": "body",
                                "structure_role": "body",
                                "policy": {"translate": True, "translate_reason": "test"},
                                "provenance": {
                                    "provider": "test",
                                    "raw_label": "text",
                                    "raw_sub_type": "",
                                    "raw_bbox": [0, 0, 150, 20],
                                    "raw_path": "$.pages[0].blocks[0]",
                                },
                                "continuation_hint": {
                                    "source": "",
                                    "group_id": "",
                                    "role": "",
                                    "scope": "",
                                    "reading_order": -1,
                                    "confidence": 0.0,
                                },
                                "metadata": {},
                                "source": {"provider": "test", "raw_type": "text"},
                            }
                        ],
                    }
                ],
                "derived": {},
                "markers": {},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    plan = build_translation_execution_plan(
        TranslationExecutionRequest(
            source_json_path=source_json,
            output_dir=tmp_path / "translated",
            api_key="sk-test",
            glossary_entries=[
                {
                    "source": "SCF",
                    "target": "自洽场",
                    "level": "preferred",
                    "match_mode": "exact",
                }
            ],
        )
    )
    sources = {entry.source: entry for entry in plan.glossary_entries}

    assert sources["SCF"].target == "自洽场"
    assert sources["SCF"].level == "preferred"
    assert "Hartree-Fock" not in sources
    assert plan.translation_context.glossary_entries == plan.glossary_entries


def test_execution_plan_uses_high_configured_workers_for_deepseek(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("RETAIN_TRANSLATION_DEEPSEEK_INITIAL_CONCURRENCY_LIMIT", raising=False)
    source_json = tmp_path / "document.v1.json"
    source_json.write_text(
        json.dumps(
            {
                "schema": "normalized_document_v1",
                "schema_version": "1.1",
                "document_id": "ramp-up-test",
                "source": {"provider": "test", "provider_version": "test", "raw_files": {}},
                "page_count": 1,
                "pages": [
                    {
                        "page_index": 0,
                        "width": 200.0,
                        "height": 120.0,
                        "unit": "pt",
                        "blocks": [],
                    }
                ],
                "derived": {},
                "markers": {},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    plan = build_translation_execution_plan(
        TranslationExecutionRequest(
            source_json_path=source_json,
            output_dir=tmp_path / "translated",
            api_key="sk-test",
            workers=1000,
        )
    )
    summary = plan.run_diagnostics.build_summary()

    assert summary["configured_workers"] == 1000
    assert summary["adaptive_concurrency"]["configured_limit"] == 1000
    assert summary["adaptive_concurrency"]["initial_limit"] == 1000
    # deepseek 默认开启前缀缓存预热:首条请求完成前 current_limit 压为 1
    assert summary["adaptive_concurrency"]["current_limit"] == 1
    assert summary["adaptive_concurrency"]["floor_limit"] == 8


def test_execution_plan_can_cap_deepseek_initial_concurrency(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_DEEPSEEK_INITIAL_CONCURRENCY_LIMIT", "250")
    source_json = tmp_path / "document.v1.json"
    source_json.write_text(
        json.dumps(
            {
                "schema": "normalized_document_v1",
                "schema_version": "1.1",
                "document_id": "ramp-up-cap-test",
                "source": {"provider": "test", "provider_version": "test", "raw_files": {}},
                "page_count": 1,
                "pages": [
                    {
                        "page_index": 0,
                        "width": 200.0,
                        "height": 120.0,
                        "unit": "pt",
                        "blocks": [],
                    }
                ],
                "derived": {},
                "markers": {},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    plan = build_translation_execution_plan(
        TranslationExecutionRequest(
            source_json_path=source_json,
            output_dir=tmp_path / "translated",
            api_key="sk-test",
            workers=1000,
        )
    )
    summary = plan.run_diagnostics.build_summary()

    assert summary["adaptive_concurrency"]["configured_limit"] == 1000
    assert summary["adaptive_concurrency"]["initial_limit"] == 250
    # 前缀缓存预热生效期间 current_limit 为 1,首条请求完成后恢复到 250
    assert summary["adaptive_concurrency"]["current_limit"] == 1


def test_prefix_cache_warmup_restores_full_concurrency_after_first_release() -> None:
    from retainpdf_pipeline.translate.artifacts.aggregator import TranslationRunDiagnostics

    diagnostics = TranslationRunDiagnostics(
        provider_family="deepseek_official",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        configured_workers=100,
        configured_batch_size=1,
        configured_classify_batch_size=1,
    )
    diagnostics.configure_adaptive_concurrency(initial_limit=100, warmup=True)
    assert diagnostics.build_summary()["adaptive_concurrency"]["current_limit"] == 1

    diagnostics.acquire_request_slot()
    diagnostics.release_request_slot(success=True, elapsed_ms=1200, status_code=200)
    assert diagnostics.build_summary()["adaptive_concurrency"]["current_limit"] == 100


def test_prefix_cache_warmup_releases_gate_even_when_first_request_fails() -> None:
    from retainpdf_pipeline.translate.artifacts.aggregator import TranslationRunDiagnostics

    diagnostics = TranslationRunDiagnostics(
        provider_family="deepseek_official",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        configured_workers=100,
        configured_batch_size=1,
        configured_classify_batch_size=1,
    )
    diagnostics.configure_adaptive_concurrency(initial_limit=100, warmup=True)
    diagnostics.acquire_request_slot()
    # 首条请求失败:预热放弃,但不能把整个运行钉死在串行
    diagnostics.release_request_slot(success=False, elapsed_ms=20000, status_code=None, error_class="ReadTimeout")
    assert diagnostics.build_summary()["adaptive_concurrency"]["current_limit"] > 1


def test_aimd_backs_off_on_sustained_connect_timeout_storm() -> None:
    from retainpdf_pipeline.translate.artifacts.aggregator import TranslationRunDiagnostics

    diagnostics = TranslationRunDiagnostics(
        provider_family="deepseek_official",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        configured_workers=100,
        configured_batch_size=1,
        configured_classify_batch_size=1,
    )
    diagnostics.configure_adaptive_concurrency(initial_limit=100)
    # 孤立超时容忍:前 4 次不降速
    for _ in range(4):
        diagnostics.acquire_request_slot()
        diagnostics.release_request_slot(success=False, elapsed_ms=20000, status_code=None, error_class="ConnectTimeout")
    assert diagnostics.build_summary()["adaptive_concurrency"]["current_limit"] == 100
    # 第 5 次:风暴确认,温和降速一档
    diagnostics.acquire_request_slot()
    diagnostics.release_request_slot(success=False, elapsed_ms=20000, status_code=None, error_class="ConnectTimeout")
    assert diagnostics.build_summary()["adaptive_concurrency"]["current_limit"] == 85
    # 成功清零计数,不再继续降
    diagnostics.acquire_request_slot()
    diagnostics.release_request_slot(success=True, elapsed_ms=5000, status_code=200)
    for _ in range(4):
        diagnostics.acquire_request_slot()
        diagnostics.release_request_slot(success=False, elapsed_ms=20000, status_code=None, error_class="ConnectTimeout")
    assert diagnostics.build_summary()["adaptive_concurrency"]["current_limit"] == 85
