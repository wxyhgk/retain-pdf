from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    tmp_path.replace(path)


def relative_to_manifest(manifest_path: Path, path: Path) -> str:
    try:
        return str(Path(path).resolve().relative_to(manifest_path.parent.resolve()))
    except Exception:
        return str(Path(path).resolve())


def resolve_manifest_path(manifest_path: Path, value: object) -> Path | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    path = Path(raw)
    return path if path.is_absolute() else manifest_path.parent / path


def float_or_zero(value: object) -> float:
    try:
        return round(float(value), 3)
    except Exception:
        return 0.0


def float_or_none(value: object) -> float | None:
    try:
        return float(value)
    except Exception:
        return None


def int_or_default(value: object, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return int(default)


def int_list(value: object) -> list[int]:
    if not isinstance(value, list):
        return []
    result: list[int] = []
    for item in value:
        try:
            result.append(int(item))
        except Exception:
            continue
    return result


def float_list(value: object) -> list[float]:
    if not isinstance(value, (list, tuple)):
        return []
    result: list[float] = []
    for item in value:
        parsed = float_or_none(item)
        if parsed is None:
            return []
        result.append(float(parsed))
    return result


def color_tuple(
    value: object,
    *,
    default: tuple[float, float, float],
) -> tuple[float, float, float]:
    parsed = float_list(value)
    if len(parsed) != 3:
        return default
    return (float(parsed[0]), float(parsed[1]), float(parsed[2]))


def rect_tuple_from_value(value: object) -> tuple[float, float, float, float] | None:
    if not isinstance(value, list) or len(value) != 4:
        return None
    rect = tuple(float_or_none(item) for item in value)
    if any(item is None for item in rect):
        return None
    return (float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))  # type: ignore[arg-type]


def bbox_list_from_value(value: object) -> list[float] | None:
    rect = rect_tuple_from_value(value)
    if rect is None:
        return None
    return [float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3])]


__all__ = [
    "bbox_list_from_value",
    "color_tuple",
    "float_list",
    "float_or_none",
    "float_or_zero",
    "int_list",
    "int_or_default",
    "rect_tuple_from_value",
    "relative_to_manifest",
    "resolve_manifest_path",
    "write_json_atomic",
]
