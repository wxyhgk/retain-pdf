"""表格 agent 的提示词（2026-11-25 从翻译包的提示词目录搬来，文字一字没改）。"""
from __future__ import annotations

from functools import lru_cache
from importlib import resources


@lru_cache(maxsize=None)
def load_prompt(name: str) -> str:
    """和翻译底座的 ``load_prompt`` 一样：读文件、去掉首尾空白。"""
    return resources.files(__name__).joinpath(name).read_text(encoding="utf-8").strip()


__all__ = ["load_prompt"]
