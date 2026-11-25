"""表格 agent（T3 + G4 定结构）对着评测集的标准答案打分。

用法::

    # 真模型（花钱；Key 从环境变量取，只在内存里）
    backend/.venv/bin/python backend/pipeline/devtools/table_agent_eval.py --engine haiku --record 回放.json
    # 离线回放（不花钱，改代码后重跑）
    backend/.venv/bin/python backend/pipeline/devtools/table_agent_eval.py --replay 回放.json
    # 只跑结构不可信的表（先定结构再翻），两家 OCR 的都跑
    backend/.venv/bin/python backend/pipeline/devtools/table_agent_eval.py --only-flagged --provider glm_ocr --provider paddle \\
        --record 回放.json

每张表：评测集里 OCR 的表格记录 + 原文页 → 表格模型（T1）→（结构不可信、修得了的先定结构，G4）→ 表格 agent；
行列数和标准答案一样的表逐格比："翻不翻"判对的比例（拆成该翻没翻、不该翻翻了）、数字保留、同表同译；
定结构的表另记修没修好、修完行列数和格子原文（只比文字）跟标准答案对不对。另记每张表的结果、轮数、请求数和 token（按用途分）。
参考译文只给人看（``--json-out``），不自动打分。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path

import re

import fitz

from retainpdf_pipeline.ocr.tables import build_table_model
from retainpdf_pipeline.translate.tables_stage import table_structure_source
from retainpdf_table_agent import BLOCKING_ISSUES
from retainpdf_table_agent import STRUCTURE_FIXED
from retainpdf_table_agent import TableContext
from retainpdf_table_agent import TableTermMemory
from retainpdf_table_agent import fix_structure
from retainpdf_table_agent import needs_structure_fix
from retainpdf_table_agent import translate_table
from retainpdf_table_agent_engine import table_chat_fn

DEVTOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(DEVTOOLS))
import table_model_eval  # noqa: E402

ENGINES = {
    # 测试只用这两个（用户定：Haiku；文字版也测 qwen3.8-flash）
    "haiku": {"model": "claude-haiku-5-5", "base_url": "https://api.anthropic.com", "protocol": "anthropic", "key_env": "ANTHROPIC_API_KEY"},
    "qwen": {"model": "qwen3.8-flash", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "protocol": "openai",
             "key_env": "QWEN_API_KEY"},
}


class Recorder:
    """按（消息内容的哈希）记下/回放模型回复，离线重跑不花钱。"""

    def __init__(self, inner, path: Path | None, *, replay: bool) -> None:  # noqa: ANN001
        self.inner, self.path, self.replay = inner, path, replay
        self.tape: dict[str, dict] = json.loads(path.read_text(encoding="utf-8")) if path and path.exists() else {}
        self.usage: Counter = Counter()
        self.requests = 0
        self.by_purpose: Counter = Counter()

    def __call__(self, messages, *, purpose, response_format=None):  # noqa: ANN001
        key = hashlib.sha256(json.dumps(messages, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        self.requests += 1
        self.by_purpose[f"{purpose}:requests"] += 1
        if key in self.tape:
            entry = self.tape[key]
        elif self.replay:
            raise SystemExit(f"回放里没有这次请求（代码或提示词改了）：{key[:12]}")
        else:
            result = self.inner(messages, purpose=purpose, response_format=response_format)
            entry = {"content": result.content, "usage": result.usage or {}}
            self.tape[key] = entry
            if self.path:
                self.path.write_text(json.dumps(self.tape, ensure_ascii=False, indent=1), encoding="utf-8")
        for name, value in (entry.get("usage") or {}).items():
            if isinstance(value, int):
                self.usage[name] += value
                self.by_purpose[f"{purpose}:{name}"] += value
        return entry["content"]


def numbers(text: str) -> Counter:
    return Counter(re.findall(r"\d+(?:[.,]\d+)*", re.sub(r"<[^>]+>", "", text or "")))


def structure_score(model: dict, label: dict) -> dict:
    """结构和标准答案比：行列数一样不一样；一样的话格子原文（只比文字）对上几格。"""
    shape = (model["n_rows"], model["n_cols"])
    truth_shape = table_model_eval._truth_shape(label)
    score = {"shape": list(shape), "truth_shape": list(truth_shape), "same_shape": shape == truth_shape}
    if shape == truth_shape and model.get("cells"):
        truth = table_model_eval._truth_cells(label)
        total = ok = 0
        for cell in model["cells"]:
            expected = truth.get((cell["row"], cell["col"]))
            if expected is None:
                continue
            total += 1
            ok += table_model_eval._norm(cell["text"], markup=False) == table_model_eval._norm(expected["text"], markup=False)
        score.update(cells=total, cells_text_ok=ok)
    return score


def evaluate(chat, *, providers: tuple[str, ...] = ("glm_ocr",), limit: int | None = None,  # noqa: ANN001
             only_flagged: bool = False, structure_only: bool = False, fix: bool = True) -> dict:
    labels = table_model_eval._labels()
    memory = TableTermMemory()
    counts: Counter = Counter()
    tables: list[dict] = []
    documents: dict[str, fitz.Document] = {}
    for provider in providers:
        records = json.loads((table_model_eval.TABLES / "ocr" / f"{provider}.tables.json").read_text(encoding="utf-8"))
        for record in records[: limit or None]:
            label = table_model_eval._match_label(record, labels)
            if label is None:
                continue
            document = documents.setdefault(record["fixture"], fitz.open(table_model_eval.PDFS / record["fixture"]))
            page = document[record["source_page"] - 1]
            block = {"block_id": record["block_id"], "page_index": record["source_page"] - 1, "bbox": record["bbox_pt"],
                     "text": record["html"]}
            model = build_table_model(block, page)
            blocking = sorted(BLOCKING_ISSUES.intersection(model["issues"]))
            if only_flagged and not blocking:
                continue
            context = TableContext(caption=label.get("caption") or "", footnotes=" ".join(label.get("footnotes") or []))
            row: dict = {"provider": provider, "label_id": label["label_id"], "issues": blocking}
            source = table_structure_source(block, page) if fix and needs_structure_fix(model) else None
            if source is not None:
                counts["structure_tables"] += 1
                structure = fix_structure(model, source=source, chat_fn=chat, caption=context.caption, footnotes=context.footnotes)
                counts["structure:" + structure.status] += 1
                counts["structure_rounds"] += structure.rounds
                counts["structure_rejected_edits"] += structure.rejected
                row["structure"] = structure.as_dict()
                row["structure_before"] = structure_score(model, label)
                if structure.status == STRUCTURE_FIXED and structure.model is not None:
                    model = structure.model
                    score = structure_score(model, label)
                    row["structure_after"] = score
                    counts["structure_fixed_same_shape"] += score["same_shape"]
                    counts["structure_fixed_cells"] += score.get("cells", 0)
                    counts["structure_fixed_cells_text_ok"] += score.get("cells_text_ok", 0)
            if structure_only:
                tables.append(row)
                continue
            result = translate_table(model, chat_fn=chat, memory=memory, context=context)
            counts["tables"] += 1
            counts["status:" + result.status] += 1
            row.update(status=result.status, reason=result.reason, rounds=result.rounds,
                       feedback_rounds=result.feedback_rounds, cells=[])
            same_shape = (model["n_rows"], model["n_cols"]) == table_model_eval._truth_shape(label)
            if same_shape and result.cells:
                truth = table_model_eval._truth_cells(label)
                translations = result.translations()
                for cell in model["cells"]:
                    expected = truth.get((cell["row"], cell["col"]))
                    if expected is None or not cell["text"].strip():
                        continue
                    predicted = "translate" if cell["id"] in translations else "keep"
                    counts["cells"] += 1
                    counts["action_ok"] += predicted == expected["action"]
                    counts["kept_but_should_translate"] += predicted == "keep" and expected["action"] == "translate"
                    counts["translated_but_should_keep"] += predicted == "translate" and expected["action"] == "keep"
                    if cell["id"] in translations:
                        counts["translated_cells"] += 1
                        counts["numbers_kept"] += numbers(translations[cell["id"]]) == numbers(cell["text"])
                    row["cells"].append({"id": cell["id"], "source": cell["text"], "translation": translations.get(cell["id"]),
                                         "expected_action": expected["action"], "reference": expected.get("reference")})
            tables.append(row)
    for document in documents.values():
        document.close()
    summary = dict(counts)
    if counts["cells"]:
        summary["action_ok_rate"] = round(counts["action_ok"] / counts["cells"], 3)
    if counts["translated_cells"]:
        summary["numbers_kept_rate"] = round(counts["numbers_kept"] / counts["translated_cells"], 3)
    summary["terms_in_memory"] = len(memory)
    return {"providers": list(providers), "summary": summary, "tables": tables}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--engine", choices=sorted(ENGINES), default="haiku")
    parser.add_argument("--record", type=Path, help="真模型跑，回复记到这个文件（已有的请求直接用记下的）")
    parser.add_argument("--replay", type=Path, help="只用记下的回复，不发请求")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--provider", action="append", choices=["glm_ocr", "paddle"], help="哪家 OCR 的结构（默认 glm_ocr，可给多次）")
    parser.add_argument("--only-flagged", action="store_true", help="只跑表格模型标了结构不可信的表")
    parser.add_argument("--structure-only", action="store_true", help="只定结构，不翻格子")
    parser.add_argument("--no-structure", action="store_true", help="不定结构（结构不可信的表照旧跳过，和 G4 以前一样）")
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args(argv)
    if args.replay:
        recorder = Recorder(None, args.replay, replay=True)
    else:
        engine = ENGINES[args.engine]
        api_key = os.environ.get(engine["key_env"], "")
        if args.engine == "qwen" and os.environ.get("QWEN_BASE_URL"):
            engine = {**engine, "base_url": os.environ["QWEN_BASE_URL"]}
        if not api_key:
            raise SystemExit(f"环境变量 {engine['key_env']} 没设")
        inner = table_chat_fn(model=engine["model"], base_url=engine["base_url"], api_key=api_key, protocol=engine["protocol"])
        recorder = Recorder(inner, args.record, replay=False)
    result = evaluate(recorder, providers=tuple(args.provider or ["glm_ocr"]), limit=args.limit, only_flagged=args.only_flagged,
                      structure_only=args.structure_only, fix=not args.no_structure)
    result["requests"] = recorder.requests
    result["usage"] = dict(recorder.usage)
    result["usage_by_purpose"] = dict(recorder.by_purpose)
    print(json.dumps({"summary": result["summary"], "requests": result["requests"], "usage": result["usage"],
                      "usage_by_purpose": result["usage_by_purpose"]}, ensure_ascii=False))
    for row in result["tables"]:
        structure = row.get("structure")
        if structure:
            after = row.get("structure_after") or {}
            cells = f"格子原文 {after.get('cells_text_ok')}/{after.get('cells')}" if after.get("cells") else ""
            print("   ", row["provider"], row["label_id"], "定结构", structure["status"], structure["reason"],
                  "轮", structure["rounds"], "退回", structure["rejected"], structure["shape_before"], "→",
                  structure["shape_after"], "标准", (row.get("structure_before") or {}).get("truth_shape"), cells)
        if row.get("status") not in (None, "translated"):
            print("   ", row["provider"], row["label_id"], row["status"], row["reason"])
    if args.json_out:
        args.json_out.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
