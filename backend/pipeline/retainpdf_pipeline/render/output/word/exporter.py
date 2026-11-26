"""保留排版的 Word 导出：算出排版规格，交给 retainpdf2doc 生成文档。

这边只负责**排版**——页面尺寸、每个块的位置、收敛后的字号和基线间距、背景图。文档
本身（OOXML 打包、绝对定位文本框、原生公式）由 `backend/packages/retainpdf2doc` 这个
Node 包生成。

为什么分成两边:公式。这边曾经用 python-docx 自己写 OMML，转换器带一张 **47 条**的
符号表，不在表里的命令直接剥掉反斜杠当字母印出去。实测全仓 1933 个带命令的公式里
**625 个（32.3%）**中招:`\\mathbf{2a}` 显示成 `mathbf2a`（369 次）、`\\chi` 成 `chi`、
`\\left(` 被 `\\le` 匹配成 `≤ft(`。retainpdf2doc 走的是 MathJax → MathML → OMML，
整个 TeX 解析器都在，没有「表里没有」这回事。

排版规格算不动也不该搬到 Node 去（`build_render_page_specs` 那几千行），所以缝就在
「排版规格 → 文档」这里，规格的形状见 retainpdf2doc/src/spec.mjs。
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import uuid
from pathlib import Path

import fitz

from retainpdf_pipeline.render.output.word.backgrounds import render_page_backgrounds
from retainpdf_pipeline.render.output.word.html_fit import fitted_typography
from retainpdf_pipeline.render.output.word.html_fit import MEASURED_FONT_FAMILY
from retainpdf_pipeline.render.output.word.job_io import single_pdf
from retainpdf_pipeline.render.output.word.job_io import translated_pages
from retainpdf_pipeline.render.output.word.html_fit import (
    LINE_STEP_RATIO,
    clamp_line_step_to_box,
    fits_in_box,
)
from retainpdf_pipeline.render.output.word.typography_readback import converged_typography
from retainpdf_pipeline.render.output.word.typography_readback import open_translated_document
from retainpdf_pipeline.render.output.word.typography_readback import read_page_lines
from retainpdf_pipeline.render.layout.page_specs import build_render_page_specs
from retainpdf_pipeline.render.output.watermark import STAMP_PNG
from retainpdf_pipeline.render.output.watermark import stamp_aspect
from retainpdf_pipeline.render.output.watermark import stamp_rect


SPEC_VERSION = 1
# Word 的默认数学字体。换掉它公式会掉字形，除非目标机器装了替代品。
MATH_FONT_FAMILY = "Cambria Math"

# word/ → output/ → render/ → retainpdf_pipeline/ → pipeline/ → backend/ → 仓库根
_REPO_ROOT = Path(__file__).resolve().parents[6]
_PACKAGE_DIR = _REPO_ROOT / "backend" / "packages" / "retainpdf2doc"
_CLI_ENTRY = _PACKAGE_DIR / "dist" / "cli.mjs"

# 上面那个相对路径只在**仓库检出**里成立。装进桌面应用或 Docker 镜像之后，这个包
# 是从 site-packages 里跑的，往上数六层会数到 python 运行时目录里去，`dist/cli.mjs`
# 当然不存在——v4.2.5 的 Mac 应用就是这么导不出 Word 的。
#
# 所以打包方必须通过这两个环境变量把真实位置告诉我们:
#   RETAINPDF2DOC_CLI  —— dist/cli.mjs 的绝对路径
#   RETAINPDF_NODE_BIN —— node 可执行文件（桌面应用可以指向 Electron 自己，
#                         配合 ELECTRON_RUN_AS_NODE=1）
_CLI_ENV_VAR = "RETAINPDF2DOC_CLI"
_NODE_ENV_VAR = "RETAINPDF_NODE_BIN"


class LayoutDocxToolchainError(RuntimeError):
    """retainpdf2doc 没装好/没构建。单独一个类型，方便上游区分「环境问题」和「数据问题」。"""


def _resolve_node() -> str:
    configured = os.environ.get(_NODE_ENV_VAR, "").strip()
    if configured:
        if not Path(configured).is_file():
            raise LayoutDocxToolchainError(
                f"{_NODE_ENV_VAR} 指向的文件不存在：{configured}",
            )
        return configured
    node = shutil.which("node")
    if not node:
        raise LayoutDocxToolchainError(
            "找不到 node。Word 导出由 retainpdf2doc（Node >= 20）生成。"
            f"打包环境请用 {_NODE_ENV_VAR} 指定 node 可执行文件"
            "（桌面应用可指向 Electron 自身并设 ELECTRON_RUN_AS_NODE=1）。",
        )
    return node


def _resolve_cli() -> Path:
    configured = os.environ.get(_CLI_ENV_VAR, "").strip()
    if configured:
        path = Path(configured)
        if not path.is_file():
            raise LayoutDocxToolchainError(
                f"{_CLI_ENV_VAR} 指向的文件不存在：{configured}",
            )
        return path
    if not _CLI_ENTRY.is_file():
        # 这条信息要能自己说清楚怎么修——排查一个路径问题只能对着
        # "failed to build layout-docx" 猜，那种体验不能再来一次。
        raise LayoutDocxToolchainError(
            f"找不到 retainpdf2doc 的 CLI（试过 {_CLI_ENTRY}）。"
            f"仓库里跑：npm run build --workspace retainpdf2doc；"
            f"打包环境请用 {_CLI_ENV_VAR} 指定 dist/cli.mjs 的位置。",
        )
    return _CLI_ENTRY


def build_layout_spec(
    *,
    job_root: Path,
    dpi: int,
    max_pages: int = 0,
    font_family: str = MEASURED_FONT_FAMILY,
    source_pdf: Path | None = None,
    translated_pdf: Path | None = None,
    watermark: bool = False,
) -> tuple[dict, Path]:
    """算出排版规格，并把背景图渲染到磁盘。返回 (规格, 规格里相对路径的基准目录)。

    `watermark`：每页右下角放「logo + RetainPDF」水印（2026-11-20，下载默认带），位置和 PDF 的水印同一套算法。"""
    # 源 PDF 不一定在 `job_root/source/` 下。translate-only 的任务复用上游 OCR 任务的
    # 产物，它自己的 source/ 是空的。调用方解析好了就直接用。
    source_pdf_path = source_pdf or single_pdf(job_root / "source")
    page_specs = build_render_page_specs(
        source_pdf_path=source_pdf_path, translated_pages=translated_pages(job_root),
    )
    if max_pages > 0:
        page_specs = page_specs[:max_pages]

    rendered_dir = job_root / "rendered" / "docx"
    # 背景图目录带上 DPI：同一个 job 的两次不同清晰度导出可以并发，共用目录的话两边
    # 写的是同一批文件名，先跑的那个会读到后跑的那个覆盖进去的图。
    background_dir = rendered_dir / f"background-pages-{int(dpi)}"
    bg_paths = render_page_backgrounds(source_pdf_path, background_dir, dpi=dpi)

    translated_document = open_translated_document(job_root, translated_pdf)
    pages = []
    try:
        for spec in page_specs:
            rendered_lines = (
                read_page_lines(translated_document, spec.page_index)
                if translated_document is not None else []
            )
            blocks = []
            for block in spec.blocks:
                text = block.plain_text.strip()
                if not text:
                    continue
                # 拿得到译文 PDF 就读回真值（最准）；读不到就走阅读器那套字号收敛。
                # 绝不退回 spec 的上界——实测照上界排有 44.6% 的字符会顶出框外。
                observed = converged_typography(rendered_lines, block.content_rect, len(text))
                if observed:
                    font_size_pt, line_step_pt = observed.font_size_pt, observed.line_step_pt
                if not observed or line_step_pt <= 0:
                    fitted_size, fitted_step = fitted_typography(block)
                    if not observed:
                        font_size_pt = fitted_size
                        line_step_pt = fitted_step
                    else:
                        # **行距要从真正要用的那个字号导出**，不能直接拿 fitted_step。
                        #
                        # 这一支是「读回到字号、但读不到行距」（单行块很常见：一行量不出
                        # 基线间距）。原来直接用 `fitted_step = 1.289 × fitted_size`，而
                        # fitted_size 往往比读回字号小 —— 于是行距比字还矮。
                        #
                        # 实测用户那个 job：39 个 fit_to_box 块里 **11 个（28%）行距 < 字号**，
                        # 全是章节标题（「1. 引言」9.32pt 字配 8.30pt 行距 = 0.89×）。
                        # docx 用 w:lineRule="exact"，行盒比字矮就是**把字顶切掉** ——
                        # 用户截图里那个被切一半的「1. 引言」就是这么来的。
                        line_step_pt = font_size_pt * LINE_STEP_RATIO
                elif not fits_in_box(block, font_size_pt, line_step_pt):
                    # **读回值也要验一遍**。
                    #
                    # 它复现的是 Typst 的排版，而 Word 的断行和 Typst 不一样（两端对齐
                    # 的伸缩、行内 OMML 的宽度、CJK 换行规则）。原来这一支是无条件采信
                    # 的：实测真实 job 的前 6 页，52 个读回成功的块里 **12 个（23%）**
                    # 按我们自己的度量就装不下，而它们照样被原样写进了 docx —— 到 Word
                    # 里就是超框被裁、被下一块的白底盖住。
                    #
                    # 装不下就退回 html_fit 的二分（它按字形宽度找装得下的字号），
                    # 宁可字小一点也别少字。
                    font_size_pt, line_step_pt = fitted_typography(block)
                # **行盒绝不能比字矮，也不能高到一行就塞不进框。**
                #
                # docx 用 w:lineRule="exact"：Word 给每行留满 w:line，块占 n×L；
                # 而我们的 L 是按 PDF 的账（末行只占墨迹）得来的。两头都要夹住 ——
                # 太矮会切字顶，太高会一行就超框（实测 22% 的块合成出来的 L > 框高）。
                line_step_pt = clamp_line_step_to_box(block, font_size_pt, line_step_pt)
                x0, y0, x1, y1 = block.content_rect
                blocks.append({
                    "id": block.block_id,
                    "rect": [x0, y0, x1, y1],
                    "text": block.content_text,
                    "fontSizePt": round(font_size_pt, 3),
                    "lineStepPt": round(line_step_pt, 3),
                    "bold": str(block.font_weight or "").strip().lower() == "bold",
                    "justify": bool(block.justify_text),
                    "firstLineIndentPt": round(block.first_line_indent_pt or 0.0, 3),
                })
            background = bg_paths[spec.page_index] if spec.page_index < len(bg_paths) else None
            page = {
                "pageIndex": spec.page_index,
                "widthPt": spec.page_width_pt,
                "heightPt": spec.page_height_pt,
                "background": (
                    {"path": str(Path(background).relative_to(rendered_dir))}
                    if background else None
                ),
                "blocks": blocks,
            }
            if watermark:
                where = stamp_rect(fitz.Rect(0, 0, spec.page_width_pt, spec.page_height_pt), stamp_aspect())
                page["watermark"] = {"rect": [round(v, 3) for v in (where.x0, where.y0, where.x1, where.y1)]}
            pages.append(page)
    finally:
        if translated_document is not None:
            translated_document.close()

    spec_payload = {
        "version": SPEC_VERSION,
        "job": {"id": job_root.name, "title": source_pdf_path.stem},
        "font": {"family": font_family, "mathFamily": MATH_FONT_FAMILY},
        "pages": pages,
    }
    if watermark:
        spec_payload["watermark"] = {"path": str(STAMP_PNG)}
    return spec_payload, rendered_dir


def export_layout_docx(
    *,
    job_root: Path,
    output_path: Path,
    dpi: int,
    max_pages: int = 0,
    font_family: str = MEASURED_FONT_FAMILY,
    source_pdf: Path | None = None,
    translated_pdf: Path | None = None,
    watermark: bool = False,
) -> Path:
    node = _resolve_node()
    cli = _resolve_cli()
    spec, base_dir = build_layout_spec(
        job_root=job_root,
        dpi=dpi,
        max_pages=max_pages,
        font_family=font_family,
        source_pdf=source_pdf,
        translated_pdf=translated_pdf,
        watermark=watermark,
    )
    # 规格落在背景图旁边:规格里的图片路径是相对这个目录的。一次导出一份、用完删：带水印和不带水印的
    # 两份（同一个 dpi）会同时导出，以前共用 `layout-spec.json`，先跑的那份读到后写的规格（R3）。
    spec_path = base_dir / f"layout-spec-{os.getpid()}-{uuid.uuid4().hex}.json"
    spec_path.write_text(json.dumps(spec, ensure_ascii=False), encoding="utf-8")
    try:
        return _run_document_builder(node, cli, spec_path, output_path)
    finally:
        spec_path.unlink(missing_ok=True)


def _run_document_builder(node: str, cli: Path, spec_path: Path, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    # 桌面应用会把 node 指向 Electron 本体，必须带上这个它才以 Node 模式启动。
    if os.environ.get(_NODE_ENV_VAR, "").strip():
        env.setdefault("ELECTRON_RUN_AS_NODE", "1")
    result = subprocess.run(
        [node, str(cli), str(spec_path), str(output_path)],
        capture_output=True, text=True, timeout=1800, env=env,
    )
    if result.returncode != 0:
        # 把子进程的 stderr 带上。上游只会看到这一条，吞掉它就等于让人对着
        # "failed to build layout-docx" 猜。
        raise RuntimeError(
            f"retainpdf2doc 生成文档失败（退出码 {result.returncode}）：{result.stderr.strip()[-2000:]}",
        )
    if result.stderr.strip():
        # 公式降级之类的警告不影响产出，但要让它可见。
        print(result.stderr.strip())
    return output_path
