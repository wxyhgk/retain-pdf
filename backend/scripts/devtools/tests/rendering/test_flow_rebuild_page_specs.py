from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.document.page_map import RenderPageMap
from services.rendering.layout.model.models import RenderLayoutBlock
from services.rendering.layout.model.models import RenderPageSpec
from services.rendering.layout.page_specs import _split_text_by_budgets
from services.rendering.layout.page_specs import _flow_text_tokens
from services.rendering.layout.page_specs import expand_page_specs_for_flow_rebuild
from services.rendering.output.typst.emitter import build_typst_source_from_page_specs


def _overfull_page_spec(text: str | None = None) -> RenderPageSpec:
    long_text = text or (
        "This translated paragraph is intentionally long and cannot fit in the original narrow box. "
        * 18
    )
    return RenderPageSpec(
        page_index=0,
        page_width_pt=200.0,
        page_height_pt=300.0,
        background_pdf_path=None,
        blocks=[
            RenderLayoutBlock(
                block_id="p001-b001",
                page_index=0,
                background_rect=[20.0, 30.0, 90.0, 48.0],
                content_rect=[22.0, 32.0, 88.0, 46.0],
                content_kind="markdown",
                content_text=long_text,
                plain_text=long_text,
                math_map=[],
                font_size_pt=10.0,
                leading_em=0.4,
            )
        ],
    )


def test_flow_rebuild_expands_overfull_page_with_blank_continuation(tmp_path: Path) -> None:
    page_specs = expand_page_specs_for_flow_rebuild(
        [_overfull_page_spec()],
        flow_rebuild_page_indices=frozenset({0}),
    )

    assert len(page_specs) > 1
    assert page_specs[0].is_flow_continuation is False
    assert page_specs[1].is_flow_continuation is True
    assert page_specs[1].source_page_index == 0
    assert page_specs[1].background_page_index == -1
    assert RenderPageMap.from_page_specs(page_specs).source_page_indices == [0] * len(page_specs)

    source = build_typst_source_from_page_specs(
        background_pdf_path=tmp_path / "background.pdf",
        page_specs=page_specs,
        work_dir=tmp_path,
    )

    assert source.count('image("background.pdf"') == 1
    assert "flow_rebuild_continuation" not in source


def test_flow_rebuild_splits_inline_math_text_without_breaking_formula() -> None:
    math_text = (
        "The stopping sight distance is computed as $S = 0.278 Vt + V^2/(254f)$ and must remain atomic. "
        * 10
    )

    page_specs = expand_page_specs_for_flow_rebuild(
        [_overfull_page_spec(math_text)],
        flow_rebuild_page_indices=frozenset({0}),
    )

    assert len(page_specs) > 1
    flowed_text = " ".join(block.content_text for spec in page_specs for block in spec.blocks)
    assert "$S = 0.278 Vt + V^2/(254f)$" in flowed_text
    assert "254f)$" in flowed_text
    assert not any(block.content_text.strip().startswith("$") for spec in page_specs for block in spec.blocks)


def test_flow_rebuild_splits_typst_formula_fragment_text_without_fragment_pages() -> None:
    math_text = (
        "The calculated transition length is 127.5\\ \\mathrm{m}$, and the formula line must not be sliced. "
        * 10
    )

    page_specs = expand_page_specs_for_flow_rebuild(
        [_overfull_page_spec(math_text)],
        flow_rebuild_page_indices=frozenset({0}),
    )

    assert len(page_specs) > 1
    continuation_blocks = [block for spec in page_specs[1:] for block in spec.blocks]
    assert continuation_blocks
    assert not any(block.content_text.strip().startswith("\\mathrm") for block in continuation_blocks)
    assert not any(block.content_text.strip() in {"$", ")"} for block in continuation_blocks)


def test_flow_text_tokens_keep_latex_command_atomic() -> None:
    tokens = _flow_text_tokens("Lc = 127.5\\ \\mathrm{m}$, and more text")

    assert any(token.atomic and "\\mathrm{m}$" in token.text for token in tokens)


def test_flow_split_merges_low_content_tail() -> None:
    text = ("A long ordinary sentence with enough words to make a normal first chunk. " * 6) + "tiny tail"

    chunks = _split_text_by_budgets(
        text,
        first_budget=180,
        continuation_budget=180,
        max_continuation_pages=4,
    )

    assert len(chunks) >= 1
    assert len(chunks[-1]) >= 80
    assert "tiny tail" in chunks[-1]


