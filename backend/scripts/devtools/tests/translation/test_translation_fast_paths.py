import importlib.util
import json
import requests
import sys
import tempfile
import types
import unittest
from dataclasses import replace
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


def _ensure_package_stubs():
    package_paths = {
        "services": REPO_SCRIPTS_ROOT / "services",
        "services.translation": REPO_SCRIPTS_ROOT / "services" / "translation",
        "services.translation.llm": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm",
        "services.translation.orchestration": REPO_SCRIPTS_ROOT / "services" / "translation" / "orchestration",
        "services.translation.continuation": REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation",
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
        "services.translation.continuation",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "__init__.py",
    )


def _install_minimal_continuation_stub():
    rules_module = _load_module(
        "services.translation.continuation.rules",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "rules.py",
    )
    pairs_module = _load_module(
        "services.translation.continuation.pairs",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "pairs.py",
    )
    module = types.ModuleType("services.translation.continuation")
    module.apply_candidate_pair_joins = pairs_module.apply_candidate_pair_joins
    module.candidate_continuation_pairs = pairs_module.candidate_continuation_pairs
    module.pair_break_score = rules_module.pair_break_score
    module.pair_join_score = rules_module.pair_join_score
    module.review_candidate_pairs = lambda *args, **kwargs: {}
    sys.modules["services.translation.continuation"] = module
    return module


