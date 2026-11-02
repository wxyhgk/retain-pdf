"""排哪段文字只有一套规则（2026-11-02）：以前 render_text 和 render_item 各写一份，已经走样——
一份看有没有反斜杠、一份看 LaTeX 命令，摘要组的修复也只改到其中一份。"""

from __future__ import annotations

from retainpdf_pipeline.render.layout.model import render_text
from retainpdf_pipeline.render.layout.payload import render_item
from retainpdf_pipeline.render.layout.payload.render_item import seed_render_fields


def test_render_item_uses_the_rules_from_render_text() -> None:
    for name in ("render_protected_translation_text", "render_protected_source_text", "should_render_source_block"):
        assert getattr(render_item, name) is getattr(render_text, name), name


def _untranslated(source: str) -> dict:
    return {"item_id": "p001-b001", "block_type": "text", "source_text": source, "protected_source_text": source,
            "translated_text": "", "should_translate": True, "final_status": "", "formula_map": []}


def test_seeded_and_unseeded_paths_agree() -> None:
    for source, renders_source in ((r"共 50\% 的样本", False), (r"能量 $E = \frac{1}{2}$", True), (r"\alpha 粒子", True)):
        item = _untranslated(source)
        assert render_text.should_render_source_block(item) is renders_source, source
        seeded = dict(item)
        seed_render_fields(seeded)
        assert render_text.get_render_protected_text(item) == render_text.get_render_protected_text(seeded), source
