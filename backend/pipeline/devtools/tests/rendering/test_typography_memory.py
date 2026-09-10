import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.layout.typography_memory.features import build_typography_feature
from retainpdf_pipeline.render.layout.payload.block_seed_metrics import collect_page_seed_metrics
from retainpdf_pipeline.render.layout.payload.block_seed_payload_factory import build_seed_payload_for_item
from retainpdf_pipeline.render.layout.payload import block_seed_payload_factory
from retainpdf_pipeline.render.layout.typography_memory.store import TypographyMemory
from retainpdf_pipeline.render.layout.typography_memory.store import TypographyMemoryDecision


def _item() -> dict:
    return {
        "item_id": "p001-b001",
        "block_kind": "text",
        "block_type": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "bbox": [40.0, 80.0, 300.0, 142.0],
        "source_text": "This is a stable body paragraph with enough source words.",
        "protected_source_text": "This is a stable body paragraph with enough source words.",
        "lines": [
            {"bbox": [40.0, 80.0, 300.0, 94.0]},
            {"bbox": [40.0, 98.0, 300.0, 112.0]},
        ],
    }


def test_typography_memory_learns_after_min_observations(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_RENDER_TYPOGRAPHY_MEMORY", "1")
    monkeypatch.setenv("RETAIN_RENDER_TYPOGRAPHY_MEMORY_MIN_OBS", "2")
    memory = TypographyMemory(tmp_path / "typography.sqlite3")
    feature = build_typography_feature(
        item=_item(),
        translated_text="这是一个稳定的正文段落，用于测试字号和行距缓存。",
        font_size_pt=10.5,
        leading_em=0.78,
        page_width=595.0,
        page_height=842.0,
        page_text_width_med=260.0,
        is_body=True,
        dense_small_box=False,
        heavy_dense_small_box=False,
        wide_aspect_body_text=False,
        preserve_line_breaks=False,
    )

    assert feature is not None
    assert memory.lookup(feature.key) is None

    memory.observe(feature_key=feature.key, font_size_pt=10.8, leading_em=0.82)
    assert memory.lookup(feature.key) is None

    memory.observe(feature_key=feature.key, font_size_pt=10.9, leading_em=0.81)
    decision = memory.lookup(feature.key)

    assert decision is not None
    assert decision.observations == 2
    assert 10.8 <= decision.font_size_pt <= 10.9
    assert 0.81 <= decision.leading_em <= 0.82


def test_typography_memory_rejects_unstable_samples(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_RENDER_TYPOGRAPHY_MEMORY", "1")
    monkeypatch.setenv("RETAIN_RENDER_TYPOGRAPHY_MEMORY_MIN_OBS", "3")
    memory = TypographyMemory(tmp_path / "typography.sqlite3")
    feature = build_typography_feature(
        item=_item(),
        translated_text="这是另一个稳定正文段落。",
        font_size_pt=10.5,
        leading_em=0.78,
        page_width=595.0,
        page_height=842.0,
        page_text_width_med=260.0,
        is_body=True,
        dense_small_box=False,
        heavy_dense_small_box=False,
        wide_aspect_body_text=False,
        preserve_line_breaks=False,
    )

    assert feature is not None
    for font_size in (8.0, 12.0, 16.0):
        memory.observe(feature_key=feature.key, font_size_pt=font_size, leading_em=0.8)

    assert memory.lookup(feature.key) is None


def test_typography_memory_hit_still_runs_final_fit(monkeypatch) -> None:
    class _Memory:
        def lookup(self, feature_key: str):
            assert feature_key
            return TypographyMemoryDecision(
                font_size_pt=13.0,
                leading_em=0.9,
                observations=6,
                confidence=0.8,
            )

    calls: list[tuple[float, float]] = []

    def _fake_fit(item, text, formula_map, font_size_pt, leading_em, *, page_body_font_size_pt=None):
        del item, text, formula_map, page_body_font_size_pt
        calls.append((font_size_pt, leading_em))
        return 10.2, 0.58

    monkeypatch.setattr(block_seed_payload_factory, "typography_memory", _Memory())
    monkeypatch.setattr(block_seed_payload_factory, "fit_translated_block_metrics", _fake_fit)

    item = {
        "item_id": "p001-b001",
        "block_kind": "text",
        "block_type": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "bbox": [40.0, 80.0, 330.0, 142.0],
        "source_text": "This is a stable body paragraph with enough source words for metrics.",
        "protected_source_text": "This is a stable body paragraph with enough source words for metrics.",
        "protected_translated_text": "这是一个稳定的正文段落，用于测试缓存命中后仍然经过最终安全拟合。",
        "lines": [
            {"bbox": [40.0, 80.0, 330.0, 94.0]},
            {"bbox": [40.0, 98.0, 330.0, 112.0]},
        ],
    }
    metrics = collect_page_seed_metrics([item], page_width=595.0)

    payload = build_seed_payload_for_item(
        index=0,
        item=item,
        metrics=metrics,
        page_width=595.0,
        page_height=842.0,
    )

    assert calls == [(13.0, 0.9)]
    assert payload is not None
    assert payload["font_size_pt"] == 10.2
    assert payload["leading_em"] == 0.58
    assert payload["_typography_memory_hit"] is True
