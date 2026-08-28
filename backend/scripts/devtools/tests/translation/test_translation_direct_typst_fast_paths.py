import importlib.util
import json
import sys
import tempfile
import types
import unittest
from dataclasses import replace
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


def _ensure_package_stubs():
    package_paths = {
        "services": REPO_SCRIPTS_ROOT / "services",
        "services.translation": REPO_SCRIPTS_ROOT / "services" / "translation",
        "services.translation.llm": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm",
        "services.translation.llm.shared": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared",
        "services.translation.llm.shared.orchestration": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration",
        "services.translation.llm.providers": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "providers",
        "services.translation.llm.providers.deepseek": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "providers" / "deepseek",
        "services.translation.core.orchestration": REPO_SCRIPTS_ROOT / "services" / "translation" / "orchestration",
        "services.translation.services.continuation": REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation",
    }
    for name, path in package_paths.items():
        module = sys.modules.get(name)
        if module is None:
            module = types.ModuleType(name)
            module.__path__ = [str(path)]
            sys.modules[name] = module


def _load_module(name: str, path: Path):
    _ensure_package_stubs()
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _load_continuation_package():
    return _load_module(
        "services.translation.services.continuation",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "__init__.py",
    )


def _install_minimal_continuation_stub():
    rules_module = _load_module(
        "services.translation.services.continuation.rules",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "rules.py",
    )
    pairs_module = _load_module(
        "services.translation.services.continuation.pairs",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "pairs.py",
    )
    module = types.ModuleType("services.translation.services.continuation")
    module.apply_candidate_pair_joins = pairs_module.apply_candidate_pair_joins
    module.candidate_continuation_pairs = pairs_module.candidate_continuation_pairs
    module.pair_break_score = rules_module.pair_break_score
    module.pair_join_score = rules_module.pair_join_score
    module.review_candidate_pairs = lambda *args, **kwargs: {}
    sys.modules["services.translation.services.continuation"] = module
    return module


def _translate_direct_typst_for_test(module, item: dict, *, context, request_label: str = "test"):
    direct_typst = _load_module(
        "services.translation.llm.shared.orchestration.direct_typst",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration" / "direct_typst.py",
    )
    return direct_typst.translate_direct_typst_plain_text_with_retries(
        item,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label=request_label,
        context=context,
        diagnostics=None,
        translator=module.translate_single_item_plain_text_with_retries,
        translate_plain_fn=module.translate_single_item_plain_text,
        translate_unstructured_fn=module.translate_single_item_plain_text_unstructured,
        sentence_level_fallback_fn=module._sentence_level_fallback,
        validate_batch_result_fn=module.validate_batch_result,
    )