def test_flow_rebuild_merges_short_formula_lines_with_context() -> None:
    blocks = [
        RenderLayoutBlock(
            block_id="p002-b016",
            page_index=1,
            background_rect=[70.0, 376.5, 289.5, 414.0],
            content_rect=[70.0, 376.5, 289.5, 414.0],
            content_kind="markdown",
            content_text="根据IRC SP 99 2013第2.8条，若年降雨量大于1000mm，则横坡应为2.5%，否则为2.0%",
            plain_text="根据IRC SP 99 2013第2.8条，若年降雨量大于1000mm，则横坡应为2.5%，否则为2.0%",
            math_map=[],
            font_size_pt=11.42,
            leading_em=0.52,
            justify_text=True,
        ),
        RenderLayoutBlock(
            block_id="p002-b017",
            page_index=1,
            background_rect=[69.5, 416.0, 290.5, 428.5],
            content_rect=[69.5, 416.0, 290.5, 428.5],
            content_kind="markdown",
            content_text="对于路拱2.0%，R=[{150}^2/(225*0.02)]=5000m",
            plain_text="对于路拱2.0%，R=[{150}^2/(225*0.02)]=5000m",
            math_map=[],
            font_size_pt=9.95,
            leading_em=0.48,
            fit_to_box=True,
            justify_text=True,
            skip_reason="adjacent_collision_risk",
        ),
        RenderLayoutBlock(
            block_id="p002-b018",
            page_index=1,
            background_rect=[69.5, 429.5, 291.0, 442.0],
            content_rect=[69.5, 429.5, 291.0, 442.0],
            content_kind="markdown",
            content_text=r"对于2.5%的路拱，$R=[150^2/(225 \times 0.02)]=4000\ \text{m}$",
            plain_text=r"对于2.5%的路拱，$R=[150^2/(225 \times 0.02)]=4000\ \text{m}$",
            math_map=[],
            font_size_pt=10.2,
            leading_em=0.52,
            fit_to_box=True,
            justify_text=True,
        ),
    ]

    page_specs = expand_page_specs_for_flow_rebuild(
        [
            RenderPageSpec(
                page_index=1,
                page_width_pt=1224.0,
                page_height_pt=792.0,
                background_pdf_path=None,
                blocks=blocks,
            )
        ],
        flow_rebuild_page_indices=frozenset({1}),
    )

    assert len(page_specs) == 1
    assert len(page_specs[0].blocks) == 1
    group = page_specs[0].blocks[0]
    assert group.skip_reason == "flow_rebuild_short_line_group"
    assert group.content_rect == [69.5, 376.5, 291.0, 442.0]
    assert group.font_size_pt == 9.95
    assert group.leading_em == 0.48
    assert group.fit_to_box is False
    assert group.justify_text is False
    assert "对于路拱2.0%" in group.content_text
    assert "对于2.5%" in group.content_text
    assert "  \n" in group.content_text
    assert group.content_text.count("\n") == 2


