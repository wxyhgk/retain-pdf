import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")


def load_retrying_translator():
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))
    package_paths = {
        "services": REPO_SCRIPTS_ROOT / "services",
        "services.translation": REPO_SCRIPTS_ROOT / "services" / "translation",
        "services.translation.llm": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm",
        "services.translation.policy": REPO_SCRIPTS_ROOT / "services" / "translation" / "policy",
        "services.document_schema": REPO_SCRIPTS_ROOT / "services" / "document_schema",
    }
    for name, path in package_paths.items():
        module = sys.modules.get(name)
        if module is None:
            module = types.ModuleType(name)
            module.__path__ = [str(path)]
            sys.modules[name] = module

    for module_name in (
        "services.translation.llm.retrying_translator",
        "services.translation.llm.fallbacks",
        "services.translation.llm.segment_routing",
        "services.translation.llm.deepseek_client",
    ):
        sys.modules.pop(module_name, None)

    spec = importlib.util.spec_from_file_location(
        "services.translation.llm.retrying_translator",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "retrying_translator.py",
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def make_formula_item(formula_count: int) -> dict:
    parts = []
    for index in range(1, formula_count + 1):
        parts.append(f"clause {index} explaining the result")
        parts.append(f"[[FORMULA_{index}]]")
    parts.append("final discussion sentence")
    source = " ".join(parts)
    return {
        "item_id": f"formula-{formula_count}",
        "block_type": "text",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "metadata": {"structure_role": "body"},
        "formula_map": {"dummy": "dummy"},
    }


def make_small_formula_inline_item() -> dict:
    source = (
        "The work function <f1-6a9/> which is also abbreviated as <f2-ef6/> "
        "of a catalyst can be defined as the minimum energy required to extract one electron."
    )
    return {
        "item_id": "small-inline-1",
        "block_type": "text",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "metadata": {"structure_role": "body"},
        "formula_map": {"dummy": "dummy"},
    }


class RetryingTranslatorFormulaWindowTests(unittest.TestCase):
    def test_formula_segment_messages_default_to_tagged_protocol(self):
        load_retrying_translator()
        import services.translation.llm.segment_routing as segment_routing

        item = make_formula_item(2)
        skeleton, segments = segment_routing.build_formula_segment_plan(item["translation_unit_protected_source_text"])
        messages = segment_routing.build_formula_segment_messages(item, skeleton, segments)

        self.assertIn("<<<SEG id=1>>>", messages[0]["content"])
        self.assertNotIn('{"segments"', messages[0]["content"])

    def test_long_formula_block_prefers_windowed_route(self):
        module = load_retrying_translator()
        item = make_formula_item(20)
        self.assertEqual(module._formula_segment_translation_route(item), "windowed")
        self.assertFalse(module._should_use_formula_segment_translation(item))

    def test_small_formula_inline_prefers_segmented_route(self):
        module = load_retrying_translator()
        item = make_small_formula_inline_item()
        self.assertEqual(module._formula_segment_translation_route(item), "small_inline")
        self.assertTrue(module._should_use_formula_segment_translation(item))

    def test_small_formula_inline_uses_risk_score_not_single_phrase_only(self):
        load_retrying_translator()
        import services.translation.llm.segment_routing as segment_routing

        source = (
            "The parameter <f1-a7c/> is expressed as <f2-b2d/> "
            "and can be used to describe the catalyst surface."
        )
        score = segment_routing.small_formula_risk_score(source)

        self.assertGreaterEqual(score, 4)

    def test_plain_text_retry_uses_windowed_route_before_plain_text(self):
        module = load_retrying_translator()
        import services.translation.llm.fallbacks as fallbacks

        item = make_formula_item(20)
        item["_heavy_formula_split_applied"] = True
        calls: list[str] = []

        def fake_windowed(*args, **kwargs):
            calls.append("windowed")
            return {item["item_id"]: module._result_entry("translate", "窗口化结果 [[FORMULA_1]]")}

        def fake_plain(*args, **kwargs):
            raise AssertionError("plain-text path should not be reached for this test")

        original_windowed = fallbacks.translate_single_item_formula_segment_windows_with_retries
        original_plain = fallbacks.translate_single_item_plain_text
        try:
            fallbacks.translate_single_item_formula_segment_windows_with_retries = fake_windowed
            fallbacks.translate_single_item_plain_text = fake_plain
            result = module._translate_single_item_plain_text_with_retries(item, request_label="unit")
        finally:
            fallbacks.translate_single_item_formula_segment_windows_with_retries = original_windowed
            fallbacks.translate_single_item_plain_text = original_plain

        self.assertEqual(calls, ["windowed"])
        self.assertEqual(result[item["item_id"]]["decision"], "translate")

    def test_small_formula_inline_uses_segmented_before_plain_text(self):
        module = load_retrying_translator()
        import services.translation.llm.fallbacks as fallbacks
        from services.translation.llm.control_context import build_translation_control_context

        item = make_small_formula_inline_item()
        calls: list[str] = []

        def fake_single(*args, **kwargs):
            calls.append("segmented")
            return {item["item_id"]: module._result_entry("translate", "功函数 <f1-6a9/>，也缩写为 <f2-ef6/>，可定义为提取一个电子所需的最小能量。")}

        def fake_plain(*args, **kwargs):
            calls.append("plain")
            raise AssertionError("plain-text path should not be reached for small inline formula route")

        original_single = fallbacks.translate_single_item_formula_segment_text_with_retries
        original_plain = fallbacks.translate_single_item_plain_text
        try:
            fallbacks.translate_single_item_formula_segment_text_with_retries = fake_single
            fallbacks.translate_single_item_plain_text = fake_plain
            result = fallbacks.translate_single_item_plain_text_with_retries(
                item,
                api_key="",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="unit",
                context=build_translation_control_context(mode="sci"),
                diagnostics=None,
            )
        finally:
            fallbacks.translate_single_item_formula_segment_text_with_retries = original_single
            fallbacks.translate_single_item_plain_text = original_plain

        self.assertEqual(calls, ["segmented"])
        self.assertEqual(
            result[item["item_id"]]["translation_diagnostics"]["route_path"],
            ["block_level", "small_formula_inline"],
        )

    def test_heavy_formula_block_is_split_before_windowed_route(self):
        module = load_retrying_translator()
        import services.translation.llm.fallbacks as fallbacks
        from services.translation.llm.control_context import build_translation_control_context

        item = {
            "item_id": "heavy-formula-1",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "protected_source_text": (
                "Sentence one <f1-a7c/> explains the first case. "
                "Sentence two <f2-b2d/> compares the second case. "
                "Sentence three <f3-c3e/> links another conclusion. "
                "Sentence four <f4-d4f/> extends the argument. "
                "Sentence five <f5-e5a/> adds evidence. "
                "Sentence six <f6-f6b/> adds evidence. "
                "Sentence seven <f7-a1b/> adds evidence. "
                "Sentence eight <f8-b1c/> adds evidence. "
                "Sentence nine <f9-c1d/> adds evidence. "
                "Sentence ten <f10-d1e/> adds evidence. "
                "Sentence eleven <f11-e1f/> adds evidence. "
                "Sentence twelve <f12-f1a/> adds evidence. "
                "Sentence thirteen <f13-a2b/> adds evidence. "
                "Sentence fourteen <f14-b2c/> adds evidence. "
                "Sentence fifteen <f15-c2d/> adds evidence. "
                "Sentence sixteen <f16-d2e/> closes the section."
            ),
            "translation_unit_protected_source_text": (
                "Sentence one <f1-a7c/> explains the first case. "
                "Sentence two <f2-b2d/> compares the second case. "
                "Sentence three <f3-c3e/> links another conclusion. "
                "Sentence four <f4-d4f/> extends the argument. "
                "Sentence five <f5-e5a/> adds evidence. "
                "Sentence six <f6-f6b/> adds evidence. "
                "Sentence seven <f7-a1b/> adds evidence. "
                "Sentence eight <f8-b1c/> adds evidence. "
                "Sentence nine <f9-c1d/> adds evidence. "
                "Sentence ten <f10-d1e/> adds evidence. "
                "Sentence eleven <f11-e1f/> adds evidence. "
                "Sentence twelve <f12-f1a/> adds evidence. "
                "Sentence thirteen <f13-a2b/> adds evidence. "
                "Sentence fourteen <f14-b2c/> adds evidence. "
                "Sentence fifteen <f15-c2d/> adds evidence. "
                "Sentence sixteen <f16-d2e/> closes the section."
            ),
            "protected_map": [{"token_tag": f"<f{i}-a7c/>", "token_type": "formula", "checksum": "a7c"} for i in range(1, 17)],
            "formula_map": [{"placeholder": f"<f{i}-a7c/>"} for i in range(1, 17)],
        }
        seen_chunks: list[str] = []

        def fake_translate(chunk_item, **kwargs):
            seen_chunks.append(chunk_item["translation_unit_protected_source_text"])
            return {item["item_id"]: module._result_entry("translate", f"已翻译块{len(seen_chunks)}")}

        original_plain_retry = fallbacks.translate_single_item_plain_text_with_retries
        try:
            fallbacks.translate_single_item_plain_text_with_retries = fake_translate
            result = fallbacks._translate_heavy_formula_block(
                item,
                api_key="",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="unit",
                context=build_translation_control_context(),
                diagnostics=None,
                split_reason="heavy_formula_segment_count",
            )
        finally:
            fallbacks.translate_single_item_plain_text_with_retries = original_plain_retry

        self.assertIsNotNone(result)
        self.assertGreater(len(seen_chunks), 1)
        self.assertEqual(result[item["item_id"]]["translated_text"], "已翻译块1 已翻译块2")

    def test_plain_text_retry_skips_windowed_fallback_for_single_window(self):
        module = load_retrying_translator()
        import services.translation.llm.fallbacks as fallbacks

        item = make_formula_item(2)
        calls: list[str] = []

        def fake_single(*args, **kwargs):
            calls.append("single")
            raise ValueError("single failed")

        def fake_windowed(*args, **kwargs):
            calls.append("windowed")
            raise AssertionError("windowed fallback should be skipped when only one window exists")

        def fake_plain(*args, **kwargs):
            calls.append("plain")
            return {item["item_id"]: module._result_entry("translate", "普通结果 [[FORMULA_1]]")}

        original_single = fallbacks.translate_single_item_formula_segment_text_with_retries
        original_windowed = fallbacks.translate_single_item_formula_segment_windows_with_retries
        original_plain = fallbacks.translate_single_item_plain_text
        try:
            fallbacks.translate_single_item_formula_segment_text_with_retries = fake_single
            fallbacks.translate_single_item_formula_segment_windows_with_retries = fake_windowed
            fallbacks.translate_single_item_plain_text = fake_plain
            result = module._translate_single_item_plain_text_with_retries(item, request_label="unit")
        finally:
            fallbacks.translate_single_item_formula_segment_text_with_retries = original_single
            fallbacks.translate_single_item_formula_segment_windows_with_retries = original_windowed
            fallbacks.translate_single_item_plain_text = original_plain

        self.assertEqual(calls, ["single", "plain"])
        self.assertEqual(result[item["item_id"]]["decision"], "translate")

    def test_windowed_formula_translation_rejects_local_english_keep_origin_window(self):
        module = load_retrying_translator()
        import services.translation.llm.deepseek_client as deepseek_client
        import services.translation.llm.segment_routing as segment_routing

        item = make_formula_item(20)
        calls: list[list[str]] = []

        def fake_request(messages, **kwargs):
            payload = json.loads(messages[-1]["content"])
            segment_ids = [segment["segment_id"] for segment in payload["segments"]]
            calls.append(segment_ids)
            if segment_ids[0] == "9":
                return "\n".join(
                    f"<<<SEG id={segment['segment_id']}>>>\n中文片段{segment['segment_id']}\n<<<END>>>"
                    for segment in payload["segments"][:-1]
                )
            return "\n".join(
                f"<<<SEG id={segment['segment_id']}>>>\n中文片段{segment['segment_id']}\n<<<END>>>"
                for segment in payload["segments"]
            )

        original_request = segment_routing.request_chat_content
        original_deepseek_request = deepseek_client.request_chat_content
        try:
            segment_routing.request_chat_content = fake_request
            deepseek_client.request_chat_content = fake_request
            with self.assertRaisesRegex(ValueError, "predominantly English"):
                module._translate_single_item_formula_segment_windows_with_retries(item, request_label="unit")
        finally:
            segment_routing.request_chat_content = original_request
            deepseek_client.request_chat_content = original_deepseek_request

        self.assertGreaterEqual(len(calls), 3)

    def test_segment_parser_allows_empty_optional_connector_segment(self):
        load_retrying_translator()
        import services.translation.llm.segment_routing as segment_routing

        expected_segments = [
            {"segment_id": "1", "source_text": "Transfer of a proton and an electron would lead to isobutyronitrile"},
            {"segment_id": "2", "source_text": "by"},
            {"segment_id": "3", "source_text": "NMR spectroscopy, and the main product is the radical homocoupling product"},
        ]
        content = json.dumps(
            {
                "segments": [
                    {"segment_id": "1", "translated_text": "转移一个质子和一个电子会生成异丁腈"},
                    {"segment_id": "2", "translated_text": ""},
                    {"segment_id": "3", "translated_text": "通过核磁共振波谱检测，主要产物是自由基均偶联产物"},
                ]
            },
            ensure_ascii=False,
        )

        result = segment_routing.parse_segment_translation_payload(content, expected_segments=expected_segments)

        self.assertEqual(result["2"], "")

    def test_segment_parser_rejects_empty_non_connector_segment(self):
        load_retrying_translator()
        import services.translation.llm.segment_routing as segment_routing

        expected_segments = [
            {"segment_id": "1", "source_text": "Experimentally Testing Concerted versus Stepwise PCET to a Model Alkyl Radical"},
        ]
        content = json.dumps({"segments": [{"segment_id": "1", "translated_text": ""}]}, ensure_ascii=False)

        with self.assertRaises(segment_routing.SegmentTranslationFormatError):
            segment_routing.parse_segment_translation_payload(content, expected_segments=expected_segments)

    def test_segment_translation_requests_tagged_then_json_fallback(self):
        load_retrying_translator()
        import services.translation.llm.segment_routing as segment_routing

        item = make_formula_item(2)
        skeleton, segments = segment_routing.build_formula_segment_plan(item["translation_unit_protected_source_text"])
        seen = []

        def fake_request(messages, **kwargs):
            seen.append(kwargs.get("response_format"))
            if kwargs.get("response_format") is None:
                return "bad tagged payload"
            return json.dumps(
                {
                    "segments": [
                        {"segment_id": segment["segment_id"], "translated_text": f"片段{segment['segment_id']}"}
                        for segment in segments
                    ]
                },
                ensure_ascii=False,
            )

        original_request = segment_routing.request_chat_content
        try:
            segment_routing.request_chat_content = fake_request
            translated = segment_routing._request_formula_segment_translation(
                item,
                skeleton,
                segments,
                api_key="",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                domain_guidance="",
                timeout_s=30,
                request_label="unit",
            )
        finally:
            segment_routing.request_chat_content = original_request

        self.assertIsNone(seen[0])
        self.assertIsNotNone(seen[1])
        self.assertEqual(set(translated), {segment["segment_id"] for segment in segments})

    def test_segment_translation_skips_json_fallback_on_semantic_tagged_failure(self):
        load_retrying_translator()
        import services.translation.llm.segment_routing as segment_routing

        item = make_formula_item(2)
        skeleton, segments = segment_routing.build_formula_segment_plan(item["translation_unit_protected_source_text"])
        seen = []

        def fake_request(messages, **kwargs):
            seen.append(kwargs.get("response_format"))
            return "\n".join(
                [
                    "<<<SEG id=1>>>",
                    "",
                    "<<<END>>>",
                    "<<<SEG id=2>>>",
                    "片段2",
                    "<<<END>>>",
                    "<<<SEG id=3>>>",
                    "片段3",
                    "<<<END>>>",
                ]
            )

        original_request = segment_routing.request_chat_content
        try:
            segment_routing.request_chat_content = fake_request
            with self.assertRaises(segment_routing.SegmentTranslationSemanticError):
                segment_routing._request_formula_segment_translation(
                    item,
                    skeleton,
                    segments,
                    api_key="",
                    model="deepseek-chat",
                    base_url="https://api.deepseek.com/v1",
                    domain_guidance="",
                    timeout_s=30,
                    request_label="unit",
                )
        finally:
            segment_routing.request_chat_content = original_request

        self.assertEqual(seen, [None])

    def test_plain_text_retry_uses_raw_single_item_fallback_after_repeated_empty_translation(self):
        module = load_retrying_translator()
        import services.translation.llm.fallbacks as fallbacks

        item = {
            "item_id": "body-1",
            "block_type": "text",
            "protected_source_text": "This paragraph contains enough English prose to require translation into Chinese for the user.",
            "translation_unit_protected_source_text": "This paragraph contains enough English prose to require translation into Chinese for the user.",
            "metadata": {"structure_role": "body"},
        }
        calls: list[str] = []

        def fake_plain(*args, **kwargs):
            calls.append("structured")
            raise fallbacks.EmptyTranslationError(item["item_id"])

        def fake_raw(*args, **kwargs):
            calls.append("raw")
            return {item["item_id"]: module._result_entry("translate", "这段英文正文已经通过原始纯文本回退成功翻译。")}

        original_plain = fallbacks.translate_single_item_plain_text
        original_raw = fallbacks.translate_single_item_plain_text_unstructured
        try:
            fallbacks.translate_single_item_plain_text = fake_plain
            fallbacks.translate_single_item_plain_text_unstructured = fake_raw
            result = module._translate_single_item_plain_text_with_retries(item, request_label="unit")
        finally:
            fallbacks.translate_single_item_plain_text = original_plain
            fallbacks.translate_single_item_plain_text_unstructured = original_raw

        self.assertEqual(calls[-1], "raw")
        self.assertEqual(result[item["item_id"]]["translated_text"], "这段英文正文已经通过原始纯文本回退成功翻译。")

    def test_sentence_fallback_chunks_long_group_when_no_sentence_split_exists(self):
        module = load_retrying_translator()
        import services.translation.llm.fallbacks as fallbacks
        from services.translation.llm.control_context import build_translation_control_context
        item = {
            "item_id": "group-1",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "continuation_group": "cg-001-001",
            "translation_unit_protected_source_text": " ".join(["word"] * 120),
            "protected_source_text": " ".join(["word"] * 120),
        }
        seen = []

        def fake_plain(*args, **kwargs):
            sentence_item = args[0]
            seen.append(sentence_item["translation_unit_protected_source_text"])
            return {item["item_id"]: module._result_entry("translate", "已翻译片段")}

        original_plain = fallbacks.translate_single_item_plain_text
        try:
            fallbacks.translate_single_item_plain_text = fake_plain
            result = fallbacks._sentence_level_fallback(
                item,
                api_key="",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="unit",
                context=build_translation_control_context(mode="sci"),
                diagnostics=None,
            )
        finally:
            fallbacks.translate_single_item_plain_text = original_plain

        self.assertGreaterEqual(len(seen), 2)
        self.assertEqual(result[item["item_id"]]["final_status"], "partially_translated")

if __name__ == "__main__":
    unittest.main()
