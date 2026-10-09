"""各排版路线需要哪些渲染准备（路线声明）。

- typst / rpr：字号、缩字、背景规格由 retain-pdf 决定，要完整的版式 payload（⑤：几何、
  配色清单、背景规格、预备好的叠加条目），由 prewarm 写进 render_prewarm manifest。
- rpr_fit：字号由引擎按测量决定，只要渲染源（去文字层的底图）、底色 / 字色（visual_profile）
  和障碍物扫描；不构建、也不写 ⑤。写出的 manifest 缺背景规格，换回 Typst 时可能被当成
  「已算好」，所以精简路线只读不写 manifest（现有的完整 manifest 是超集，照用）。

rpr_fit 失败回退 Typst 时，Typst 自己补算 ⑤（与 no_cache 时同一条路）。
"""

from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.foundation.shared.stage_specs import RENDER_ENGINE_RPR_FIT


@dataclass(frozen=True)
class RoutePrepareNeeds:
    payload_layout: bool  # ⑤ 版式 payload / 配色清单 / 背景规格
    visual_profile: bool  # 底色 / 字色
    obstacle_scan: bool  # 原 PDF 的障碍物（引擎碰撞兜底）


FULL_PREPARE = RoutePrepareNeeds(payload_layout=True, visual_profile=True, obstacle_scan=False)
_ROUTE_NEEDS = {
    RENDER_ENGINE_RPR_FIT: RoutePrepareNeeds(payload_layout=False, visual_profile=True, obstacle_scan=True),
}


def route_prepare_needs(render_engine: str | None) -> RoutePrepareNeeds:
    """未声明的路线（typst、rpr、未知值）按完整准备处理。"""
    return _ROUTE_NEEDS.get(str(render_engine or "").strip(), FULL_PREPARE)


__all__ = ["FULL_PREPARE", "RoutePrepareNeeds", "route_prepare_needs"]
