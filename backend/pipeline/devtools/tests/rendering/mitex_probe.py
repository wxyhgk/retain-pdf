"""把一段 LaTeX 真的交给 Typst 编译一次，供登记表的闸门使用。

字符串断言在这里没有意义：无论 mitex 吐什么，字符串都「正确」。当年 mitex 0.2.6
吐旧版 Typst 的符号名（`\\hbar` → `planck.reduce`），报的是 `unknown variable`，
看上去像「mitex 不认识这个命令」，实际是「它认识，但翻出来的名字不存在了」。两者
修法完全相反，而只有真的编译一次才分得清。

三个探针对应登记表的三列语义：

- compile_native —— 裸 `$...$` 交给 cmarker+mitex，不经我们的清洗器
- compile_pipeline —— 走完整生产链路，清洗器在内
- png_digest —— 渲染成 PNG 取哈希，用来判定两种拼法是不是**逐像素**相同

最后一个是 `equivalent_to` 能成为可测断言的原因。曾经有人（包括写这段注释的）
凭直觉把 `\\pmb` 折叠进 `\\mathbf`，像素一比就知道是两个东西。
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.render.layout.inline_content import (  # noqa: E402
    build_direct_typst_passthrough_markdown,
)
from retainpdf_pipeline.render.output.typst.block_config import (  # noqa: E402
    typst_package_imports,
)

TYPST_BIN = os.environ.get("TYPST_BIN", "").strip() or shutil.which("typst")


def _typst_string_literal(text: str) -> str:
    # Typst 字符串只认双引号，且要转义反斜杠——用 Python 的 repr 会得到单引号，
    # 编译期直接报 "the character ' is not valid in code"。
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _document(markdown: str) -> str:
    return "\n".join([
        *typst_package_imports(),
        "#set page(width: auto, height: auto, margin: 2pt)",
        f"#let md = {_typst_string_literal(markdown)}",
        "#cmarker.render(md, math: mitex)",
        "",
    ])


def _compile(markdown: str, *, png: bool = False) -> tuple[bool, str, bytes]:
    with tempfile.TemporaryDirectory() as tmp:
        typ_path = Path(tmp) / "probe.typ"
        typ_path.write_text(_document(markdown), encoding="utf-8")
        out_path = Path(tmp) / ("probe.png" if png else "probe.pdf")
        command = [TYPST_BIN, "compile", str(typ_path), str(out_path)]
        if png:
            command += ["--format", "png", "--ppi", "144"]
        proc = subprocess.run(command, capture_output=True, text=True, timeout=120)
        message = (proc.stderr or proc.stdout or "").strip()
        if proc.returncode != 0:
            return False, message, b""
        return True, message, out_path.read_bytes()


def compile_pipeline(latex: str) -> tuple[bool, str]:
    """走完整生产链路——决定页面崩不崩的就是这一条。"""
    ok, message, _ = _compile(build_direct_typst_passthrough_markdown(f"${latex}$"))
    return ok, message


def compile_pipeline_together(latexes: list[str]) -> bool:
    """一批公式放进同一个文档走完整链路编译一次，全过才算过。用来省掉逐个起 Typst 的开销：
    整批失败时调用方再逐个编译，报出是哪一个坏了。"""
    markdown = "\n\n".join(build_direct_typst_passthrough_markdown(f"${latex}$") for latex in latexes)
    ok, _, _ = _compile(markdown)
    return ok


def compile_native(latex: str) -> tuple[bool, str]:
    """跳过我们的清洗器，看 mitex 原生支不支持。

    和 compile_pipeline 的差值就是清洗规则的实际负重：`\\circled` 原生失败、
    走链路成功，说明那条清洗规则还在干活，不能当死代码删掉。
    """
    ok, message, _ = _compile(f"${latex}$")
    return ok, message


def compile_markdown_pdf(markdown: str) -> tuple[bool, str, bytes]:
    """把已经清洗好的 markdown 编译成 PDF，返回 (成功?, 报错, PDF 字节)。

    「编译通过」不等于「渲染正确」：mitex 在文本组里把 `\\AA` 翻成 `circle(A)`
    照样编译成功，只有抽出 PDF 文本才看得见那串残字。
    """
    return _compile(markdown)


def png_digest(latex: str) -> str | None:
    """渲染成 PNG 的哈希；编译失败返回 None。"""
    ok, _, payload = _compile(build_direct_typst_passthrough_markdown(f"${latex}$"), png=True)
    return hashlib.sha256(payload).hexdigest() if ok else None


__all__ = ["TYPST_BIN", "compile_markdown_pdf", "compile_native", "compile_pipeline", "png_digest"]