class TranslationFastPathTests(unittest.TestCase):
    def test_editorial_metadata_token_is_not_force_skipped_anymore(self):
        module = _load_module(
            "services.translation.policy.metadata_filter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "metadata_filter.py",
        )
        self.assertFalse(
            module.looks_like_nontranslatable_metadata(
                {
                    "block_type": "text",
                    "source_text": "CrossMark",
                    "should_translate": True,
                    "metadata": {"structure_role": "body"},
                    "page_idx": 0,
                    "lines": [{"spans": [{"content": "CrossMark"}]}],
                }
            )
        )

    def test_short_first_page_header_fragment_is_not_force_skipped_by_metadata_filter(self):
        module = _load_module(
            "services.translation.policy.metadata_filter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "metadata_filter.py",
        )
        self.assertFalse(
            module.looks_like_nontranslatable_metadata(
                {
                    "block_type": "text",
                    "source_text": "Energy property",
                    "should_translate": True,
                    "metadata": {"structure_role": "body"},
                    "page_idx": 0,
                    "bbox": [48, 421, 105, 431],
                    "lines": [{"spans": [{"content": "Energy property"}]}],
                }
            )
        )

    def test_biography_prose_is_not_treated_as_nontranslatable_metadata(self):
        module = _load_module(
            "services.translation.policy.metadata_filter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "metadata_filter.py",
        )
        self.assertFalse(
            module.looks_like_nontranslatable_metadata(
                {
                    "block_type": "text",
                    "source_text": (
                        "Samantha A. Green received her B.S. from Emory University in 2013, conducting research under "
                        "Professor Huw Davies, after which she completed a postbaccalaureate fellowship at the NIH under "
                        "Dr. Marta Catalfamo. Currently she is a graduate student in the Shenvi research group at The "
                        "Scripps Research Institute investigating new MHAT methods."
                    ),
                    "should_translate": True,
                    "metadata": {"structure_role": "body"},
                    "page_idx": 10,
                    "lines": [{"spans": [{"content": "bio"}]}],
                }
            )
        )

    def test_biography_prose_is_not_treated_as_safe_nontranslatable_metadata(self):
        module = _load_module(
            "services.translation.policy.metadata_filter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "metadata_filter.py",
        )
        self.assertFalse(
            module.looks_like_safe_nontranslatable_metadata(
                {
                    "block_type": "text",
                    "source_text": (
                        "Samantha A. Green received her B.S. from Emory University in 2013, conducting research under "
                        "Professor Huw Davies, after which she completed a postbaccalaureate fellowship at the NIH under "
                        "Dr. Marta Catalfamo. Currently she is a graduate student in the Shenvi research group at The "
                        "Scripps Research Institute investigating new MHAT methods."
                    ),
                    "should_translate": True,
                    "metadata": {"structure_role": "body"},
                    "page_idx": 10,
                    "lines": [{"spans": [{"content": "bio"}]}],
                }
            )
        )

    def test_author_list_is_not_force_skipped_by_metadata_filter(self):
        module = _load_module(
            "services.translation.policy.metadata_filter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "metadata_filter.py",
        )
        self.assertFalse(
            module.looks_like_safe_nontranslatable_metadata(
                {
                    "block_type": "text",
                    "source_text": "John A. Smith, Jane B. Doe, Alan C. Brown†, Maria D. White*",
                    "should_translate": True,
                    "metadata": {"structure_role": "metadata"},
                    "page_idx": 0,
                    "lines": [{"spans": [{"content": "authors"}]}],
                }
            )
        )

    def test_pure_email_fragment_is_treated_as_safe_nontranslatable_metadata(self):
        module = _load_module(
            "services.translation.policy.metadata_filter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "metadata_filter.py",
        )
        self.assertTrue(
            module.looks_like_safe_nontranslatable_metadata(
                {
                    "block_type": "text",
                    "source_text": "author@example.edu",
                    "should_translate": True,
                    "metadata": {"structure_role": "body"},
                    "page_idx": 0,
                    "lines": [{"spans": [{"content": "author@example.edu"}]}],
                }
            )
        )

    def test_section_symbol_body_text_is_not_treated_as_author_metadata(self):
        module = _load_module(
            "services.translation.policy.metadata_filter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "metadata_filter.py",
        )
        self.assertFalse(
            module.looks_like_safe_nontranslatable_metadata(
                {
                    "block_type": "text",
                    "source_text": (
                        "To overcome these challenges, we propose a simple adaptation approach that bridges these "
                        "discrepancies. We unify their modeling objectives (§3.2) and address the architectural "
                        "differences by breaking the causal masking bias in AR models through attention mask annealing (§3.3)."
                    ),
                    "should_translate": True,
                    "metadata": {"structure_role": "body", "normalized_sub_type": "body", "ocr_sub_type": "body"},
                    "page_idx": 1,
                    "lines": [{"spans": [{"content": "body"}]}],
                }
            )
        )

    def test_short_non_body_empty_translation_degrades_to_keep_origin(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        payload = module._keep_origin_payload_for_empty_translation(
            {
                "item_id": "p012-b022",
                "page_idx": 11,
                "block_type": "image_caption",
                "layout_zone": "non_flow",
                "metadata": {"structure_role": "caption"},
            }
        )
        self.assertEqual(payload["p012-b022"]["decision"], "keep_origin")
        self.assertEqual(payload["p012-b022"]["final_status"], "kept_origin")
        self.assertEqual(
            payload["p012-b022"]["translation_diagnostics"]["degradation_reason"],
            "empty_translation_non_body_label",
        )

    def test_empty_translation_body_biography_does_not_keep_origin(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        self.assertFalse(
            module._should_keep_origin_on_empty_translation(
                {
                    "item_id": "p011-b017",
                    "page_idx": 10,
                    "block_type": "text",
                    "metadata": {"structure_role": "body"},
                    "translation_unit_protected_source_text": (
                        "Samantha A. Green received her B.S. from Emory University in 2013, conducting research under "
                        "Professor Huw Davies, after which she completed a postbaccalaureate fellowship at the NIH under "
                        "Dr. Marta Catalfamo. Currently she is a graduate student in the Shenvi research group at The "
                        "Scripps Research Institute investigating new MHAT methods."
                    ),
                }
            )
        )

    def test_citation_rich_body_text_still_forces_translation(self):
        module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        source_text = (
            "For infilling tasks, we attempt to query the LLaMA model with the prompt given the "
            "<prefix> and <suffix>, please answer the <middle> part, which includes both prefix and "
            "suffix information. However, this approach is no better than simply completing the prefix, "
            "likely because the LLaMA model needs tuning for filling in the middle (FIM; Bavarian et al. "
            "2022b). Additionally, Bavarian et al. (2022b) notes that using AR models for infilling "
            "presents challenges, such as prompting difficulties and repetition. In contrast, DLMs are "
            "naturally suited for this task, as they are trained to handle masked inputs, which is a key advantage."
        )
        item = {
            "item_id": "p024-b008",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "translation_unit_protected_source_text": source_text,
            "protected_source_text": source_text,
        }

        self.assertTrue(module.should_force_translate_body_text(item))
        self.assertTrue(module.looks_like_untranslated_english_output(item, source_text))

    def test_repeated_empty_translation_degrades_to_keep_origin(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        payload = module._keep_origin_payload_for_repeated_empty_translation(
            {
                "item_id": "p001-b017",
                "page_idx": 0,
                "block_type": "text",
            }
        )
        self.assertEqual(payload["p001-b017"]["decision"], "keep_origin")
        self.assertEqual(payload["p001-b017"]["final_status"], "kept_origin")
        self.assertEqual(
            payload["p001-b017"]["translation_diagnostics"]["degradation_reason"],
            "empty_translation_repeated",
        )

    def test_single_item_extractor_returns_plain_text_when_not_json(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        self.assertEqual(
            module.extract_single_item_translation_text("这是直接返回的中文译文。", "p001-b019"),
            "这是直接返回的中文译文。",
        )

    def test_english_residue_detector_only_blocks_copy_dominant_english_output(self):
        module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        item = {
            "item_id": "p002-b001",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "translation_unit_protected_source_text": (
                "The advancement of complex computer programs with faster computing power and material simulation methods "
                "has become an important tool for material researchers, because it explains many properties."
            ),
        }
        translated = (
            "The advancement of complex computer programs with faster computing power and material simulation methods "
            "remains important."
        )
        self.assertFalse(module.looks_like_untranslated_english_output(item, translated))
        self.assertTrue(module.looks_like_predominantly_english_output(item, translated))

    def test_english_residue_detector_only_warns_for_mixed_output_with_english_span(self):
        module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        item = {
            "item_id": "p009-b067",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "translation_unit_protected_source_text": (
                "Olefins offer the unique benefit of starting from prochiral carbons rather than preformed "
                "tetrasubstituted carbons like tertiary alkyl bromides, which can be laborious to synthesize or unstable."
            ),
        }
        translated = (
            "这是一个重要优势。 Olefins offer the unique benefit of starting from prochiral carbons rather than "
            "preformed tetrasubstituted carbons like tertiary alkyl bromides, which can be laborious to synthesize or unstable. "
            "后续底物也可以顺利偶联。"
        )
        self.assertFalse(
            module.looks_like_untranslated_english_output(
                item,
                translated,
            )
        )
        self.assertTrue(module.looks_like_predominantly_english_output(item, translated))

    def test_english_residue_detector_ignores_author_name_list(self):
        module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        item = {
            "item_id": "p001-b002",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "translation_unit_protected_source_text": (
                "Samantha A. Green, Steven W. M. Crossley, Jeishla L. M. Matos, "
                "Suhelen Vásquez-Céspedes, Sophia L. Shevick, and Ryan A. Shenvi*"
            ),
        }
        self.assertFalse(
            module.looks_like_untranslated_english_output(
                item,
                "Samantha A. Green, Steven W. M. Crossley, Jeishla L. M. Matos, "
                "Suhelen Vásquez-Céspedes, Sophia L. Shevick, and Ryan A. Shenvi*",
            )
        )

    def test_structured_output_repairs_trailing_commas_and_unquoted_keys(self):
        module = _load_module(
            "services.translation.llm.structured_output",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "structured_output.py",
        )
        payload = module.parse_structured_json(
            """
            ```json
            {domain: "chemistry", summary: "ok", translation_guidance: "keep terms",}
            ```
            """
        )
        self.assertEqual(payload["domain"], "chemistry")
        self.assertEqual(payload["summary"], "ok")

    def test_domain_context_parser_accepts_line_key_value_fallback(self):
        module = _load_module(
            "services.translation.llm.structured_parsers",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "structured_parsers.py",
        )
        result = module.parse_domain_context_response(
            "DOMAIN: materials science\nSUMMARY: photocatalysis paper\nTRANSLATION_GUIDANCE: preserve formulas",
            preview_text="preview",
        )
        self.assertEqual(result["domain"], "materials science")
        self.assertEqual(result["summary"], "photocatalysis paper")
        self.assertEqual(result["translation_guidance"], "preserve formulas")

    def test_single_item_extractor_unwraps_nested_batch_json_shell(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        nested = {
            "translated_text": json.dumps(
                {
                    "translations": [
                        {
                            "item_id": "p030-b010",
                            "translated_text": "计算效率、成本与精度。",
                        }
                    ]
                },
                ensure_ascii=False,
            )
        }
        self.assertEqual(
            module.extract_single_item_translation_text(json.dumps(nested, ensure_ascii=False), "p030-b010"),
            "计算效率、成本与精度。",
        )

    def test_placeholder_guard_canonicalizes_nested_json_shell(self):
        module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        result = module.canonicalize_batch_result(
            [{"item_id": "p030-b010", "translation_unit_protected_source_text": "Computational efficiency."}],
            {
                "p030-b010": {
                    "decision": "translate",
                    "translated_text": json.dumps(
                        {
                            "translations": [
                                {
                                    "item_id": "p030-b010",
                                    "translated_text": "计算效率、成本与精度。",
                                }
                            ]
                        },
                        ensure_ascii=False,
                    ),
                }
            },
        )
        self.assertEqual(result["p030-b010"]["translated_text"], "计算效率、成本与精度。")

    def test_placeholder_guard_rejects_protocol_shell_output(self):
        module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        with self.assertRaises(module.TranslationProtocolError):
            module.validate_batch_result(
                [{"item_id": "p030-b010", "translation_unit_protected_source_text": "Computational efficiency."}],
                {
                    "p030-b010": {
                        "decision": "translate",
                        "translated_text": '{ "translations": [{"item_id":"p030-b010","translated_text":"计算效率"}] }',
                    }
                },
            )

    def test_translate_single_item_plain_text_uses_plain_text_protocol(self):
        module = _load_module(
            "services.translation.llm.translation_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "translation_client.py",
        )
        item = {
            "item_id": "p001-b001",
            "protected_source_text": "The advancement of complex computer programs.",
            "translation_unit_protected_source_text": "The advancement of complex computer programs.",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
        }
        captured: dict[str, object] = {}

        def _fake_messages(*args, **kwargs):
            captured["response_style"] = kwargs.get("response_style")
            return [{"role": "system", "content": "stub"}]

        def _fake_request(messages, **kwargs):
            captured["messages"] = messages
            captured["response_format"] = kwargs.get("response_format")
            return "复杂计算机程序的发展。"

        with mock.patch.object(module, "build_single_item_fallback_messages", side_effect=_fake_messages), mock.patch.object(
            module, "request_chat_content", side_effect=_fake_request
        ):
            result = module.translate_single_item_plain_text(item)

        self.assertEqual(captured["response_style"], "plain_text")
        self.assertIsNone(captured["response_format"])
        self.assertEqual(result["p001-b001"]["translated_text"], "复杂计算机程序的发展。")

    def test_translate_batch_once_uses_tagged_protocol_without_schema(self):
        module = _load_module(
            "services.translation.llm.translation_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "translation_client.py",
        )
        batch = [
            {
                "item_id": "p001-b001",
                "protected_source_text": "The advancement of complex computer programs.",
                "translation_unit_protected_source_text": "The advancement of complex computer programs.",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
            },
            {
                "item_id": "p001-b002",
                "protected_source_text": "Faster computing power improves simulation.",
                "translation_unit_protected_source_text": "Faster computing power improves simulation.",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
            },
        ]
        captured: dict[str, object] = {}

        def _fake_messages(*args, **kwargs):
            captured["response_style"] = kwargs.get("response_style")
            return [{"role": "system", "content": "stub"}]

        def _fake_request(messages, **kwargs):
            captured["messages"] = messages
            captured["response_format"] = kwargs.get("response_format")
            return (
                "<<<ITEM item_id=p001-b001>>>\n复杂计算机程序的发展。\n<<<END>>>\n"
                "<<<ITEM item_id=p001-b002>>>\n更快的算力提升了模拟能力。\n<<<END>>>"
            )

        with mock.patch.object(module, "build_messages", side_effect=_fake_messages), mock.patch.object(
            module, "request_chat_content", side_effect=_fake_request
        ):
            result = module.translate_batch_once(batch, mode="fast")

        self.assertEqual(captured["response_style"], "tagged")
        self.assertIsNone(captured["response_format"])
        self.assertEqual(result["p001-b001"]["translated_text"], "复杂计算机程序的发展。")
        self.assertEqual(result["p001-b002"]["translated_text"], "更快的算力提升了模拟能力。")

    def test_build_messages_sci_tagged_requires_decision_attribute(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        messages = module.build_messages(
            [
                {
                    "item_id": "p001-b001",
                    "protected_source_text": "Experimentally test the mechanism.",
                    "metadata": {"structure_role": "body"},
                }
            ],
            mode="sci",
            response_style="tagged",
        )
        self.assertIn("<<<ITEM item_id=ITEM_ID decision=translate>>>", messages[0]["content"])

    def test_build_messages_sanitizes_continuation_context_placeholders(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        messages = module.build_messages(
            [
                {
                    "item_id": "p006-b056",
                    "protected_source_text": "The combination of these results",
                    "continuation_group": "cg-001",
                    "continuation_next_text": "evidence against a <f1-2e5/> catalytic cycle and <f2-9ad/> reaction pathway",
                    "metadata": {"structure_role": "body"},
                }
            ],
            mode="sci",
            response_style="tagged",
        )
        payload = json.loads(messages[1]["content"])
        item_payload = payload["items"][0]
        self.assertEqual(item_payload["context_after"], "evidence against a catalytic cycle and reaction pathway")
        self.assertNotIn("<f1-2e5/>", messages[1]["content"])
        self.assertNotIn("<f2-9ad/>", messages[1]["content"])

    def test_build_single_item_fallback_messages_sanitizes_continuation_context_placeholders(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        messages = module.build_single_item_fallback_messages(
            {
                "item_id": "p006-b056",
                "protected_source_text": "The combination of these results",
                "continuation_next_text": "evidence against a <f1-2e5/> catalytic cycle and <f2-9ad/> reaction pathway",
                "metadata": {"structure_role": "body"},
            },
            mode="sci",
            response_style="plain_text",
        )
        payload = json.loads(messages[1]["content"])
        self.assertEqual(
            payload["item"]["context_after"],
            "evidence against a catalytic cycle and reaction pathway",
        )
        self.assertNotIn("<f1-2e5/>", messages[1]["content"])
        self.assertNotIn("<f2-9ad/>", messages[1]["content"])

    def test_build_messages_direct_typst_includes_inline_math_and_local_ocr_repair_guidance(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        messages = module.build_messages(
            [
                {
                    "item_id": "p001-b001",
                    "protected_source_text": r"^{a} reaction at {10\mu}mol scale",
                    "math_mode": "direct_typst",
                    "metadata": {"structure_role": "body"},
                }
            ],
            mode="sci",
            response_style="tagged",
        )
        system_prompt = messages[0]["content"]
        self.assertIn("You must mark inline mathematical expressions with `$...$` yourself", system_prompt)
        self.assertIn("minimal local repair", system_prompt)
        self.assertIn("Do not invent new scientific content", system_prompt)
        self.assertIn("Source: ^{a} measured in duplicate.", system_prompt)
        self.assertIn("Output: $^{a}$ 重复测定。", system_prompt)
        self.assertIn(r"\mu", messages[1]["content"])
        self.assertNotIn(r"\\mu", messages[1]["content"])

    def test_build_single_item_fallback_messages_direct_typst_includes_inline_math_and_local_ocr_repair_guidance(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        messages = module.build_single_item_fallback_messages(
            {
                "item_id": "p001-b001",
                "protected_source_text": r"^{a} reaction at {10\mu}mol scale",
                "math_mode": "direct_typst",
                "metadata": {"structure_role": "body"},
            },
            mode="sci",
            response_style="plain_text",
        )
        system_prompt = messages[0]["content"]
        self.assertIn("You must mark inline mathematical expressions with `$...$` yourself", system_prompt)
        self.assertIn("minimal local repair", system_prompt)
        self.assertIn("Do not invent new scientific content", system_prompt)
        self.assertIn("Source: observed {2}^{\\prime }{2}^{\\prime }-substituted product.", system_prompt)
        self.assertIn("Output: 观察到 $2',2'$-取代产物。", system_prompt)
        self.assertIn(r"\mu", messages[1]["content"])
        self.assertNotIn(r"\\mu", messages[1]["content"])

    def test_build_messages_direct_typst_keeps_single_backslash_source_text_in_user_prompt(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        messages = module.build_messages(
            [
                {
                    "item_id": "p010-b002",
                    "protected_source_text": r"strengthens the argument that a \mathrm{Ni(I) / Ni(III)} cycle is operative.",
                    "math_mode": "direct_typst",
                    "metadata": {"structure_role": "body"},
                }
            ],
            mode="sci",
            response_style="tagged",
        )
        self.assertIn(r"\mathrm{Ni(I) / Ni(III)}", messages[1]["content"])
        self.assertNotIn(r"\\mathrm{Ni(I) / Ni(III)}", messages[1]["content"])

    def test_build_single_item_fallback_messages_direct_typst_keeps_single_backslash_source_text_in_user_prompt(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        messages = module.build_single_item_fallback_messages(
            {
                "item_id": "p010-b002",
                "protected_source_text": r"strengthens the argument that a \mathrm{Ni(I) / Ni(III)} cycle is operative.",
                "math_mode": "direct_typst",
                "metadata": {"structure_role": "body"},
            },
            mode="sci",
            response_style="plain_text",
        )
        self.assertIn(r"\mathrm{Ni(I) / Ni(III)}", messages[1]["content"])
        self.assertNotIn(r"\\mathrm{Ni(I) / Ni(III)}", messages[1]["content"])

    def test_formula_english_residue_degrades_to_keep_origin_after_all_fallbacks_fail(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
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
        self.assertEqual(payload["decision"], "keep_origin")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "english_residue_repeated")

    def test_english_residue_after_raw_fallback_continues_to_sentence_level(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
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

    def test_english_residue_degrades_to_keep_origin_after_sentence_fallback_failure(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
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
        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=english_residue):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=english_residue):
                with mock.patch.object(module, "_sentence_level_fallback", side_effect=module.PlaceholderInventoryError("p001-b002", [], [])):
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
        self.assertEqual(payload["decision"], "keep_origin")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "english_residue_repeated")
        self.assertEqual(payload["translation_diagnostics"]["final_status"], "kept_origin")

    def test_direct_typst_skips_heavy_formula_split_entry(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
        )
        item = {
            "item_id": "p001-b002",
            "page_idx": 0,
            "block_type": "text",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "protected_source_text": r"Observe $\mathrm{Ph(i-PrO)SiH_2}$ and more text.",
            "translation_unit_protected_source_text": r"Observe $\mathrm{Ph(i-PrO)SiH_2}$ and more text.",
        }
        context = control_context.build_translation_control_context(mode="sci")
        plain_payload = {"p001-b002": {"decision": "translate", "translated_text": r"观察到 $\mathrm{Ph(i-PrO)SiH_2}$ 以及更多文本。"}}

        with mock.patch.object(module, "_heavy_formula_split_reason", side_effect=AssertionError("should not be called")):
            with mock.patch.object(module, "translate_single_item_plain_text", return_value=plain_payload):
                result = module.translate_single_item_plain_text_with_retries(
                    item,
                    api_key="",
                    model="deepseek-chat",
                    base_url="https://api.deepseek.com/v1",
                    request_label="test",
                    context=context,
                    diagnostics=None,
                )

        self.assertEqual(result["p001-b002"]["translated_text"], plain_payload["p001-b002"]["translated_text"])

    def test_direct_typst_english_residue_does_not_enter_sentence_level_fallback(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
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
        self.assertEqual(payload["decision"], "keep_origin")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "english_residue_repeated")
        self.assertEqual(payload["translation_diagnostics"]["route_path"], ["block_level", "direct_typst", "keep_origin"])

    def test_direct_typst_validation_failure_does_not_enter_tagged_placeholder_retry(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
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

    def test_continuation_group_with_placeholders_prefers_tagged_first_path(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        control_context = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
        )
        item = {
            "item_id": "__cg__:cg-009-013",
            "translation_unit_id": "__cg__:cg-009-013",
            "page_idx": 8,
            "block_type": "text",
            "continuation_group": "cg-009-013",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "This continuation group mentions <f1-c1b/> and <f2-a77/> inside a long body paragraph.",
            "translation_unit_protected_source_text": "This continuation group mentions <f1-c1b/> and <f2-a77/> inside a long body paragraph.",
            "formula_map": [{"placeholder": "<f1-c1b/>"}, {"placeholder": "<f2-a77/>"}],
            "translation_unit_formula_map": [{"placeholder": "<f1-c1b/>"}, {"placeholder": "<f2-a77/>"}],
        }
        context = control_context.build_translation_control_context(mode="sci")

        with mock.patch.object(module, "translate_single_item_stable_placeholder_text") as tagged_mock:
            tagged_mock.return_value = {
                item["item_id"]: {
                    "decision": "translate",
                    "translated_text": "该连续段落已经稳定保留占位符 <f1-c1b/> 与 <f2-a77/>。",
                    "final_status": "translated",
                }
            }
            with mock.patch.object(module, "translate_single_item_plain_text", side_effect=AssertionError("plain path should not run first")):
                result = module.translate_single_item_plain_text_with_retries(
                    item,
                    api_key="",
                    model="deepseek-chat",
                    base_url="https://api.deepseek.com/v1",
                    request_label="test",
                    context=context,
                    diagnostics=None,
                )
        tagged_mock.assert_called_once()
        payload = result[item["item_id"]]
        self.assertEqual(payload["translation_diagnostics"]["route_path"], ["block_level", "tagged_placeholder_first"])

    def test_domain_context_parser_salvages_fields_from_malformed_json(self):
        module = _load_module(
            "services.translation.llm.structured_parsers",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "structured_parsers.py",
        )
        content = """
        Here is the result:
        {
          "domain": "computational chemistry",
          "summary": "A materials-modeling paper with equation-heavy prose."
          "translation_guidance": "保留术语、缩写和公式记号，不要意译。"
        }
        """
        result = module.parse_domain_context_response(content, preview_text="preview")
        self.assertEqual(result["domain"], "computational chemistry")
        self.assertEqual(result["summary"], "A materials-modeling paper with equation-heavy prose.")
        self.assertEqual(result["translation_guidance"], "保留术语、缩写和公式记号，不要意译。")

    def test_continuation_review_uses_strict_json_schema_format(self):
        module = _load_module(
            "services.translation.continuation.review",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "review.py",
        )
        schema = module.CONTINUATION_REVIEW_RESPONSE_SCHEMA
        self.assertEqual(schema["type"], "json_schema")
        self.assertTrue(schema["json_schema"]["strict"])
        self.assertEqual(schema["json_schema"]["schema"]["required"], ["decisions"])

    def test_domain_context_uses_strict_json_schema_format(self):
        module = _load_module(
            "services.translation.llm.domain_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "domain_context.py",
        )
        schema = module.DOMAIN_CONTEXT_RESPONSE_SCHEMA
        self.assertEqual(schema["type"], "json_schema")
        self.assertTrue(schema["json_schema"]["strict"])
        self.assertEqual(
            schema["json_schema"]["schema"]["required"],
            ["domain", "summary", "translation_guidance"],
        )

    def test_garbled_reconstruction_uses_strict_json_schema_format(self):
        module = _load_module(
            "services.translation.postprocess.garbled_reconstruction",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "postprocess" / "garbled_reconstruction.py",
        )
        schema = module.GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA
        self.assertEqual(schema["type"], "json_schema")
        self.assertTrue(schema["json_schema"]["strict"])
        self.assertEqual(schema["json_schema"]["schema"]["required"], ["translated_text"])

    def test_garbled_reconstruction_skips_formula_bearing_items(self):
        module = _load_module(
            "services.translation.postprocess.garbled_reconstruction",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "postprocess" / "garbled_reconstruction.py",
        )
        item = {
            "item_id": "p003-b005",
            "block_type": "text",
            "should_translate": True,
            "translation_unit_protected_source_text": "根据 <f1-e29/> 可得 Q_t。",
            "translation_unit_protected_translated_text": "",
            "translation_unit_formula_map": [
                {"placeholder": "<f1-e29/>", "formula_text": r"Q _ { t } = (1 - \beta_t) I + \beta_t 1 m^\top"}
            ],
            "translation_unit_protected_map": [
                {
                    "token_tag": "<f1-e29/>",
                    "token_type": "formula",
                    "original_text": r"Q _ { t } = (1 - \beta_t) I + \beta_t 1 m^\top",
                    "restore_text": r"Q _ { t } = (1 - \beta_t) I + \beta_t 1 m^\top",
                    "source_offset": 3,
                    "checksum": "e29",
                }
            ],
        }
        self.assertFalse(module.should_reconstruct_garbled_item(item))

    def test_english_residue_guard_ignores_reference_like_entries(self):
        module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        item = {
            "item_id": "p011-b009",
            "block_type": "text",
            "metadata": {
                "structure_role": "body",
                "source": {"raw_type": "ref_text"},
            },
            "translation_unit_protected_source_text": (
                "Gregor Bachmann and Vaishnavh Nagarajan. The pitfalls of next-token prediction. "
                "In Forty-first International Conference on Machine Learning, ICML, 2024."
            ),
        }
        translated = (
            "Gregor Bachmann and Vaishnavh Nagarajan. 下一个词预测的陷阱. "
            "In Forty-first International Conference on Machine Learning, ICML, 2024."
        )
        self.assertFalse(module.looks_like_untranslated_english_output(item, translated))

    def test_translation_and_formula_outputs_use_strict_json_schema_format(self):
        module = _load_module(
            "services.translation.llm.structured_models",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "structured_models.py",
        )
        for schema in [
            module.TRANSLATION_BATCH_RESPONSE_SCHEMA,
            module.TRANSLATION_SINGLE_TEXT_RESPONSE_SCHEMA,
            module.TRANSLATION_SINGLE_DECISION_RESPONSE_SCHEMA,
            module.FORMULA_SEGMENT_RESPONSE_SCHEMA,
        ]:
            self.assertEqual(schema["type"], "json_schema")
            self.assertTrue(schema["json_schema"]["strict"])

    def test_formula_segment_parser_accepts_schema_json_payload(self):
        module = _load_module(
            "services.translation.llm.segment_routing",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "segment_routing.py",
        )
        result = module.parse_segment_translation_payload(
            '{"segments":[{"segment_id":"1","translated_text":"第一段"},{"segment_id":"2","translated_text":"第二段"}]}',
            expected_segments=[
                {"segment_id": "1", "source_text": "first"},
                {"segment_id": "2", "source_text": "second"},
            ],
        )
        self.assertEqual(result, {"1": "第一段", "2": "第二段"})

    def test_domain_context_cache_round_trip(self):
        module = _load_module(
            "services.translation.llm.domain_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "domain_context.py",
        )
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp)
            payload = {
                "domain": "chemistry",
                "summary": "cached",
                "translation_guidance": "guidance",
                "preview_text": "preview",
            }
            module.save_domain_context(output_dir, payload)
            loaded = module.load_cached_domain_context(output_dir)
            self.assertEqual(loaded, payload)

    def test_domain_context_raw_response_round_trip(self):
        module = _load_module(
            "services.translation.llm.domain_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "domain_context.py",
        )
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp)
            path = module.save_domain_context_raw(output_dir, "raw model response")
            self.assertEqual(path.read_text(encoding="utf-8"), "raw model response")

    def test_translation_control_context_merges_terms_retrieval_and_extra_guidance(self):
        module = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
        )
        context = module.build_translation_control_context(
            mode="sci",
            domain_guidance="domain-guidance",
            rule_guidance="rule-guidance",
            extra_guidance="extra-guidance",
            glossary_entries=[module.GlossaryEntry(source="Engram", target="Engram")],
            retrieval_entries=[module.RetrievalEvidence(source="rag-1", content="Retrieved note")],
        )
        merged = context.merged_guidance
        self.assertIn("domain-guidance", merged)
        self.assertIn("rule-guidance", merged)
        self.assertIn("Glossary preferences:", merged)
        self.assertIn("Retrieved reference context:", merged)
        self.assertIn("extra-guidance", merged)

    def test_build_translation_context_from_policy_uses_policy_guidance(self):
        _load_module(
            "services.translation.policy",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "__init__.py",
        )
        module = _load_module(
            "services.translation.session_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "session_context.py",
        )

        class _Policy:
            mode = "sci"
            domain_context = {"translation_guidance": "domain-guidance"}
            rule_guidance = "rule-guidance"

        context = module.build_translation_context_from_policy(
            _Policy(),
            extra_guidance="extra-guidance",
            retrieval_entries=[module.RetrievalEvidence(source="rag", content="snippet")],
        )
        self.assertEqual(context.mode, "sci")
        self.assertIn("domain-guidance", context.merged_guidance)
        self.assertIn("rule-guidance", context.merged_guidance)
        self.assertIn("extra-guidance", context.merged_guidance)
        self.assertIn("snippet", context.merged_guidance)
        self.assertEqual(context.engine_profile_name, "balanced")
        self.assertEqual(context.batch_policy.plain_batch_size, 6)

    def test_build_translation_context_uses_model_profile_overrides(self):
        _load_module(
            "services.translation.policy",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "__init__.py",
        )
        module = _load_module(
            "services.translation.session_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "session_context.py",
        )

        class _Policy:
            mode = "sci"
            domain_context = {"translation_guidance": "domain-guidance"}
            rule_guidance = "rule-guidance"

        context = module.build_translation_context_from_policy(
            _Policy(),
            model="qwen35-9b-q4km",
            base_url="http://example.com/v1",
        )
        self.assertEqual(context.engine_profile_name, "qwen35_low_concurrency_fast")
        self.assertEqual(context.fallback_policy.formula_segment_attempts, 2)
        self.assertEqual(context.segmentation_policy.prefer_plain_when_segment_count_leq, 6)

    def test_formula_segment_route_prefers_plain_for_small_segment_count(self):
        module = _load_module(
            "services.translation.llm.segment_routing",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "segment_routing.py",
        )
        item = {
            "item_id": "p001-b001",
            "protected_source_text": "After <f1-a7c/> hours, activity increased and <f2-b2d/> remained stable.",
        }
        policy = module.SegmentationPolicy(
            prefer_plain_when_segment_count_leq=6,
            small_formula_inline_enabled=False,
        )
        self.assertEqual(module.formula_segment_translation_route(item, policy=policy), "none")

    def test_continuation_review_short_circuits_high_confidence_pairs(self):
        _install_minimal_continuation_stub()
        module = _load_module(
            "services.translation.orchestration.document_orchestrator",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "orchestration" / "document_orchestrator.py",
        )
        flat_payload = [
            {
                "item_id": "a",
                "page_idx": 0,
                "block_type": "text",
                "protected_source_text": "This sentence continues with",
                "bbox": [10, 10, 200, 30],
            },
            {
                "item_id": "b",
                "page_idx": 1,
                "block_type": "text",
                "protected_source_text": "and additional evidence from the experiment.",
                "bbox": [10, 10, 200, 30],
            },
            {
                "item_id": "c",
                "page_idx": 1,
                "block_type": "text",
                "protected_source_text": "Conclusion.",
                "bbox": [220, 10, 320, 30],
            },
            {
                "item_id": "d",
                "page_idx": 1,
                "block_type": "text",
                "protected_source_text": "Methods",
                "bbox": [10, 50, 120, 70],
            },
        ]
        pairs = [
            {"prev_item_id": "a", "next_item_id": "b"},
            {"prev_item_id": "c", "next_item_id": "d"},
        ]
        auto_join, review = module._split_high_confidence_continuation_pairs(flat_payload, pairs)
        self.assertEqual(auto_join, [("a", "b")])
        self.assertEqual(review, [])

    def test_single_item_transport_failure_degrades_to_keep_origin(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        control_module = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
        )
        context = control_module.build_translation_control_context()
        item = {
            "item_id": "p001-b002",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "The advancement of complex computer programs with faster computing power remains important.",
            "translation_unit_protected_source_text": "The advancement of complex computer programs with faster computing power remains important.",
        }

        with mock.patch.object(
            module,
            "translate_single_item_plain_text",
            side_effect=requests.ConnectionError("Read timed out"),
        ):
            result = module.translate_single_item_plain_text_with_retries(
                item,
                api_key="sk-test",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="test transport",
                context=context,
            )

        self.assertEqual(result["p001-b002"]["decision"], "keep_origin")
        self.assertEqual(result["p001-b002"]["error_taxonomy"], "transport")
        self.assertEqual(
            result["p001-b002"]["translation_diagnostics"]["route_path"],
            ["block_level", "plain_text", "keep_origin"],
        )

    def test_batched_transport_failure_falls_back_to_single_item_path(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        control_module = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
        )
        context = control_module.build_translation_control_context()
        batch = [
            {
                "item_id": "p001-b001",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
                "protected_source_text": "This sentence describes antibacterial activity and provides enough body text for translation.",
                "translation_unit_protected_source_text": "This sentence describes antibacterial activity and provides enough body text for translation.",
                "_batched_plain_candidate": True,
            },
            {
                "item_id": "p001-b002",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
                "protected_source_text": "This paragraph keeps enough content for translation even when the network request times out.",
                "translation_unit_protected_source_text": "This paragraph keeps enough content for translation even when the network request times out.",
                "_batched_plain_candidate": True,
            },
        ]

        with mock.patch.object(module, "split_cached_batch", return_value=({}, batch)):
            with mock.patch.object(
                module,
                "translate_batch_once",
                side_effect=requests.ConnectionError("Read timed out"),
            ):
                with mock.patch.object(
                    module,
                    "translate_single_item_plain_text_with_retries",
                    side_effect=[
                        {"p001-b001": {"decision": "translate", "translated_text": "第一条已翻译", "final_status": "translated"}},
                        {"p001-b002": {"decision": "translate", "translated_text": "第二条已翻译", "final_status": "translated"}},
                    ],
                ) as single_mock:
                    result = module.translate_items_plain_text(
                        batch,
                        api_key="sk-test",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test batch transport",
                        context=context,
                    )

        self.assertEqual(result["p001-b001"]["decision"], "translate")
        self.assertEqual(result["p001-b002"]["decision"], "translate")
        self.assertEqual(result["p001-b001"]["translated_text"], "第一条已翻译")
        self.assertEqual(result["p001-b002"]["translated_text"], "第二条已翻译")
        self.assertEqual(single_mock.call_count, 2)
        self.assertEqual(
            single_mock.call_args_list[0].kwargs["request_label"],
            "test batch transport item 1/2 p001-b001",
        )

    def test_batched_plain_suspicious_keep_origin_only_retries_flagged_items(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        control_module = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
        )
        placeholder_module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        context = control_module.build_translation_control_context()
        batch = [
            {
                "item_id": "p001-b001",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
                "protected_source_text": "This sentence describes antibacterial activity and provides enough body text for translation.",
                "translation_unit_protected_source_text": "This sentence describes antibacterial activity and provides enough body text for translation.",
                "_batched_plain_candidate": True,
            },
            {
                "item_id": "p001-b002",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
                "protected_source_text": "This paragraph should survive the batch response and must not be retried.",
                "translation_unit_protected_source_text": "This paragraph should survive the batch response and must not be retried.",
                "_batched_plain_candidate": True,
            },
        ]
        batch_result = {
            "p001-b001": {"decision": "keep_origin", "translated_text": "", "final_status": "kept_origin"},
            "p001-b002": {"decision": "translate", "translated_text": "这一段应该直接接受。", "final_status": "translated"},
        }
        suspicious_error = placeholder_module.SuspiciousKeepOriginError("p001-b001", batch_result)
        retried_items: list[str] = []

        def fake_single(item, **kwargs):
            retried_items.append(item["item_id"])
            return {
                item["item_id"]: {
                    "decision": "translate",
                    "translated_text": "这段通过单条补跑得到译文。",
                    "final_status": "translated",
                }
            }

        with mock.patch.object(module, "split_cached_batch", return_value=({}, batch)):
            with mock.patch.object(module, "translate_batch_once", side_effect=suspicious_error):
                with mock.patch.object(module, "translate_single_item_plain_text_with_retries", side_effect=fake_single):
                    result = module.translate_items_plain_text(
                        batch,
                        api_key="sk-test",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test suspicious batch",
                        context=context,
                    )

        self.assertEqual(retried_items, ["p001-b001"])
        self.assertEqual(result["p001-b002"]["translated_text"], "这一段应该直接接受。")
        self.assertEqual(
            result["p001-b002"]["translation_diagnostics"]["route_path"],
            ["block_level", "batched_plain"],
        )
        self.assertEqual(result["p001-b001"]["translated_text"], "这段通过单条补跑得到译文。")


if __name__ == "__main__":
    unittest.main()
