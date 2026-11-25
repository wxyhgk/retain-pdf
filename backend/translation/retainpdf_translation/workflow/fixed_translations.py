"""定好的译文（2026-11-25 起，目录 agent 给目录条目和对上的正文标题定译）。

翻译开头由请求的 ``fixed_translations_fn`` 算出 {块号: 译文}，这里写进文档块的
``metadata.fixed_translation``；抽取条目时经元数据桥（``core/ocr/json_extractor.py``）带到条目上，
两个引擎各自认：普通翻译当成不发请求的直接结果（``fast_path/fixed_translations.py``），
翻译 agent 当成 ``BlockInput.fixed_translation``。

只给自成一个翻译单元的块：续段组成员、带公式 / 受保护片段的块，引擎照旧自己翻（定译是纯文字）。
"""
from __future__ import annotations

from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

FIXED_TRANSLATION_KEY = "fixed_translation"
FIXED_TRANSLATION_SOURCE_KEY = "fixed_translation_source"


def start_fixed_translations(fn: Callable[[dict], dict[str, str]] | None, data: dict) -> Future | None:
    """在另一个线程里开始算定译（和领域识别、译前准备同时跑）。"""
    if fn is None:
        return None
    pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="fixed-translations")
    future = pool.submit(fn, data)
    pool.shutdown(wait=False)
    return future


def finish_fixed_translations(future: Future | None) -> dict[str, str]:
    """等定译算完。出错只打日志、返回空：照常翻，不会比没有它差。"""
    if future is None:
        return {}
    try:
        result = future.result()
    except Exception as error:  # noqa: BLE001
        print(f"fixed translations: failed, translating normally ({type(error).__name__}: {error})"[:500], flush=True)
        return {}
    return {str(key): str(value) for key, value in (result or {}).items() if str(key) and str(value).strip()}


def apply_fixed_translations(data: dict, fixed: dict[str, str], *, source: str = "toc_agent") -> int:
    """把定译写进文档块的元数据，返回写了几块。"""
    if not fixed:
        return 0
    applied = 0
    for page in data.get("pages") or []:
        for block in page.get("blocks") or []:
            if not isinstance(block, dict):
                continue
            translation = fixed.get(str(block.get("block_id") or ""))
            if not translation:
                continue
            metadata = block.get("metadata")
            if not isinstance(metadata, dict):
                metadata = {}
                block["metadata"] = metadata
            metadata[FIXED_TRANSLATION_KEY] = translation
            metadata[FIXED_TRANSLATION_SOURCE_KEY] = source
            applied += 1
    return applied


__all__ = [
    "FIXED_TRANSLATION_KEY",
    "FIXED_TRANSLATION_SOURCE_KEY",
    "apply_fixed_translations",
    "finish_fixed_translations",
    "start_fixed_translations",
]
