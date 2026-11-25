"""rpr_fit：原文两行、译文一行放得下的目录条目排在页码那一行（toc_entries.py，2026-11-25）。"""

import json

from retainpdf_pipeline.render.output.rpr_fit.toc_entries import toc_entry_layout_document


def _entry(block_id, lines):
    return {
        "block_id": block_id, "type": "text", "structure_role": "toc_entry", "text": "Begin each new sentence",
        "bbox": [70, lines[0][1], 360, lines[-1][3]], "geometry": {"bbox": [70, lines[0][1], 360, lines[-1][3]]},
        "metadata": {"toc_entry_source_font_size": 11.0},
        "lines": [{"bbox": list(box), "spans": [{"text": "x", "bbox": list(box)}]} for box in lines],
    }


def _write(tmp_path, blocks):
    path = tmp_path / "document.v1.json"
    path.write_text(json.dumps({"pages": [{"page_index": 0, "blocks": blocks}]}), encoding="utf-8")
    return path


def _items(*texts):
    return {0: [{"item_id": f"p001-b{index:03d}", "structure_role": "toc_entry", "translated_text": text}
                for index, text in enumerate(texts)]}


def test_short_translation_moves_to_the_last_line(tmp_path):
    path = _write(tmp_path, [_entry("p001-b0000", [[70, 100, 360, 112], [70, 114, 300, 126]])])
    out, changed = toc_entry_layout_document(path, _items("每个新句子都要衔接"), tmp_path)
    assert changed == 1 and out != path
    block = json.loads(out.read_text(encoding="utf-8"))["pages"][0]["blocks"][0]
    assert block["bbox"] == [70, 114, 300, 126] and block["geometry"]["bbox"] == [70, 114, 300, 126]
    assert len(block["lines"]) == 1
    # 原文档不动（擦原文、阅读页都按整条）
    assert json.loads(path.read_text(encoding="utf-8"))["pages"][0]["blocks"][0]["bbox"][1] == 100


def test_long_translation_and_single_line_entries_are_left_alone(tmp_path):
    path = _write(tmp_path, [
        _entry("p001-b0000", [[70, 100, 360, 112], [70, 114, 160, 126]]),
        _entry("p001-b0001", [[70, 130, 360, 142]]),
    ])
    out, changed = toc_entry_layout_document(path, _items("这是一条很长很长很长很长很长的译文标题", "短"), tmp_path)
    assert (out, changed) == (path, 0)