def test_flow_rebuild_extends_overfull_formula_group_into_following_gap() -> None:
    blocks = [
        RenderLayoutBlock(
            block_id="p002-b016",
            page_index=1,
            background_rect=[69.5, 376.5, 290.0, 414.0],
            content_rect=[69.5, 376.5, 290.0, 414.0],
            content_kind="markdown",
            content_text="根据IRC SP 99 2013第2.8条，若年降雨量大于1000mm，则横坡应为2.5%，否则为2.0%",
            plain_text="根据IRC SP 99 2013第2.8条，若年降雨量大于1000mm，则横坡应为2.5%，否则为2.0%",
            math_map=[],
            font_size_pt=11.04,
            leading_em=0.42,
            justify_text=True,
        ),
        RenderLayoutBlock(
            block_id="p002-b017",
            page_index=1,
            background_rect=[69.5, 416.5, 290.5, 428.5],
            content_rect=[69.5, 416.5, 290.5, 428.5],
            content_kind="markdown",
            content_text="对于路拱2.0%，R=[{150}^2/(225*0.02)]=5000m",
            plain_text="对于路拱2.0%，R=[{150}^2/(225*0.02)]=5000m",
            math_map=[],
            font_size_pt=11.04,
            leading_em=0.42,
            fit_to_box=True,
            justify_text=True,
            skip_reason="adjacent_collision_risk",
        ),
        RenderLayoutBlock(
            block_id="p002-b018",
            page_index=1,
            background_rect=[69.5, 429.5, 291.0, 442.0],
            content_rect=[69.5, 429.5, 291.0, 442.0],
            content_kind="markdown",
            content_text=r"对于2.5%的路拱，$R=[150^2/(225 \times 0.02)]=4000\ \text{m}$",
            plain_text=r"对于2.5%的路拱，$R=[150^2/(225 \times 0.02)]=4000\ \text{m}$",
            math_map=[],
            font_size_pt=11.04,
            leading_em=0.42,
            fit_to_box=True,
            justify_text=True,
        ),
        RenderLayoutBlock(
            block_id="p002-b019",
            page_index=1,
            background_rect=[78.0, 456.5, 279.5, 481.0],
            content_rect=[78.0, 456.5, 279.5, 481.0],
            content_kind="markdown",
            content_text="不需要设置超高时的最小半径为 5000 m（v）",
            plain_text="不需要设置超高时的最小半径为 5000 m（v）",
            math_map=[],
            font_size_pt=11.04,
            leading_em=0.42,
            justify_text=True,
        ),
    ]

    page_specs = expand_page_specs_for_flow_rebuild(
        [
            RenderPageSpec(
                page_index=1,
                page_width_pt=1224.0,
                page_height_pt=792.0,
                background_pdf_path=None,
                blocks=blocks,
            )
        ],
        flow_rebuild_page_indices=frozenset({1}),
    )

    assert len(page_specs[0].blocks) == 1
    group = page_specs[0].blocks[0]
    assert group.content_rect[3] == 481.0
    assert "不需要设置超高" in group.content_text
    assert 9.0 <= group.font_size_pt <= 11.04
    assert group.fit_to_box is False
    assert group.justify_text is False


def test_flow_rebuild_stabilizes_single_short_formula_line() -> None:
    text = "对于路拱2.0%，R=[{150}^2/(225*0.02)]=5000m"
    page_specs = expand_page_specs_for_flow_rebuild(
        [
            RenderPageSpec(
                page_index=1,
                page_width_pt=1224.0,
                page_height_pt=792.0,
                background_pdf_path=None,
                blocks=[
                    RenderLayoutBlock(
                        block_id="p002-b017",
                        page_index=1,
                        background_rect=[69.5, 416.0, 290.5, 428.5],
                        content_rect=[69.5, 416.0, 290.5, 428.5],
                        content_kind="markdown",
                        content_text=text,
                        plain_text=text,
                        math_map=[],
                        font_size_pt=9.95,
                        leading_em=0.48,
                        fit_to_box=True,
                        justify_text=True,
                    )
                ],
            )
        ],
        flow_rebuild_page_indices=frozenset({1}),
    )

    block = page_specs[0].blocks[0]
    assert block.skip_reason == "flow_rebuild_short_line"
    assert block.fit_to_box is False
    assert block.justify_text is False


def test_flow_rebuild_preserves_list_boundary_and_reclaims_visual_gap() -> None:
    previous = RenderLayoutBlock(
        block_id="p003-b014",
        page_index=2,
        background_rect=[70.0, 60.0, 290.0, 95.0],
        content_rect=[70.0, 60.0, 290.0, 95.0],
        content_kind="markdown",
        content_text="(a) 竖曲线最小长度、(b) 用于 SSD 的竖曲线长度 和 (c) 用于 ISD 的竖曲线长度",
        plain_text="(a) 竖曲线最小长度、(b) 用于 SSD 的竖曲线长度 和 (c) 用于 ISD 的竖曲线长度",
        math_map=[],
        font_size_pt=10.0,
        leading_em=0.2,
    )
    item_a = RenderLayoutBlock(
        block_id="p003-b015",
        page_index=2,
        background_rect=[70.0, 100.0, 290.0, 136.0],
        content_rect=[70.0, 100.0, 290.0, 136.0],
        content_kind="markdown",
        content_text="(a) 根据 IRC:SP:99，竖曲线的最小长度等于设计速度的 0.85 倍 $Lc = 0.85 \\times 150 = 127.5 \\sim 130m$ (x)",
        plain_text="(a) 根据 IRC:SP:99，竖曲线的最小长度等于设计速度的 0.85 倍 $Lc = 0.85 \\times 150 = 127.5 \\sim 130m$ (x)",
        math_map=[],
        font_size_pt=10.0,
        leading_em=0.2,
        fit_to_box=True,
        justify_text=True,
    )
    item_b = RenderLayoutBlock(
        block_id="p003-b016",
        page_index=2,
        background_rect=[70.0, 138.0, 290.0, 150.0],
        content_rect=[70.0, 138.0, 290.0, 150.0],
        content_kind="markdown",
        content_text="(b) 停车视距对应的竖曲线长度，其中 $S = 360\\,\\mathrm{m}$",
        plain_text="(b) 停车视距对应的竖曲线长度，其中 $S = 360\\,\\mathrm{m}$",
        math_map=[],
        font_size_pt=10.0,
        leading_em=0.2,
        fit_to_box=True,
        justify_text=True,
    )

    page_specs = expand_page_specs_for_flow_rebuild(
        [
            RenderPageSpec(
                page_index=2,
                page_width_pt=1224.0,
                page_height_pt=792.0,
                background_pdf_path=None,
                blocks=[previous, item_a, item_b],
            )
        ],
        flow_rebuild_page_indices=frozenset({2}),
    )

    assert len(page_specs[0].blocks) == 2
    group = page_specs[0].blocks[1]
    assert group.skip_reason == "flow_rebuild_short_line_group"
    assert group.content_rect[1] < 100.0
    assert "  \n(b) 停车视距" in group.content_text
    assert group.fit_to_box is False
    assert group.justify_text is False


