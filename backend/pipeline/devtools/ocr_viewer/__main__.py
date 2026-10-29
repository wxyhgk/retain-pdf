"""一条命令：造复杂样例 PDF 和标准答案，再生成查看器。

    python -m devtools.ocr_viewer --out /tmp/ocr_viewer   # 在 backend/pipeline 下跑，然后打开 /tmp/ocr_viewer/viewer.html
"""

from __future__ import annotations

import argparse
from pathlib import Path

from devtools.ocr_viewer.complex_sample import build
from devtools.ocr_viewer.viewer import build_viewer


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, required=True, help="output directory")
    args = parser.parse_args(argv)
    pdf_path, truth_path = build().save(args.out)
    print(build_viewer(pdf_path, truth_path, args.out / "viewer.html"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
