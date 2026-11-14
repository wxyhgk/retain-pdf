"""表格模型（T1）对着评测集的标准答案打分。

用法::

    backend/.venv/bin/python backend/pipeline/devtools/table_model_eval.py [--provider glm_ocr] [--json-out 结果.json] [--worst 10]

每张表：拿评测集里 OCR 的表格记录（HTML、表格框）+ 原文样例 PDF 那一页跑 build_table_model，和 tests/fixtures/tables/labels/
里的标准答案比：行数×列数对不对、格子原文对不对（按起始行列对齐；含上下标标记、只比文字两种）、角色、"翻不翻"的规则建议。
"""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import fitz

from retainpdf_pipeline.ocr.tables import build_table_model

REPO = Path(__file__).resolve().parents[3]
TABLES = REPO / "tests" / "fixtures" / "tables"
PDFS = REPO / "tests" / "fixtures" / "pdfs"


def _norm(text: str, *, markup: bool) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    if not markup:
        text = re.sub(r"<[^>]+>", "", text)
    return " ".join(text.split())


def _labels() -> list[dict]:
    return [json.loads(path.read_text(encoding="utf-8")) for path in sorted((TABLES / "labels").glob("*.json"))]


def _match_label(record: dict, labels: list[dict]) -> dict | None:
    best, best_area = None, 0.0
    for label in labels:
        if label["fixture"] != record["fixture"] or label["source_page"] != record["source_page"]:
            continue
        a, b = label["bbox_pt"], record["bbox_pt"]
        area = max(0.0, min(a[2], b[2]) - max(a[0], b[0])) * max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
        if area > best_area:
            best, best_area = label, area
    return best


def _truth_cells(label: dict) -> dict[tuple[int, int], dict]:
    cells: dict[tuple[int, int], dict] = {}
    occupied: set[tuple[int, int]] = set()
    for row_index, row in enumerate(label["rows"]):
        column = 0
        for cell in row:
            while (row_index, column) in occupied:
                column += 1
            cells[(row_index, column)] = cell
            for dr in range(cell["rowspan"]):
                for dc in range(cell["colspan"]):
                    occupied.add((row_index + dr, column + dc))
            column += cell["colspan"]
    return cells


def _truth_shape(label: dict) -> tuple[int, int]:
    cells = _truth_cells(label)
    columns = max(column + cell["colspan"] for (_, column), cell in cells.items())
    return len(label["rows"]), columns


def evaluate(provider: str) -> dict:
    records = json.loads((TABLES / "ocr" / f"{provider}.tables.json").read_text(encoding="utf-8"))
    labels = _labels()
    counts: Counter = Counter()
    per_table: list[dict] = []
    documents: dict[str, fitz.Document] = {}
    for record in records:
        label = _match_label(record, labels)
        if label is None:
            counts["no_label"] += 1
            continue
        document = documents.setdefault(record["fixture"], fitz.open(PDFS / record["fixture"]))
        page = document[record["source_page"] - 1]
        block = {"block_id": record["block_id"], "page_index": record["source_page"] - 1,
                 "bbox": record["bbox_pt"], "text": record["html"]}
        model = build_table_model(block, page)
        counts["tables"] += 1
        for issue in model["issues"]:
            counts["issue:" + issue] += 1
        truth_shape = _truth_shape(label)
        same_shape = (model["n_rows"], model["n_cols"]) == truth_shape
        counts["same_shape"] += same_shape
        row = {"label_id": label["label_id"], "shape": [model["n_rows"], model["n_cols"]], "truth_shape": list(truth_shape),
               "issues": model["issues"], "confidence": model["confidence"]}
        if same_shape and model["cells"]:
            truth = _truth_cells(label)
            ok_markup = ok_plain = total = role_ok = action_ok = 0
            wrong_keep = wrong_translate = 0
            for cell in model["cells"]:
                expected = truth.get((cell["row"], cell["col"]))
                if expected is None:
                    continue
                total += 1
                ok_markup += _norm(cell["text"], markup=True) == _norm(expected["text"], markup=True)
                ok_plain += _norm(cell["text"], markup=False) == _norm(expected["text"], markup=False)
                role_ok += cell["role"] == expected["role"]
                action_ok += cell["suggested_action"] == expected["action"]
                wrong_keep += cell["suggested_action"] == "keep" and expected["action"] == "translate"
                wrong_translate += cell["suggested_action"] == "translate" and expected["action"] == "keep"
            counts["cells"] += total
            counts["cells_text_exact"] += ok_markup
            counts["cells_text_exact_plain"] += ok_plain
            counts["cells_role_ok"] += role_ok
            counts["cells_action_ok"] += action_ok
            counts["cells_kept_but_should_translate"] += wrong_keep
            counts["cells_translated_but_should_keep"] += wrong_translate
            row["cell_text_exact"] = round(ok_markup / total, 3) if total else None
            row["cell_text_exact_plain"] = round(ok_plain / total, 3) if total else None
        per_table.append(row)
    for document in documents.values():
        document.close()
    summary = dict(counts)
    if counts["cells"]:
        for key in ("cells_text_exact", "cells_text_exact_plain", "cells_role_ok", "cells_action_ok"):
            summary[key + "_rate"] = round(counts[key] / counts["cells"], 3)
    summary["same_shape_rate"] = round(counts["same_shape"] / counts["tables"], 3) if counts["tables"] else 0
    # 结构有疑问的标记（除 rows_poorly_matched 外任一 issue）：结构真错的表标出了几张、结构对的表误标了几张
    structural = lambda row: any(issue != "rows_poorly_matched" for issue in row["issues"])  # noqa: E731
    wrong = [row for row in per_table if row["shape"] != row["truth_shape"]]
    right = [row for row in per_table if row["shape"] == row["truth_shape"]]
    summary["wrong_shape_flagged"] = f"{sum(structural(row) for row in wrong)}/{len(wrong)}"
    summary["right_shape_flagged"] = f"{sum(structural(row) for row in right)}/{len(right)}"
    return {"provider": provider, "summary": summary, "tables": per_table}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--provider", action="append", choices=["glm_ocr", "paddle"])
    parser.add_argument("--json-out", type=Path)
    parser.add_argument("--worst", type=int, default=8)
    args = parser.parse_args(argv)
    results = [evaluate(provider) for provider in (args.provider or ["glm_ocr", "paddle"])]
    for result in results:
        print(result["provider"], json.dumps(result["summary"], ensure_ascii=False))
        worst = sorted(
            (row for row in result["tables"] if row.get("cell_text_exact") is not None),
            key=lambda row: row["cell_text_exact"],
        )[: args.worst]
        for row in worst:
            print("   worst:", row["label_id"], row["cell_text_exact"], row["issues"])
        for row in result["tables"]:
            if row["shape"] != row["truth_shape"] or row["issues"]:
                print("   shape/issue:", row["label_id"], row["shape"], "truth", row["truth_shape"], row["issues"])
    if args.json_out:
        args.json_out.write_text(json.dumps(results, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