def test_flow_rebuild_does_not_reclaim_from_previous_flow_group() -> None:
    blocks = [
        RenderLayoutBlock(
            block_id="a",
            page_index=0,
            background_rect=[70.0, 100.0, 290.0, 125.0],
            content_rect=[70.0, 100.0, 290.0, 125.0],
            content_kind="markdown",
            content_text="第一组 $A=1$",
            plain_text="第一组 $A=1$",
            math_map=[],
            font_size_pt=10.0,
            leading_em=0.35,
            justify_text=True,
        ),
        RenderLayoutBlock(
            block_id="b",
            page_index=0,
            background_rect=[70.0, 126.0, 290.0, 138.0],
            content_rect=[70.0, 126.0, 290.0, 138.0],
            content_kind="markdown",
            content_text="公式 $B=2$",
            plain_text="公式 $B=2$",
            math_map=[],
            font_size_pt=10.0,
            leading_em=0.35,
            fit_to_box=True,
            justify_text=True,
        ),
        RenderLayoutBlock(
            block_id="c",
            page_index=0,
            background_rect=[70.0, 145.0, 290.0, 170.0],
            content_rect=[70.0, 145.0, 290.0, 170.0],
            content_kind="markdown",
            content_text="第二组 $C=3$",
            plain_text="第二组 $C=3$",
            math_map=[],
            font_size_pt=10.0,
            leading_em=0.35,
            justify_text=True,
        ),
        RenderLayoutBlock(
            block_id="d",
            page_index=0,
            background_rect=[70.0, 171.0, 290.0, 183.0],
            content_rect=[70.0, 171.0, 290.0, 183.0],
            content_kind="markdown",
            content_text="公式 $D=4$",
            plain_text="公式 $D=4$",
            math_map=[],
            font_size_pt=10.0,
            leading_em=0.35,
            fit_to_box=True,
            justify_text=True,
        ),
    ]

    page_specs = expand_page_specs_for_flow_rebuild(
        [
            RenderPageSpec(
                page_index=0,
                page_width_pt=600.0,
                page_height_pt=800.0,
                background_pdf_path=None,
                blocks=blocks,
            )
        ],
        flow_rebuild_page_indices=frozenset({0}),
    )

    groups = [block for block in page_specs[0].blocks if block.skip_reason == "flow_rebuild_short_line_group"]
    assert len(groups) == 2
    assert groups[1].content_rect[1] == 145.0


def test_flow_rebuild_first_chunk_disables_fixed_fit() -> None:
    page = _overfull_page_spec()
    page.blocks[0].fit_to_box = True
    page.blocks[0].justify_text = True

    page_specs = expand_page_specs_for_flow_rebuild(
        [page],
        flow_rebuild_page_indices=frozenset({0}),
    )

    assert len(page_specs) > 1
    first_block = page_specs[0].blocks[0]
    assert first_block.skip_reason == "flow_rebuild_first_chunk"
    assert first_block.fit_to_box is False
    assert first_block.justify_text is False
