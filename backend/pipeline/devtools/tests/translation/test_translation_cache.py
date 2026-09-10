import sys
from pathlib import Path
import json


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.llm.shared.cache import cache_key_for_item
from retainpdf_pipeline.translate.llm.shared import cache


def test_translation_cache_key_includes_translation_style_hint() -> None:
    base_item = {
        "item_id": "p001-b001",
        "translation_unit_protected_source_text": "Default: 0",
    }
    hinted_item = {
        **base_item,
        "translation_style_hint": "保持结构化字段名和值。",
        "translation_structure_kind": "structured_technical_block",
    }

    before = cache_key_for_item(
        base_item,
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
    )
    after = cache_key_for_item(
        hinted_item,
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
    )

    assert before != after


def test_translation_cache_key_includes_target_language() -> None:
    item = {
        "item_id": "p001-b001",
        "translation_unit_protected_source_text": "Default: 0",
    }

    zh_key = cache_key_for_item(
        item,
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
        target_lang="zh-CN",
        target_language_name="简体中文",
    )
    en_key = cache_key_for_item(
        item,
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
        target_lang="en",
        target_language_name="英文",
    )

    assert zh_key != en_key


def test_translation_cache_key_includes_policy_version(monkeypatch) -> None:
    from retainpdf_pipeline.translate.core import engine_identity

    item = {
        "item_id": "p001-b001",
        "translation_unit_protected_source_text": "Default: 0",
    }

    before = cache.cache_key_for_item(
        item,
        model="deepseek-v4-flash",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
    )
    monkeypatch.setattr(engine_identity, "TRANSLATION_POLICY_VERSION", "policy-test-version")
    after = cache.cache_key_for_item(
        item,
        model="deepseek-v4-flash",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
    )

    assert before != after


def test_translation_cache_sanitizes_reasoning_leak_on_load(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(cache.paths, "TRANSLATION_UNIT_CACHE_DIR", tmp_path)
    item = {
        "item_id": "p135-b009",
        "translation_unit_protected_source_text": "The time-ordered response has to be distinguished from the retarded response function,",
    }
    cache_key = cache.cache_key_for_item(
        item,
        model="deepseek-v4-flash",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
    )
    path = tmp_path / cache_key[:2] / f"{cache_key}.json"
    path.parent.mkdir(parents=True)
    leaked = (
        '函数需要加"函数"吗？为保准确，可以译为"时间有序响应（函数）必须与推迟响应函数加以区分"。'
        '更简洁：直接"时间有序响应必须与推迟响应函数加以区分"。'
        '我选择："时间有序响应必须与推迟响应函数加以区分，"'
    )
    path.write_text(
        json.dumps({"cache_key": cache_key, "decision": "translate", "translated_text": leaked}, ensure_ascii=False),
        encoding="utf-8",
    )

    result = cache.load_cached_translation(
        item,
        model="deepseek-v4-flash",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
    )
    healed = json.loads(path.read_text(encoding="utf-8"))

    assert result["translated_text"] == "时间有序响应必须与推迟响应函数加以区分，"
    assert healed["translated_text"] == "时间有序响应必须与推迟响应函数加以区分，"


def test_translation_cache_persists_validated_item_atomically(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(cache.paths, "TRANSLATION_UNIT_CACHE_DIR", tmp_path)
    item = {
        "item_id": "p001-b001",
        "translation_unit_protected_source_text": "A durable intermediate result.",
    }
    cache.store_cached_translation(
        item,
        {"decision": "translate", "translated_text": "一个持久的中间结果。"},
        model="deepseek-v4-flash",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
    )

    restored = cache.load_cached_translation(
        item,
        model="deepseek-v4-flash",
        base_url="https://api.deepseek.com/v1",
        mode="sci",
    )

    assert restored["translated_text"] == "一个持久的中间结果。"
    assert not list(tmp_path.rglob("*.tmp"))


def test_unit_cache_prunes_expired_entries_once(tmp_path, monkeypatch) -> None:
    import os
    import time as time_module

    from retainpdf_pipeline.translate.llm.shared import cache as cache_module
    from retainpdf_pipeline.foundation.config import paths as paths_module

    cache_root = tmp_path / "_translation_unit_cache"
    shard = cache_root / "ab"
    shard.mkdir(parents=True)
    stale = shard / "ab" "0" * 62 + ".json" if False else shard / ("ab" + "0" * 62 + ".json")
    fresh = shard / ("ab" + "1" * 62 + ".json")
    stale.write_text("{}", encoding="utf-8")
    fresh.write_text("{}", encoding="utf-8")
    old = time_module.time() - 200 * 86400
    os.utime(stale, (old, old))

    monkeypatch.setattr(paths_module, "TRANSLATION_UNIT_CACHE_DIR", cache_root)
    monkeypatch.setattr(cache_module, "_PRUNE_DONE", False)
    cache_module._prune_expired_cache_entries_once()

    assert not stale.exists()
    assert fresh.exists()
    # 每进程只清扫一次
    stale.write_text("{}", encoding="utf-8")
    os.utime(stale, (old, old))
    cache_module._prune_expired_cache_entries_once()
    assert stale.exists()
