"""表格 agent（T3）对着评测集的标准答案打分。

用法::

    # 真模型（花钱；Key 从环境变量取，只在内存里）
    backend/.venv/bin/python backend/pipeline/devtools/table_agent_eval.py --engine haiku --record 回放.json
    # 离线回放（不花钱，改代码后重跑）
    backend/.venv/bin/python backend/pipeline/devtools/table_agent_eval.py --replay 回放.json

每张表：评测集里 GLM-OCR 的表格记录 + 原文页 → 表格模型（T1）→ 表格 agent；表格模型行列数和标准答案一样的表逐格比：
"翻不翻"判对的比例（拆成该翻没翻、不该翻翻了）、数字保留、同表同译；另记每张表的结果、轮数、请求数和 token。
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
from retainpdf_translation.public import TableContext
from retainpdf_translation.public import TableTermMemory
from retainpdf_translation.public import table_chat_fn
from retainpdf_translation.public import translate_table

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

    def __call__(self, messages, *, purpose, response_format=None):  # noqa: ANN001
        key = hashlib.sha256(json.dumps(messages, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        self.requests += 1
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
        return entry["content"]


def numbers(text: str) -> Counter:
    return Counter(re.findall(r"\d+(?:[.,]\d+)*", re.sub(r"<[^>]+>", "", text or "")))


def evaluate(chat, *, provider: str = "glm_ocr", limit: int | None = None) -> dict:  # noqa: ANN001
    records = json.loads((table_model_eval.TABLES / "ocr" / f"{provider}.tables.json").read_text(encoding="utf-8"))
    labels = table_model_eval._labels()
    memory = TableTermMemory()
    counts: Counter = Counter()
    tables: list[dict] = []
    documents: dict[str, fitz.Document] = {}
    for record in records[: limit or None]:
        label = table_model_eval._match_label(record, labels)
        if label is None:
            continue
        document = documents.setdefault(record["fixture"], fitz.open(table_model_eval.PDFS / record["fixture"]))
        block = {"block_id": record["block_id"], "page_index": record["source_page"] - 1, "bbox": record["bbox_pt"],
                 "text": record["html"]}
        model = build_table_model(block, document[record["source_page"] - 1])
        context = TableContext(caption=label.get("caption") or "", footnotes=" ".join(label.get("footnotes") or []))
        result = translate_table(model, chat_fn=chat, memory=memory, context=context)
        counts["tables"] += 1
        counts["status:" + result.status] += 1
        row = {"label_id": label["label_id"], "status": result.status, "reason": result.reason, "rounds": result.rounds,
               "feedback_rounds": result.feedback_rounds, "cells": []}
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
    return {"provider": provider, "summary": summary, "tables": tables}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--engine", choices=sorted(ENGINES), default="haiku")
    parser.add_argument("--record", type=Path, help="真模型跑，回复记到这个文件（已有的请求直接用记下的）")
    parser.add_argument("--replay", type=Path, help="只用记下的回复，不发请求")
    parser.add_argument("--limit", type=int)
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
    result = evaluate(recorder, limit=args.limit)
    result["requests"] = recorder.requests
    result["usage"] = dict(recorder.usage)
    print(json.dumps({"summary": result["summary"], "requests": result["requests"], "usage": result["usage"]}, ensure_ascii=False))
    for row in result["tables"]:
        if row["status"] != "translated":
            print("   ", row["label_id"], row["status"], row["reason"])
    if args.json_out:
        args.json_out.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
