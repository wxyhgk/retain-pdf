"""记住用户在提问窗里上次选的思考档位（2026-11-27 用户定「记住上次选的」）。在接线这边（核心只用标准库，原子写要用底座包的
``save_json_atomic``：「临时文件再换名」全仓库只许一份实现）；核心经 ``remember_thinking`` 回调调它。

后端的 ACP 桥起自带 agent 时给 ``RETAIN_ASK_THINKING_FILE``（``<数据目录>/ask/thinking-levels.json``）；文件里按模型连接
（协议、地址、模型名）记一档：``{"version": 1, "levels": {"<连接>": "<档位值>"}}``。没给路径就不记。
从没选过、或者记的那档这个模型已经没有了，按设置里的思考深度（见接线 ``thinking_options``）。
几个 agent 进程同时写，后写的赢（原子写，不会写坏）。读不了、写不了都当没有，不影响提问。
"""
from __future__ import annotations

import json
from pathlib import Path

from retainpdf_base.io import save_json_atomic

MAX_ENTRIES = 200


def connection_key(*, protocol: str, base_url: str, model: str) -> str:
    """模型连接的键：协议、地址（去掉结尾的 /）、模型名。"""
    return "|".join([protocol.strip().lower() or "openai", base_url.strip().rstrip("/"), model.strip()])


def _read(path: Path) -> dict[str, str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    levels = data.get("levels") if isinstance(data, dict) else None
    if not isinstance(levels, dict):
        return {}
    return {str(key): value for key, value in levels.items() if isinstance(value, str)}


def load(path: str, key: str) -> str:
    """记下的档位；没有是空串。"""
    if not path:
        return ""
    return _read(Path(path)).get(key, "")


def save(path: str, key: str, value: str) -> bool:
    """记下这一档；写成了回 True。"""
    if not path:
        return False
    target = Path(path)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        levels = _read(target)
        levels.pop(key, None)
        levels[key] = value
        # 只留最近的（字典按插入顺序，刚写的在最后）
        levels = dict(list(levels.items())[-MAX_ENTRIES:])
        save_json_atomic(target, {"version": 1, "levels": levels}, indent=1, durable=False)
        return True
    except OSError:
        return False


__all__ = ["connection_key", "load", "save"]
