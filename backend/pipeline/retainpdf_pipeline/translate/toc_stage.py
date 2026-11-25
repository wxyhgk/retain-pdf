"""目录 agent 接进翻译（2026-11-25）：和普通翻译同步跑。

``translation.toc``：``agent``（默认，2026-11-25 用户定；目录 agent，backend/toc-agent）/ ``translate``（目录条目交给普通翻译，
和以前一样）。``agent`` 时给翻译请求一个 ``fixed_translations_fn``：翻译一开头，底座在另一个线程里调它
（和领域识别同时），它翻完整本书的目录、把译名对到正文里同名的标题上，返回 {块号: 定译}；引擎见了定译的块不再发请求。
结果和缓存在 ``translated/toc-agent.v1.json``。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

TOC_MODES = ("translate", "agent")
DEFAULT_TOC_MODE = "agent"


def normalize_toc_mode(value: Any) -> str:
    mode = str(value or DEFAULT_TOC_MODE).strip().lower()
    return mode if mode in TOC_MODES else DEFAULT_TOC_MODE


def toc_fixed_translations_fn(
    *,
    mode: str,
    output_dir: Path,
    api_key: str,
    model: str,
    base_url: str,
    glossary_entries: list[Any] | None = None,
    skip_titles: bool = False,
    chat_fn: Callable[..., Any] | None = None,  # 测试注入
) -> Callable[[dict], dict[str, str]] | None:
    if normalize_toc_mode(mode) != "agent":
        return None

    def run(document: dict) -> dict[str, str]:
        from retainpdf_toc_agent_engine import toc_chat_fn
        from retainpdf_toc_agent_engine import toc_fixed_translations

        return toc_fixed_translations(
            document,
            output_dir=output_dir,
            chat_fn=chat_fn or toc_chat_fn(model=model, base_url=base_url, api_key=api_key),
            model_identity={"model": model, "base_url": base_url},
            glossary_entries=glossary_entries or [],
            skip_titles=skip_titles,
        )

    return run


__all__ = ["TOC_MODES", "normalize_toc_mode", "toc_fixed_translations_fn"]
