"""Synthetic baseline case builder and optional stdout-only snapshot inspector.

This does not update the frozen pre-refactor JSON oracle.
"""
from copy import deepcopy
import json
from pathlib import Path
import sys
from unittest.mock import patch

from support.paths import PIPELINE
sys.path.insert(0, str(PIPELINE))
from retainpdf_pipeline.translate.core.engine_identity import translation_engine_identity
from retainpdf_pipeline.translate.llm.shared.executor_context import item_ids
from retainpdf_pipeline.translate.llm.shared.prompt_building import (
    build_messages, build_single_item_fallback_messages, build_group_member_messages,
)


MODES = ("fast", "sci")
MATH_MODES = ("placeholder", "direct_typst")
ROUTES = ("single", "single_json", "single_decision_json", "single_decision_tagged",
          "batch", "batch_json", "group")
CASE_IDS = tuple(f"{mode}/{math}/{route}" for mode in MODES
                 for math in MATH_MODES for route in ROUTES)


def snapshot(case_id):
    mode, math, route = case_id.split("/")
    item = {"item_id": "p001-a", "page_idx": 0, "block_idx": 1,
            "protected_source_text": "Energy $E=mc^2$ remains conserved.",
            "source_text": "Energy $E=mc^2$ remains conserved.",
            "structure_role": "body", "math_mode": math,
            "translation_context_before": "Earlier observations.",
            "translation_context_after": "Later observations.",
            "_scoped_terms_guidance": "energy => 能量"}
    group = {**item, "item_id": "__cg__:g", "translation_unit_id": "__cg__:g",
             "continuation_group": "g", "translation_unit_kind": "group",
             "translation_unit_member_ids": ["p001-a", "p002-a"],
             "translation_unit_members": [{"item_id": "p001-a", "protected_source_text": "Energy begins"},
                                          {"item_id": "p002-a", "protected_source_text": "and continues."}]}
    values = ([item, dict(item, item_id="p001-b")] if route.startswith("batch")
              else [group] if route == "group" else [item])
    before = deepcopy(values)
    kwargs = dict(mode=mode, domain_guidance="Synthetic domain guidance.", target_language_name="简体中文")
    if route.startswith("single"):
        if route != "single":
            kwargs["response_style"] = "json" if route.endswith("json") else "tagged"
            kwargs["structured_decision"] = "decision" in route
        messages = build_single_item_fallback_messages(values[0], **kwargs)
    elif route.startswith("batch"):
        if route == "batch_json":
            kwargs["response_style"] = "json"
        messages = build_messages(values, **kwargs)
    else:
        messages = build_group_member_messages(values[0], **kwargs)
    assert values == before
    identities = {}
    for transport in ("legacy", "rust"):
        with patch.dict("os.environ", RETAIN_TRANSLATION_TRANSPORT=transport,
                        RETAIN_TRANSLATION_OPTIMIZATION="baseline",
                        RETAIN_MODEL_CONNECTION_FINGERPRINT="synthetic-connection"):
            identities[transport] = translation_engine_identity(mode=mode)
    return {"messages": messages, "engine_identity": identities,
            "members": list(item_ids(values))}


if __name__ == "__main__":
    print(json.dumps({case: snapshot(case) for case in CASE_IDS}, ensure_ascii=False, indent=2))
