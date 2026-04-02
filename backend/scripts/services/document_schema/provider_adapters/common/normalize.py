from __future__ import annotations


def normalize_bbox(value: object) -> list[float]:
    if not isinstance(value, list) or len(value) != 4:
        return [0, 0, 0, 0]
    return [float(item or 0) for item in value]


def normalize_polygon(value: object) -> list[list[float]]:
    if not isinstance(value, list):
        return []
    out: list[list[float]] = []
    for item in value:
        if isinstance(item, list) and len(item) == 2:
            out.append([float(item[0] or 0), float(item[1] or 0)])
    return out


def build_text_segments(text: str, *, raw_type: str, segment_type: str = "text") -> list[dict]:
    if not text:
        return []
    return [
        {
            "type": segment_type,
            "raw_type": raw_type,
            "text": text,
            "bbox": [0, 0, 0, 0],
            "score": None,
        }
    ]


def build_line_records(bbox: list[float], segments: list[dict]) -> list[dict]:
    if not segments:
        return []
    return [
        {
            "bbox": bbox,
            "spans": segments,
        }
    ]
