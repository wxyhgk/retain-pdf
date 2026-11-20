from __future__ import annotations

from unittest import mock


from retainpdf_translation_classic.llm.shared import cache
from retainpdf_translation.core import engine_identity
from retainpdf_translation.llm.validation.protocol_shell import looks_like_protocol_shell_output


def test_protocol_shell_detection_accepts_legitimate_source_text_requests_inside_sentence() -> None:
    assert not looks_like_protocol_shell_output("请在表单中提供原文后再点击提交。")
    assert not looks_like_protocol_shell_output("This section asks users to please provide source text for auditing.")


def test_protocol_shell_detection_rejects_only_standalone_request_or_json_shell() -> None:
    assert looks_like_protocol_shell_output("请提供原文")
    assert looks_like_protocol_shell_output("please provide source text")
    assert looks_like_protocol_shell_output('{"translated_text": "壳"}')
    assert looks_like_protocol_shell_output('{"translations": [{"item_id": "a"}]}')


def test_translation_cache_hash_includes_all_active_prompt_files() -> None:
    item = {
        "item_id": "p001-b001",
        "translation_unit_protected_source_text": "This is a source sentence.",
    }
    before = cache.cache_key_for_item(
        item,
        model="deepseek-flash",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
    )

    original_load_prompt = engine_identity.load_prompt

    def fake_load_prompt(name: str) -> str:
        text = original_load_prompt(name)
        if name in engine_identity.TRANSLATION_PROMPT_FILES:
            return f"{text}\nCACHE TEST MUTATION {name}"
        return text

    with mock.patch.object(engine_identity, "load_prompt", side_effect=fake_load_prompt):
        cache._PROMPT_HASHES.clear()
        after = cache.cache_key_for_item(
            item,
            model="deepseek-flash",
            base_url="https://api.deepseek.com/v1",
            mode="sci",
        )
    cache._PROMPT_HASHES.clear()

    assert before != after