class TranslationDirectTypstFastPathTests(unittest.TestCase):
    def test_direct_typst_protocol_shell_degrades_for_cjk_body_text(self):
        module = _load_module(
            "services.translation.llm.shared.orchestration.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration" / "fallbacks.py",
        )
        context_module = _load_module(
            "services.translation.llm.shared.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "control_context.py",
        )
        context = context_module.build_translation_control_context(mode="sci")
        item = {
            "item_id": "p036-b015",
            "page_idx": 35,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "math_mode": "direct_typst",
            "translation_unit_protected_source_text": (
                "综上，本文系统综述了DFT计算在光催化领域中的广泛应用，并为未来开发高效稳定催化剂提供参考。"
            ),
            "protected_source_text": (
                "综上，本文系统综述了DFT计算在光催化领域中的广泛应用，并为未来开发高效稳定催化剂提供参考。"
            ),
        }

        protocol_exc = module.TranslationProtocolError(
            "p036-b015",
            translated_text='{"translations":[{"item_id":"p036-b015","translated_text":"综上，本文系统综述了DFT计算在光催化领域中的广泛应用。"}]}',
        )
        with mock.patch.object(
            module,
            "translate_single_item_plain_text",
            side_effect=protocol_exc,
        ), mock.patch.object(
            module,
            "translate_single_item_plain_text_unstructured",
            side_effect=protocol_exc,
        ):
            result = _translate_direct_typst_for_test(module, item, context=context)

        payload = result["p036-b015"]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["final_status"], "translated")
        self.assertEqual(
            payload["translation_diagnostics"]["degradation_reason"],
            "protocol_shell_salvaged",
        )

    def test_direct_typst_short_empty_translation_uses_short_retry(self):
        module = _load_module(
            "services.translation.llm.shared.orchestration.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration" / "fallbacks.py",
        )
        context_module = _load_module(
            "services.translation.llm.shared.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "control_context.py",
        )
        short_retry_module = _load_module(
            "services.translation.llm.shared.orchestration.short_text_retry",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration" / "short_text_retry.py",
        )
        context = context_module.build_translation_control_context(mode="sci")
        item = {
            "item_id": "p020-b012",
            "page_idx": 19,
            "block_type": "text",
            "block_kind": "text",
            "raw_block_type": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "metadata": {"structure_role": "body"},
            "math_mode": "direct_typst",
            "translation_unit_protected_source_text": "We need only to diagonalize the matrix $ F' $",
            "protected_source_text": "We need only to diagonalize the matrix $ F' $",
        }

        with mock.patch.object(
            module,
            "translate_single_item_plain_text",
            side_effect=module.EmptyTranslationError("p020-b012"),
        ), mock.patch.object(
            module,
            "translate_single_item_plain_text_unstructured",
            side_effect=module.EmptyTranslationError("p020-b012"),
        ), mock.patch.object(
            short_retry_module.provider_runtime,
            "request_chat_content",
            return_value="我们只需要对角化矩阵 $ F' $",
        ):
            result = _translate_direct_typst_for_test(module, item, context=context)

        payload = result["p020-b012"]
        self.assertEqual(payload["translated_text"], "我们只需要对角化矩阵 $ F' $")
        self.assertEqual(payload["final_status"], "translated")
        self.assertEqual(
            payload["translation_diagnostics"]["degradation_reason"],
            "empty_translation_short_text_retry",
        )

    def test_direct_typst_long_text_is_split_before_remote_translation(self):
        module = _load_module(
            "services.translation.llm.shared.orchestration.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration" / "fallbacks.py",
        )
        context_module = _load_module(
            "services.translation.llm.shared.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "control_context.py",
        )
        context = context_module.build_translation_control_context(mode="sci")
        long_source = " ".join(f"This is sentence {i} describing a long legal disclaimer." for i in range(1, 180))
        item = {
            "item_id": "__cg__:cg-long-001",
            "translation_unit_id": "__cg__:cg-long-001",
            "page_idx": 17,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "math_mode": "direct_typst",
            "continuation_group": "cg-long-001",
            "translation_unit_protected_source_text": long_source,
            "protected_source_text": long_source,
        }

        def _fake_plain_text(chunk_item, **_kwargs):
            text = str(chunk_item.get("translation_unit_protected_source_text", "") or "")
            return {
                chunk_item["item_id"]: {
                    "decision": "translate",
                    "translated_text": f"已翻译:{text[:24]}",
                    "final_status": "translated",
                }
            }

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=_fake_plain_text) as plain_mock:
            result = _translate_direct_typst_for_test(module, item, context=context)

        payload = result[item["item_id"]]
        self.assertEqual(payload["decision"], "translate")
        self.assertGreater(plain_mock.call_count, 1)
        self.assertEqual(payload["translation_diagnostics"]["route_path"], ["block_level", "direct_typst", "long_text_split"])

    def test_formula_english_residue_marks_failed_after_all_fallbacks_fail(self):
        module = _load_module(
            "services.translation.llm.shared.orchestration.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.shared.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "control_context.py",
        )
        item = {
            "item_id": "p009-b067",
            "page_idx": 8,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "Olefins offer the unique benefit of starting from prochiral <f1-8fa/> carbons.",
            "translation_unit_protected_source_text": "Olefins offer the unique benefit of starting from prochiral <f1-8fa/> carbons.",
            "formula_map": [{"placeholder": "<f1-8fa/>"}],
            "translation_unit_formula_map": [{"placeholder": "<f1-8fa/>"}],
        }
        context = control_context.build_translation_control_context(mode="sci")
        context = replace(
            context,
            fallback_policy=replace(
                context.fallback_policy,
                plain_text_attempts=1,
                allow_tagged_placeholder_retry=False,
            ),
        )

        english_residue = module.EnglishResidueError("p009-b067")
        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=english_residue):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=english_residue):
                with mock.patch.object(module, "_sentence_level_fallback", side_effect=english_residue):
                    result = module.translate_single_item_plain_text_with_retries(
                        item,
                        api_key="",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test",
                        context=context,
                        diagnostics=None,
                    )
        payload = result["p009-b067"]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["translated_text"], "")
        self.assertEqual(payload["final_status"], "failed")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "english_residue_repeated")

    def test_english_residue_after_raw_fallback_continues_to_sentence_level(self):
        module = _load_module(
            "services.translation.llm.shared.orchestration.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.shared.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "control_context.py",
        )
        placeholder_guard = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        item = {
            "item_id": "p001-b002",
            "page_idx": 0,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "This is the first sentence. This is the second sentence.",
            "translation_unit_protected_source_text": "This is the first sentence. This is the second sentence.",
        }
        context = control_context.build_translation_control_context(mode="sci")
        context = replace(
            context,
            fallback_policy=replace(
                context.fallback_policy,
                plain_text_attempts=1,
                allow_tagged_placeholder_retry=False,
            ),
        )
        english_residue = module.EnglishResidueError("p001-b002")
        sentence_payload = {
            "p001-b002": {
                "decision": "translate",
                "translated_text": "这是第一句。 第二句保留原文。",
                "final_status": "partially_translated",
            }
        }

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=english_residue):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=english_residue):
                with mock.patch.object(module, "_sentence_level_fallback", return_value=sentence_payload) as sentence_mock:
                    result = module.translate_single_item_plain_text_with_retries(
                        item,
                        api_key="",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test",
                        context=context,
                        diagnostics=None,
                    )
        self.assertEqual(result, sentence_payload)
        sentence_mock.assert_called_once()

    def test_direct_typst_english_residue_does_not_enter_sentence_level_fallback(self):
        module = _load_module(
            "services.translation.llm.shared.orchestration.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.shared.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "control_context.py",
        )
        item = {
            "item_id": "p001-b002",
            "page_idx": 0,
            "block_type": "text",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "This is the first sentence. This is the second sentence.",
            "translation_unit_protected_source_text": "This is the first sentence. This is the second sentence.",
        }
        context = control_context.build_translation_control_context(mode="sci")
        context = replace(
            context,
            fallback_policy=replace(
                context.fallback_policy,
                plain_text_attempts=1,
                allow_tagged_placeholder_retry=False,
            ),
        )
        english_residue = module.EnglishResidueError("p001-b002")

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=english_residue):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=english_residue):
                with mock.patch.object(module, "_sentence_level_fallback", side_effect=AssertionError("should not be called")):
                    result = module.translate_single_item_plain_text_with_retries(
                        item,
                        api_key="",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test",
                        context=context,
                        diagnostics=None,
                    )

        payload = result["p001-b002"]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["translated_text"], "")
        self.assertEqual(payload["final_status"], "failed")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "english_residue_repeated")
        self.assertEqual(payload["translation_diagnostics"]["route_path"], ["block_level", "direct_typst", "failed"])

    def test_direct_typst_body_protocol_failure_falls_back_to_sentence_level(self):
        module = _load_module(
            "services.translation.llm.shared.orchestration.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.shared.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "control_context.py",
        )
        item = {
            "item_id": "p021-b005",
            "page_idx": 20,
            "block_type": "text",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "protected_source_text": (
                "Conventional Context Parallelism partitions the sequence dimension, with each rank "
                "maintaining contiguous s tokens. This introduces two challenges to our compressed "
                "attention mechanisms."
            ),
            "translation_unit_protected_source_text": (
                "Conventional Context Parallelism partitions the sequence dimension, with each rank "
                "maintaining contiguous s tokens. This introduces two challenges to our compressed "
                "attention mechanisms."
            ),
        }
        context = control_context.build_translation_control_context(mode="sci")
        context = replace(
            context,
            fallback_policy=replace(
                context.fallback_policy,
                plain_text_attempts=1,
                allow_tagged_placeholder_retry=False,
            ),
        )
        protocol_error = module.TranslationProtocolError(
            item["item_id"],
            source_text=item["translation_unit_protected_source_text"],
            translated_text='{"translated_text": ""}',
        )
        sentence_payload = {
            item["item_id"]: {
                "decision": "translate",
                "translated_text": "传统上下文并行将序列维度进行划分。",
                "final_status": "partially_translated",
                "translation_diagnostics": {
                    "route_path": ["block_level", "sentence_level"],
                    "fallback_to": "sentence_level",
                },
            }
        }

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=protocol_error):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=protocol_error):
                with mock.patch.object(module, "_sentence_level_fallback", return_value=sentence_payload) as sentence_mock:
                    result = module.translate_single_item_plain_text_with_retries(
                        item,
                        api_key="",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test",
                        context=context,
                        diagnostics=None,
                    )

        sentence_mock.assert_called_once()
        payload = result[item["item_id"]]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["final_status"], "partially_translated")
        self.assertIn("传统上下文并行", payload["translated_text"])

    def test_direct_typst_validation_failure_does_not_enter_tagged_placeholder_retry(self):
        module = _load_module(
            "services.translation.llm.shared.orchestration.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "orchestration" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.shared.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "shared" / "control_context.py",
        )
        item = {
            "item_id": "p001-b002",
            "page_idx": 0,
            "block_type": "text",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "This is body text with inline math x.",
            "translation_unit_protected_source_text": "This is body text with inline math x.",
        }
        context = control_context.build_translation_control_context(mode="sci")
        context = replace(
            context,
            fallback_policy=replace(
                context.fallback_policy,
                plain_text_attempts=1,
                allow_tagged_placeholder_retry=True,
            ),
        )
        english_residue = module.EnglishResidueError("p001-b002")

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=english_residue):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=english_residue):
                with mock.patch.object(module, "translate_single_item_stable_placeholder_text", side_effect=AssertionError("should not be called")):
                    result = module.translate_single_item_plain_text_with_retries(
                        item,
                        api_key="",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test",
                        context=context,
                        diagnostics=None,
                    )

        self.assertEqual(result["p001-b002"]["decision"], "keep_origin")



