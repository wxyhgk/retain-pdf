"""排版 fit 报告的 Typst 探针。

正式渲染的 .typ 在 Typst 内部二分缩字，选定的字号不会回传给 Python。这里另外生成一份
「探针」源码：块的嵌套结构、尺寸、字体、缩字算法都和正式源码一致（同一个
build_typst_block，只多传 fit_probe_id），区别只有三点——

- 缩字 helper 换成 probe 版本，选定字号后多输出一条 metadata；
- 固定字号的块追加一段度量（按块宽自然排版需要多高）；
- 不放背景图（背景不参与文字排版，省掉 PDF 图片解析）。

然后用 ``typst eval --in`` 查询这些 metadata。正式渲染的源码和 PDF 完全不受影响。
"""

from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass
from dataclasses import field
from pathlib import Path

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.foundation.config.external_tools import resolve_typst_bin
from retainpdf_pipeline.render.layout.model.models import RenderBlock
from retainpdf_pipeline.render.output.typst import block_config as typst_config
from retainpdf_pipeline.render.output.typst.block_renderer import build_typst_block
from retainpdf_pipeline.render.output.typst.compiler import _resolved_font_paths
from retainpdf_pipeline.render.output.typst.fit_helpers import FIT_PROBE_LABEL
from retainpdf_pipeline.render.output.typst.fit_helpers import page_spec_fit_helpers
from retainpdf_pipeline.render.output.typst.fit_helpers import render_block_fit_helpers

FIT_PROBE_HELPERS_PAGE_SPEC = "page_spec"
FIT_PROBE_HELPERS_RENDER_BLOCK = "render_block"
FIT_PROBE_TIMEOUT_SECONDS = 300.0
FIT_PROBE_STEM = "fit-probe"


@dataclass(frozen=True)
class FitProbeBlock:
    key: str
    page_index: int
    item_id: str
    block: RenderBlock


@dataclass
class FitProbePage:
    page_index: int
    page_width_pt: float
    page_height_pt: float
    # (Typst 源码里的块 id, 块)；块 id 与正式源码同名，便于对照排查
    blocks: list[tuple[str, RenderBlock]] = field(default_factory=list)


@dataclass(frozen=True)
class FitProbeResult:
    blocks: list[FitProbeBlock]
    records: dict[str, list[dict]]
    elapsed_seconds: float
    typ_path: Path


class FitProbeError(RuntimeError):
    pass


def render_block_item_id(block: RenderBlock) -> str:
    if str(block.source_item_id or "").strip():
        return str(block.source_item_id)
    block_id = str(block.block_id or "")
    return block_id[len("item-"):] if block_id.startswith("item-") else block_id


def build_fit_probe_source(
    pages: list[FitProbePage],
    *,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    helpers: str = FIT_PROBE_HELPERS_PAGE_SPEC,
    include_fill: bool = True,
) -> tuple[str, list[FitProbeBlock]]:
    lines = [f'#set text(font: "{font_family}", size: {fonts.DEFAULT_FONT_SIZE}pt)']
    lines.extend(typst_config.typst_package_imports())
    if helpers == FIT_PROBE_HELPERS_RENDER_BLOCK:
        lines.extend(render_block_fit_helpers(probe=True))
    else:
        lines.extend(page_spec_fit_helpers(probe=True))
    probe_blocks: list[FitProbeBlock] = []
    for page_offset, page in enumerate(pages):
        lines.append(
            f"#set page(width: {page.page_width_pt}pt, height: {page.page_height_pt}pt, margin: 0pt, fill: none)"
        )
        for source_block_id, block in page.blocks:
            key = f"k{len(probe_blocks)}"
            probe_blocks.append(
                FitProbeBlock(
                    key=key,
                    page_index=page.page_index,
                    item_id=render_block_item_id(block),
                    block=block,
                )
            )
            lines.append(build_typst_block(source_block_id, block, include_fill=include_fill, fit_probe_id=key))
        if page_offset + 1 < len(pages):
            lines.append("#pagebreak()")
    return "\n".join(lines) + "\n", probe_blocks


def _typst_world_args(work_dir: Path, font_paths: list[Path] | None) -> list[str]:
    # 和正式编译用同一套字体目录，否则度量出来的字号就不是正式渲染的字号。
    args = ["--root", str(work_dir)]
    for font_path in _resolved_font_paths(font_paths):
        args.extend(["--font-path", str(font_path)])
    return args


def _run_typst_probe_query(typ_path: Path, *, work_dir: Path, font_paths: list[Path] | None, timeout: float) -> list:
    typst_bin = resolve_typst_bin()
    world_args = _typst_world_args(work_dir, font_paths)
    selector = f"<{FIT_PROBE_LABEL}>"
    commands = [
        # typst >= 0.14：query 子命令已弃用，改用 eval --in。
        [typst_bin, "eval", "--in", str(typ_path), *world_args, f"query({selector}).map(it => it.value)"],
        # 老版本没有 eval，退回 query。
        [typst_bin, "query", *world_args, str(typ_path), selector, "--field", "value"],
    ]
    errors: list[str] = []
    for command in commands:
        try:
            proc = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            raise FitProbeError(f"typst fit probe timed out after {timeout:.0f}s") from exc
        if proc.returncode == 0:
            try:
                payload = json.loads(proc.stdout or "[]")
            except json.JSONDecodeError as exc:
                raise FitProbeError(f"typst fit probe returned non-JSON output: {exc}") from exc
            if not isinstance(payload, list):
                raise FitProbeError("typst fit probe returned non-list payload")
            return payload
        errors.append((proc.stderr or proc.stdout or "").strip()[:2000])
    raise FitProbeError("typst fit probe failed: " + " | ".join(errors))


def run_fit_probe(
    pages: list[FitProbePage],
    *,
    work_dir: Path,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    helpers: str = FIT_PROBE_HELPERS_PAGE_SPEC,
    include_fill: bool = True,
    timeout: float = FIT_PROBE_TIMEOUT_SECONDS,
) -> FitProbeResult:
    started = time.perf_counter()
    work_dir.mkdir(parents=True, exist_ok=True)
    source, probe_blocks = build_fit_probe_source(
        pages,
        font_family=font_family,
        helpers=helpers,
        include_fill=include_fill,
    )
    typ_path = work_dir / f"{FIT_PROBE_STEM}.typ"
    typ_path.write_text(source, encoding="utf-8")
    raw_records = _run_typst_probe_query(typ_path, work_dir=work_dir, font_paths=font_paths, timeout=timeout)
    records: dict[str, list[dict]] = {}
    for record in raw_records:
        if not isinstance(record, dict):
            continue
        fit_id = str(record.get("id") or "")
        # 逐行拟合的块 id 形如 k12/l3，归到 k12 名下
        key = fit_id.split("/", 1)[0]
        if key:
            records.setdefault(key, []).append(record)
    return FitProbeResult(
        blocks=probe_blocks,
        records=records,
        elapsed_seconds=time.perf_counter() - started,
        typ_path=typ_path,
    )


__all__ = [
    "FIT_PROBE_HELPERS_PAGE_SPEC",
    "FIT_PROBE_HELPERS_RENDER_BLOCK",
    "FitProbeBlock",
    "FitProbeError",
    "FitProbePage",
    "FitProbeResult",
    "build_fit_probe_source",
    "render_block_item_id",
    "run_fit_probe",
]
