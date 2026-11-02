"""各任务共用的缓存（输出目录下的 `_*` 目录）按修改时间过期。

翻译单元缓存自己有一套（retainpdf_translation/llm/shared/cache.py，默认 90 天）；agent 请求缓存、领域上下文缓存、
GLM-OCR 分片缓存以前什么都没有，只增不减（2026-11-02 整理时查出），用这里的。每个目录每个进程最多清一次，
出错就跳过——这是缓存卫生，不影响正确性。读缓存不会更新修改时间，所以期限按「多久以前写的」算。
"""

from __future__ import annotations

import os
import threading
import time
from pathlib import Path

_DONE: set[str] = set()
_LOCK = threading.Lock()


def ttl_seconds(env_var: str, default_days: float) -> float:
    """环境变量里的天数（写 0 关掉），没写或写错用默认。"""
    raw = str(os.environ.get(env_var, "") or "").strip()
    try:
        days = float(raw) if raw else float(default_days)
    except ValueError:
        days = float(default_days)
    return days * 86400.0


def prune_expired_once(root: Path, *, ttl: float, label: str) -> int:
    """删掉 `root` 下修改时间早于 `ttl` 秒以前的文件（不跟符号链接），返回删了几个。同一目录一个进程只做一次。"""
    key = str(root)
    with _LOCK:
        if key in _DONE:
            return 0
        _DONE.add(key)
    if ttl <= 0:
        return 0
    removed = 0
    try:
        if not root.is_dir():
            return 0
        cutoff = time.time() - ttl
        for path in root.rglob("*"):
            try:
                if path.is_symlink() or not path.is_file():
                    continue
                if path.stat().st_mtime < cutoff:
                    path.unlink()
                    removed += 1
            except OSError:
                continue
    except OSError:
        return removed
    if removed:
        print(f"{label} pruned: {removed} expired entries", flush=True)
    return removed


def _reset_for_tests() -> None:
    with _LOCK:
        _DONE.clear()


__all__ = ["prune_expired_once", "ttl_seconds"]
