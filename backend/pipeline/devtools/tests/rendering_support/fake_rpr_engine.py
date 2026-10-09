"""测试用的假 rpr 引擎：目录结构与 backend/rendering-engine 相同，CLI 契约与真引擎相同。

- ``<root>/engine/bin/rpr-fit.js``：同样是 Python 脚本，读 rpr_fit_input_v1（*_path 相对输入
  文件），每个要渲染的页一张透明页，报告 rpr_fit_report_v1（译文含 SHRINK 的缩到 9.5、含
  OVERFLOW 的报溢出）；
- ``<root>/engine/bin/rpr-retain.js``：其实是 Python 脚本，读 rpr_retain_input_v1，写出
  overlay.pdf（每页一张透明页，按 cover_box 画底色、在 content_box 左上角写一个标记）和
  rpr_retain_report_v1；
- ``<root>/fake-node``：假的 node，``-p process.versions.node`` 回版本号，其余参数原样交给
  上面那个 Python 脚本执行；
- 环境变量控制行为：``FAKE_RPR_EXIT``（非 0 退出并在 stderr 写 ``{"error": ...}``）、
  ``FAKE_RPR_PAGES_DELTA``（叠加层少/多几页）。文本里含 ``OVERFLOW`` 的块报溢出，含
  ``SHRINK`` 的缩到 fit 下限。

真引擎就绪之前，Python 侧的输入组装、子进程调用、报告转换、合并、回退全靠它测。
"""

from __future__ import annotations

import json
import stat
import sys
from pathlib import Path

FAKE_ENGINE_VERSION = "0.1.0-fake"

_FAKE_CLI = r'''
import json
import os
import sys
from pathlib import Path

import fitz


def main(argv):
    args = {"font_paths": []}
    index = 0
    while index < len(argv):
        key = argv[index]
        if key == "--input":
            args["input"] = argv[index + 1]
        elif key == "--out-dir":
            args["out_dir"] = argv[index + 1]
        elif key == "--typst":
            args["typst"] = argv[index + 1]
        elif key == "--output":
            args["output"] = argv[index + 1]
        elif key == "--font-path":
            args["font_paths"].append(argv[index + 1])
        else:
            sys.stderr.write(json.dumps({"error": f"unknown argument {key}"}) + "\n")
            return 2
        index += 2
    out_dir = Path(args["out_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "argv.json").write_text(
        json.dumps({"argv": argv, "electron_run_as_node": os.environ.get("ELECTRON_RUN_AS_NODE", "")}),
        encoding="utf-8",
    )
    exit_code = int(os.environ.get("FAKE_RPR_EXIT", "0") or 0)
    if exit_code:
        sys.stderr.write("some engine log line\n")
        sys.stderr.write(json.dumps({"error": "fake engine failure"}) + "\n")
        return exit_code
    payload = json.loads(Path(args["input"]).read_text(encoding="utf-8"))
    assert payload["schema"] == "rpr_retain_input_v1", payload.get("schema")
    doc = fitz.open()
    blocks_report = []
    pages = payload["pages"]
    delta = int(os.environ.get("FAKE_RPR_PAGES_DELTA", "0") or 0)
    for page_number, page in enumerate(pages):
        pdf_page = doc.new_page(width=page["width"], height=page["height"])
        for block in page["blocks"]:
            if block.get("cover_box"):
                pdf_page.draw_rect(fitz.Rect(*block["cover_box"]), color=None, fill=block["cover_fill"])
            x0, y0, x1, y1 = block["content_box"]
            pdf_page.insert_text((x0 + 1, y0 + 8), "RPR", fontsize=6, color=block["text_color"])
            fit = block["fit"]
            text = block["text"]
            base = float(block["font_size_pt"])
            final = base
            tier = {"box": "fit", "single_line": "single_line"}.get(fit["mode"], "fixed")
            if "SHRINK" in text and fit.get("min_font_size_pt"):
                final = float(fit["min_font_size_pt"])
            overflow = "OVERFLOW" in text
            available = (y1 - y0) - block["inset_top_pt"] - block["inset_bottom_pt"]
            needed = available + (12.0 if overflow else -1.0)
            blocks_report.append(
                {
                    "id": block["id"],
                    "item_id": block["item_id"],
                    "page": page_number,
                    "base_font_size": base,
                    "final_font_size": final,
                    "final_leading_em": block["leading_em"],
                    "lines": 2,
                    "scale": final / base if base else 1.0,
                    "tier": tier,
                    "shrink_tier": "shrink" if final < base else "base",
                    "min_font_size": fit.get("min_font_size_pt") or base,
                    "at_min": final < base,
                    "overflow": overflow,
                    "overflow_pt": 12.0 if overflow else 0.0,
                    "overflow_right_pt": 0.0,
                    "outside_page": False,
                    "needed_height_pt": needed,
                    "available_height_pt": available,
                    "text_chars": len(text),
                }
            )
    for _ in range(max(0, delta)):
        doc.new_page(width=100, height=100)
    if delta < 0 and len(doc) > 0:
        doc.delete_page(len(doc) - 1)
    doc.save(out_dir / "overlay.pdf")
    collisions = []
    if len(blocks_report) >= 2:
        collisions.append({"page": 0, "a": blocks_report[0]["id"], "b": blocks_report[1]["id"], "kind": "text", "overlap": [1.0, 2.0], "insideOwnBox": False})
    report = {
        "schema": "rpr_retain_report_v1",
        "engine": {"name": "retain-pdf-rendering", "version": "%(version)s", "commit": "fakecommit"},
        "blocks": blocks_report,
        "collisions": collisions,
        "math": {"formulas": sum(block["text"].count("$") // 2 for page in pages for block in page["blocks"]), "failed": []},
        "timings": {"typesetMs": 1, "mathjaxMs": 1, "compileMs": 1, "totalMs": 3},
    }
    (out_dir / "report.json").write_text(json.dumps(report), encoding="utf-8")
    (out_dir / "overlay.typ").write_text("// fake", encoding="utf-8")
    return 0


sys.exit(main(sys.argv[1:]))
''' % {"version": FAKE_ENGINE_VERSION}

