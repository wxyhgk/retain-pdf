import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.layout.font_size_fit import local_font_size_pt
from retainpdf_pipeline.render.layout.payload.annotation_font_policy import recover_underfilled_annotation_density
from retainpdf_pipeline.render.layout.payload.annotation_font_policy import unify_annotation_fonts
from retainpdf_pipeline.render.layout.payload.body_common import payload_density


def test_caption_and_footnote_fonts_use_low_role_anchor() -> None:
    caption_a = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "render_kind": "markdown",
        "font_size_pt": 9.7,
    }
    caption_b = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "render_kind": "markdown",
        "font_size_pt": 8.9,
    }
    footnote_a = {
        "item": {"layout_role": "footnote", "semantic_role": "footnote"},
        "render_kind": "markdown",
        "font_size_pt": 8.7,
    }
    footnote_b = {
        "item": {"layout_role": "footnote", "semantic_role": "footnote"},
        "render_kind": "markdown",
        "font_size_pt": 7.8,
    }

    unify_annotation_fonts([caption_a, caption_b, footnote_a, footnote_b])

    assert caption_a["font_size_pt"] == 8.9
    assert caption_b["font_size_pt"] == 8.9
    assert footnote_a["font_size_pt"] == 7.84
    assert footnote_b["font_size_pt"] == 7.8
    assert footnote_a["font_size_pt"] < caption_a["font_size_pt"]


def test_role_font_unify_ignores_extreme_small_font_outlier() -> None:
    tiny = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "render_kind": "markdown",
        "font_size_pt": 5.2,
    }
    normal_a = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "render_kind": "markdown",
        "font_size_pt": 9.1,
    }
    normal_b = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "render_kind": "markdown",
        "font_size_pt": 9.4,
    }

    unify_annotation_fonts([tiny, normal_a, normal_b])

    assert normal_a["font_size_pt"] >= 9.1
    assert normal_b["font_size_pt"] >= 9.1


def test_caption_and_footnote_density_recovery_uses_same_floor_rule() -> None:
    def make_payload(role: str, height: float) -> dict:
        return {
            "item": {"layout_role": role, "semantic_role": role},
            "inner_bbox": [10.0, 0.0, 220.0, height],
            "translated_text": "注释文字用于测试密度恢复。" * 2,
            "formula_map": [],
            "render_kind": "markdown",
            "font_size_pt": 8.4 if role == "caption" else 7.4,
            "leading_em": 0.46,
        }

    caption_ok = make_payload("caption", 20.0)
    caption_low = make_payload("caption", 48.0)
    footnote_low = make_payload("footnote", 46.0)

    before_caption_ok = (caption_ok["font_size_pt"], caption_ok["leading_em"], payload_density(caption_ok))
    before_caption_low = payload_density(caption_low)
    before_footnote_low = payload_density(footnote_low)

    recover_underfilled_annotation_density([caption_ok, caption_low, footnote_low])

    assert before_caption_ok[2] >= 0.60
    assert (caption_ok["font_size_pt"], caption_ok["leading_em"]) == before_caption_ok[:2]
    assert before_caption_low < 0.60
    assert before_caption_low < payload_density(caption_low) < 1.0
    assert before_footnote_low < 0.60
    assert before_footnote_low < payload_density(footnote_low) < 1.0
    assert caption_low["font_size_pt"] > 8.4
    assert footnote_low["font_size_pt"] > 7.4
    assert footnote_low["font_size_pt"] <= caption_low["font_size_pt"]


def test_caption_and_footnote_recovery_do_not_exceed_body_font_reference() -> None:
    body = {
        "item": {"layout_role": "paragraph", "semantic_role": "body"},
        "inner_bbox": [10.0, 0.0, 220.0, 30.0],
        "translated_text": "正文。",
        "formula_map": [],
        "render_kind": "markdown",
        "font_size_pt": 9.0,
        "leading_em": 0.56,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
    }
    caption = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "inner_bbox": [10.0, 40.0, 220.0, 100.0],
        "translated_text": "图题文字用于测试字号不能超过正文。" * 2,
        "formula_map": [],
        "render_kind": "markdown",
        "font_size_pt": 8.8,
        "leading_em": 0.46,
    }
    footnote = {
        "item": {"layout_role": "footnote", "semantic_role": "footnote"},
        "inner_bbox": [10.0, 110.0, 220.0, 170.0],
        "translated_text": "脚注文字用于测试字号低于正文。" * 2,
        "formula_map": [],
        "render_kind": "markdown",
        "font_size_pt": 8.2,
        "leading_em": 0.44,
    }

    recover_underfilled_annotation_density([body, caption, footnote])

    assert caption["font_size_pt"] <= round(body["font_size_pt"] * 0.88, 2)
    assert footnote["font_size_pt"] <= round(body["font_size_pt"] * 0.82, 2)


def test_caption_seed_font_is_restrained_below_body_scale() -> None:
    item = {
        "layout_role": "caption",
        "semantic_role": "caption",
        "block_kind": "text",
        "source_text": "Figure 1. Caption text",
        "bbox": [10.0, 10.0, 210.0, 24.0],
        "lines": [{"bbox": [10.0, 10.0, 210.0, 24.0], "text": "Figure 1. Caption text"}],
    }

    assert local_font_size_pt(item) <= 10.0