def test_long_text_split_partially_accepts_when_one_chunk_fails() -> None:
    from services.translation.llm.shared.control_context import build_translation_control_context
    from services.translation.llm.shared.orchestration.direct_typst_long_text import (
        translate_direct_typst_long_text_chunks,
    )

    sentence = "This is a long body sentence describing the experimental protocol in detail. "
    source = sentence * 70  # ~5500 字符,切成多块
    item = {
        "item_id": "p001-b001",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "math_mode": "direct_typst",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }
    calls = {"n": 0}

    def _translator(chunk_item, **_kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("transient failure")
        return {chunk_item["item_id"]: {"decision": "translate", "translated_text": f"译文块{calls['n']}"}}

    result = translate_direct_typst_long_text_chunks(
        item,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="",
        context=build_translation_control_context(),
        diagnostics=None,
        translator=_translator,
    )
    assert result is not None
    payload = result["p001-b001"]
    diag = payload["translation_diagnostics"]
    # Lỗi của một khối duy nhất không còn làm mất hiệu lực toàn bộ bài viết:Khối lỗi bảo tồn văn bản gốc,Đặt trước bản dịch cho các khối còn lại
    assert diag["final_status"] == "partially_translated"
    assert diag["degradation_reason"] == "direct_typst_long_text_split_partial"
    assert diag["degraded_chunk_count"] == 1
    assert "译文块1" in payload["translated_text"]
    assert sentence.strip() in payload["translated_text"]


def test_long_text_split_still_fails_when_all_chunks_fail() -> None:
    from services.translation.llm.shared.control_context import build_translation_control_context
    from services.translation.llm.shared.orchestration.direct_typst_long_text import (
        translate_direct_typst_long_text_chunks,
    )

    sentence = "Another long body sentence describing the computational details thoroughly. "
    source = sentence * 70
    item = {
        "item_id": "p001-b002",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "math_mode": "direct_typst",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }

    def _translator(chunk_item, **_kwargs):
        raise RuntimeError("hard failure")

    result = translate_direct_typst_long_text_chunks(
        item,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="",
        context=build_translation_control_context(),
        diagnostics=None,
        translator=_translator,
    )
    payload = result["p001-b002"]
    assert payload["translation_diagnostics"]["degradation_reason"] == "direct_typst_long_text_split_chunk_failed"
