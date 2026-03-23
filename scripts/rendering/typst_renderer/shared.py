from __future__ import annotations

import os
from pathlib import Path

from config import paths
from rendering.math_utils import aggressively_simplify_formula_for_latex_math


TYPST_BIN = "/snap/bin/typst"
TYPST_OVERLAY_DIR = paths.OUTPUT_DIR / "typst_overlay"
CMARKER_VERSION = "0.1.8"
MITEX_VERSION = "0.2.6"


def escape_typst_string(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def force_plain_text_items(translated_items: list[dict]) -> list[dict]:
    forced: list[dict] = []
    for item in translated_items:
        cloned = dict(item)
        cloned["_force_plain_line"] = True
        forced.append(cloned)
    return forced


def force_plain_text_item_at_index(translated_items: list[dict], target_index: int) -> list[dict]:
    forced: list[dict] = []
    for index, item in enumerate(translated_items):
        cloned = dict(item)
        if index == target_index:
            cloned["_force_plain_line"] = True
        forced.append(cloned)
    return forced


def strip_formula_commands_for_item_at_index(translated_items: list[dict], target_index: int) -> list[dict]:
    patched: list[dict] = []
    for index, item in enumerate(translated_items):
        cloned = dict(item)
        if index == target_index:
            formula_map = cloned.get("render_formula_map") or cloned.get("translation_unit_formula_map") or cloned.get("formula_map", [])
            simplified_formula_map: list[dict] = []
            for entry in formula_map:
                simplified_entry = dict(entry)
                simplified_entry["formula_text"] = aggressively_simplify_formula_for_latex_math(
                    str(entry.get("formula_text", ""))
                )
                simplified_formula_map.append(simplified_entry)
            if "render_formula_map" in cloned:
                cloned["render_formula_map"] = simplified_formula_map
            if "translation_unit_formula_map" in cloned:
                cloned["translation_unit_formula_map"] = simplified_formula_map
            cloned["formula_map"] = simplified_formula_map
        patched.append(cloned)
    return patched


def default_compile_workers(page_count: int) -> int:
    cpu_count = os.cpu_count() or 1
    return max(1, min(page_count, cpu_count, 24))
