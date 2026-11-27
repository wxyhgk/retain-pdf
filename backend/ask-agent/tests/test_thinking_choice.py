"""记住上次选的思考档位（2026-11-27）：按模型连接记一档；文件坏了、写不了都当没有。"""
from __future__ import annotations

import json
from pathlib import Path

from retainpdf_ask_agent import thinking_choice


def test_levels_are_kept_per_connection(tmp_path: Path) -> None:
    path = str(tmp_path / "ask" / "thinking-levels.json")
    qwen = thinking_choice.connection_key(protocol="openai", base_url="https://dashscope.aliyuncs.com/compatible-mode/v1/", model="qwen3.8-flash")
    claude = thinking_choice.connection_key(protocol="anthropic", base_url="", model="claude-haiku-5-5")
    assert qwen.endswith("/compatible-mode/v1|qwen3.8-flash")
    assert thinking_choice.load(path, qwen) == ""
    assert thinking_choice.save(path, qwen, "high") and thinking_choice.save(path, claude, "low")
    assert thinking_choice.save(path, qwen, "off")
    assert (thinking_choice.load(path, qwen), thinking_choice.load(path, claude)) == ("off", "low")
    # 没给路径不记
    assert not thinking_choice.save("", qwen, "on") and thinking_choice.load("", qwen) == ""


def test_broken_files_count_as_nothing_and_old_entries_are_dropped(tmp_path: Path) -> None:
    path = tmp_path / "thinking-levels.json"
    path.write_text("{not json", encoding="utf-8")
    assert thinking_choice.load(str(path), "k") == ""
    assert thinking_choice.save(str(path), "k", "on")
    for index in range(thinking_choice.MAX_ENTRIES + 5):
        thinking_choice.save(str(path), f"k{index}", "on")
    levels = json.loads(path.read_text(encoding="utf-8"))["levels"]
    assert len(levels) == thinking_choice.MAX_ENTRIES and "k" not in levels
    assert not list(tmp_path.glob(".thinking-levels-*")), "no temp files left behind"
