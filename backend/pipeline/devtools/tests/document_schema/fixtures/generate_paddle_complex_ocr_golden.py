#!/usr/bin/env python3
"""Generate the committed, offline Paddle complex-document golden fixture.

This generator deliberately uses only synthetic content and a 1x1 PNG.  It
must never contact PaddleOCR or an LLM, so the fixture remains deterministic
and safe to run in CI.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


FIXTURE_PATH = Path(__file__).with_name("paddle_complex_ocr.golden.json")
PIXEL_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/"
    "x8AAwMCAO+aD3sAAAAASUVORK5CYII="
)
LEFT_IMAGE = "imgs/img_in_image_box_80_980_550_1250.png"
RIGHT_IMAGE = "imgs/img_in_image_box_650_980_1120_1250.png"


def _block(label: str, content: str, bbox: list[int]) -> dict:
    return {
        "block_label": label,
        "block_content": content,
        "block_bbox": bbox,
    }


def build_fixture() -> dict:
    blocks = [
        _block("doc_title", "Offline Golden Document", [80, 40, 1120, 120]),
        _block("paragraph_title", "Introduction", [80, 140, 1120, 200]),
        _block(
            "text",
            "The left column opens with inline $a^2+b^2=c^2$ and a stable long "
            "paragraph used to verify document normalization, formula geometry, "
            "citation anchors, and reading order across multiple wrapped lines.",
            [80, 220, 550, 390],
        ),
        _block(
            "text",
            "The left column continues before the reader moves to the top of the "
            "right column, preserving a distinct block and exact page location.",
            [80, 410, 550, 560],
        ),
        _block(
            "text",
            "The right column starts here and remains a separate long body block "
            "with its own geometry, searchable text, and stable citation target.",
            [650, 220, 1120, 390],
        ),
        _block(
            "text",
            "The right column closes the multi-column section without merging into "
            "the left column or losing its provider reading order.",
            [650, 410, 1120, 560],
        ),
        _block("display_formula", "E = mc^2", [250, 600, 950, 680]),
        _block("figure_title", "Table 1. Offline quality metrics.", [100, 700, 1100, 750]),
        _block(
            "table",
            "<table><thead><tr><th>Metric</th><th>Value</th></tr></thead>"
            "<tbody><tr><td>Recall</td><td>0.98</td></tr></tbody></table>",
            [100, 770, 1100, 940],
        ),
        _block("image", f'<img src="{LEFT_IMAGE}" />', [80, 980, 550, 1250]),
        _block("figure_title", "Figure 1. Offline pipeline overview.", [80, 1260, 550, 1310]),
        _block("paragraph_title", "Additional result", [80, 1330, 1120, 1380]),
        _block("image", f'<img src="{RIGHT_IMAGE}" />', [650, 980, 1120, 1250]),
        _block("figure_title", "Figure 2. Citation region map.", [650, 1260, 1120, 1310]),
    ]

    markdown = """# Offline Golden Document

## Introduction

The left column opens with inline $a^2+b^2=c^2$ and a stable long paragraph used to verify document normalization, formula geometry, citation anchors, and reading order across multiple wrapped lines.

The left column continues before the reader moves to the top of the right column, preserving a distinct block and exact page location.

The right column starts here and remains a separate long body block with its own geometry, searchable text, and stable citation target.

The right column closes the multi-column section without merging into the left column or losing its provider reading order.

$$E = mc^2$$

Table 1. Offline quality metrics.

| Metric | Value |
| --- | ---: |
| Recall | 0.98 |

<div style="text-align: center;"><img src="imgs/img_in_image_box_80_980_550_1250.png" alt="Pipeline figure" width="45%" /></div>

Figure 1. Offline pipeline overview.

## Additional result

![Citation map](imgs/img_in_image_box_650_980_1120_1250.png)

Figure 2. Citation region map."""

    return {
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "width": 1200,
                    "height": 1600,
                    "parsing_res_list": blocks,
                    "layout_det_res": {
                        "boxes": [
                            {
                                "label": "inline_formula",
                                "coordinate": [250, 250, 410, 290],
                                "score": 0.99,
                            }
                        ]
                    },
                },
                "markdown": {
                    "text": markdown,
                    "images": {
                        LEFT_IMAGE: PIXEL_PNG_BASE64,
                        RIGHT_IMAGE: PIXEL_PNG_BASE64,
                    },
                },
                "outputImages": {},
                "inputImage": "",
            }
        ],
        "dataInfo": {
            "type": "paddle",
            "numPages": 1,
            "pages": [{"width": 1200, "height": 1600}],
        },
        "preprocessedImages": [""],
        "_meta": {"source": "committed_offline_golden_fixture"},
    }


def render_fixture() -> str:
    return json.dumps(build_fixture(), ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when the committed fixture differs from generator output.",
    )
    args = parser.parse_args()
    rendered = render_fixture()
    if args.check:
        try:
            committed = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            committed = None
        if committed != build_fixture():
            raise SystemExit(
                f"fixture is stale: run {Path(__file__).name} and commit {FIXTURE_PATH.name}"
            )
        return 0
    FIXTURE_PATH.write_text(rendered, encoding="utf-8")
    print(FIXTURE_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
