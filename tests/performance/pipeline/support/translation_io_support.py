"""Synthetic document and process boundary for translation IO contracts."""
from pathlib import Path
import json
import os
import subprocess
import sys

from support.paths import HERE, PIPELINE
from support.offline import child_environment
PROBE = Path(__file__).with_name("translation_io_probe.py")
SOURCES = {
    "p001-b000": "The copper catalyst remains stable throughout the entire experiment.",
    "p001-b001": "The measured energy follows the relation $E=mc^2$ in this experiment.",
    "p001-b002": "https://example.invalid/reference",
    "p001-b003": "The aqueous sample was heated under",
    "p002-b000": "constant pressure until the reaction reached equilibrium.",
    "p002-b001": "The final solution appeared clear after the filtration procedure.",
    "p002-b002": "The control experiment confirmed the reported chemical stability.",
}
TRANSLATIONS = {
    "p001-b000": "铜催化剂在整个实验过程中始终保持稳定。",
    "p001-b001": "本实验中测得的能量遵循关系 $E=mc^2$。",
    "p001-b003": "水溶液样品在以下条件下加热：",
    "p002-b000": "保持恒定压力，直至反应达到平衡。",
    "p002-b001": "经过过滤操作后，最终溶液呈现澄清状态。",
    "p002-b002": "对照实验证实了所报告的化学稳定性。",
}


def document():
    pages = []
    for page_idx, ids in enumerate((list(SOURCES)[:4], list(SOURCES)[4:])):
        blocks = []
        for index, identity in enumerate(ids):
            text = SOURCES[identity]
            bbox = [40, 40 + index * 150, 550, 100 + index * 150]
            if identity == "p001-b003":
                bbox = [40, 700, 550, 770]
            block = dict(id=identity, reading_order=index, bbox=bbox,
                         content={"kind": "text", "text": text},
                         layout_role="paragraph", semantic_role="body", structure_role="body",
                         policy={"translate": True},
                         source={"raw_type": "text"}, metadata={})
            if identity in {"p001-b003", "p002-b000"}:
                block["continuation_hint"] = dict(source="provider", group_id="io-cross-page",
                    role="start" if page_idx == 0 else "end", scope="cross_page",
                    reading_order=page_idx, confidence=1.0)
            blocks.append(block)
        pages.append(dict(page_index=page_idx, width=600, height=800, blocks=blocks))
    return {"schema": "normalized_document_v1", "pages": pages}


def prepare(root, *, transport="rust", workers=1, outcome="success", start_page=0, end_page=-1, data=None, batch_size=1):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    source = root / "document.v1.json"
    source.write_text(json.dumps(document() if data is None else data), encoding="utf-8")
    spec = dict(source=str(source), output=str(root / "translated"), transport=transport,
                workers=workers, outcome=outcome, start_page=start_page, end_page=end_page, batch_size=batch_size)
    (root / "spec.json").write_text(json.dumps(spec), encoding="utf-8")
    return root


def command(root):
    return [sys.executable, str(PROBE), str(Path(root) / "spec.json")]


def environment(root):
    return child_environment(root)


def run(root, *, timeout=30):
    process = subprocess.run(command(root), env=environment(root), capture_output=True,
                             text=True, encoding="utf-8", timeout=timeout)
    assert process.returncode == 0, process.stdout + process.stderr
    return json.loads((Path(root) / "result.json").read_text())


def read_artifacts(root):
    from retainpdf_pipeline.render.translation_loader import load_translated_pages
    output = Path(root) / "translated"
    pages = load_translated_pages(output)
    return pages, json.loads((output / "translation-manifest.json").read_text()), json.loads(
        (output / "translation-checkpoint.v1.json").read_text())