_FAKE_FIT_CLI = r'''
import json
import os
import sys
from pathlib import Path

import fitz


def main(argv):
    args = {}
    index = 0
    while index < len(argv):
        key = argv[index]
        if key in ("--input", "--out-dir", "--typst", "--font-path", "--output"):
            args.setdefault(key, []).append(argv[index + 1])
        else:
            sys.stderr.write(json.dumps({"error": f"unknown argument {key}"}) + "\n")
            return 2
        index += 2
    input_path = Path(args["--input"][0])
    out_dir = Path(args["--out-dir"][0])
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "argv.json").write_text(json.dumps({"argv": argv}), encoding="utf-8")
    exit_code = int(os.environ.get("FAKE_RPR_EXIT", "0") or 0)
    if exit_code:
        sys.stderr.write(json.dumps({"error": "fake engine failure"}) + "\n")
        return exit_code
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    assert payload["schema"] == "rpr_fit_input_v1", payload.get("schema")
    base = input_path.parent
    def load(key):
        if payload.get(key) is not None:
            return payload[key]
        name = payload.get(key + "_path")
        return json.loads((base / name).read_text(encoding="utf-8")) if name else None
    document = load("document")
    translations = load("translations")
    drawings = load("drawings") or {}
    pages = payload.get("pages")
    by_index = {int(page["page_index"]): page for page in document["pages"]}
    rendered = [by_index[index] for index in pages] if pages is not None else document["pages"]
    items = {(int(item["page_idx"]), int(item["block_idx"])): item for item in translations}
    doc = fitz.open()
    blocks = []
    for page in rendered:
        index = int(page["page_index"])
        assert str(index) in drawings, f"drawings missing page {index}"
        pdf_page = doc.new_page(width=page["width"], height=page["height"])
        for block in page.get("blocks", []):
            number = int(str(block["block_id"]).rsplit("-b", 1)[-1])
            item = items.get((index, number))
            text = str((item or {}).get("translated_text") or "")
            if not item or not item.get("policy_translate") or not text.strip():
                continue
            x0, y0, x1, y1 = block["bbox"]
            pdf_page.insert_text((x0 + 1, y0 + 8), "FIT", fontsize=6)
            final = 9.5 if "SHRINK" in text else 10.0
            overflow = "OVERFLOW" in text
            blocks.append({"id": block["block_id"], "item_id": item["item_id"], "page": index, "kind": "body",
                           "seed_font_size": 10.0, "final_font_size": final, "line_height": 1.25, "font_weight": "regular",
                           "lines": 2, "overflow": overflow, "overflow_pt": 6.0 if overflow else 0.0,
                           "overflow_right_pt": 0.0, "outside_page": False, "stop_reason": None})
    for _ in range(max(0, int(os.environ.get("FAKE_RPR_PAGES_DELTA", "0") or 0))):
        doc.new_page(width=100, height=100)
    doc.save(out_dir / "overlay.pdf")
    report = {
        "schema": "rpr_fit_report_v1",
        "engine": {"name": "retain-pdf-rendering", "version": "%(version)s", "commit": "fakecommit"},
        "preset": "retain",
        "pages": [{"index": i, "source_page_index": int(page["page_index"])} for i, page in enumerate(rendered)],
        "blocks": blocks,
        "body_font": {"shared": 10.0, "median": 10.0, "min": 9.5, "paragraphs": len(blocks), "below_shared": 0},
        "invariants": {"line_overlaps": 0, "outside": 0, "order": 0, "obstacle_hits": 0, "vector_hits": 0,
                       "overflow_blocks": sum(1 for block in blocks if block["overflow"])},
        "collisions": [],
        "math": {"formulas": 0, "failed": []},
        "timings": {"fitMs": 1, "compileMs": 1, "totalMs": 2},
    }
    (out_dir / "report.json").write_text(json.dumps(report), encoding="utf-8")
    return 0


sys.exit(main(sys.argv[1:]))
''' % {"version": FAKE_ENGINE_VERSION}

