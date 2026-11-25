"""目录 agent 的提示词。"""
from __future__ import annotations

from functools import lru_cache
from importlib import resources


@lru_cache(maxsize=None)
def load_prompt(name: str) -> str:
    """读文件、去掉首尾空白（和翻译底座的 ``load_prompt`` 一样）。"""
    return resources.files(__name__).joinpath(name).read_text(encoding="utf-8").strip()


__all__ = ["load_prompt"]