_FAKE_NODE = """#!{python}
import os
import sys

argv = sys.argv[1:]
if argv[:1] == ["-p"]:
    print(os.environ.get("FAKE_NODE_VERSION", "22.11.0"))
    sys.exit(0)
script = argv[0]
sys.argv = [script] + argv[1:]
code = compile(open(script, encoding="utf-8").read(), script, "exec")
exec(code, {{"__name__": "__main__", "__file__": script}})
"""


def install_fake_rpr_engine(root: Path, monkeypatch=None, *, with_mathjax: bool = True) -> Path:
    """在 root 下搭一个假引擎；给了 monkeypatch 就顺手设好环境变量并 stub 掉 typst 定位。"""
    root.mkdir(parents=True, exist_ok=True)
    engine = root / "engine"
    (engine / "bin").mkdir(parents=True, exist_ok=True)
    (engine / "bin" / "rpr-retain.js").write_text(_FAKE_CLI, encoding="utf-8")
    (engine / "bin" / "rpr-fit.js").write_text(_FAKE_FIT_CLI, encoding="utf-8")
    (engine / "package.json").write_text(
        json.dumps({"name": "retain-pdf-rendering", "version": FAKE_ENGINE_VERSION}), encoding="utf-8"
    )
    (root / "UPSTREAM").write_text("repo=fake\ncommit=0123456789abcdef\n", encoding="utf-8")
    if with_mathjax:
        # The runtime npm dependencies the engine check looks for (engine_cli.RUNTIME_PACKAGES).
        for package, version in (("mathjax-full", "3.2.2"), ("fontkit", "2.0.4")):
            folder = root / "node_modules" / package
            folder.mkdir(parents=True, exist_ok=True)
            (folder / "package.json").write_text(json.dumps({"name": package, "version": version}), encoding="utf-8")
    node = root / "fake-node"
    node.write_text(_FAKE_NODE.format(python=sys.executable), encoding="utf-8")
    node.chmod(node.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    if monkeypatch is not None:
        monkeypatch.setenv("RETAIN_RPR_ENGINE_DIR", str(root))
        monkeypatch.setenv("RETAINPDF_NODE_BIN", str(node))
        monkeypatch.delenv("FAKE_RPR_EXIT", raising=False)
        monkeypatch.delenv("FAKE_RPR_PAGES_DELTA", raising=False)
        monkeypatch.delenv("FAKE_NODE_VERSION", raising=False)
        monkeypatch.setattr(
            "retainpdf_pipeline.render.output.rpr.engine_cli.resolve_typst_bin",
            lambda: "/usr/bin/true",
        )
    return root


__all__ = ["FAKE_ENGINE_VERSION", "install_fake_rpr_engine"]

