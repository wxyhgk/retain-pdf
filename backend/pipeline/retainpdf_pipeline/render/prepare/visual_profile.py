"""准备步骤：visual_profile（每块的底色 / 字色，从原 PDF 像素与文字 span 采样）。

指纹只含采样真正看的东西（visual_profile.visual_sampling_signature：覆盖框、要不要采底色 /
字色、块类型）和原 PDF——与译文措辞无关，改译文后重渲染直接命中。缓存按原精度存
（exact），命中时读回的与现算的逐位相同。

prewarm（source 层）不能依赖本层：由 prepare.hooks 组装进 RenderPrepareHooks 注入；没有
缓存目录时就是原来的现算。

另有一层按页的缓存（2026-11-02，`visual_profile_pages/<键>.json`，键是原 PDF、页号、这一页的采样指纹）：整本的指纹
只要有一块不同就不命中，以前就得把整本重采一遍。渲染准备进程（翻译时就在跑）先按「每块都翻成」把每页算好
（precompute_visual_profile_pages），翻译完渲染时这一页的指纹对得上就直接读，只重采对不上的页（708 页的书实测
六成页对得上，对不上的多是翻译时判成不翻的块）。一页的结果只取决于这一页，按页拼起来和整本现算逐位相同。
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.prepare.store import StepRecord
from retainpdf_pipeline.render.prepare.store import file_identity
from retainpdf_pipeline.render.prepare.store import fingerprint
from retainpdf_pipeline.render.visual_profile import DocumentVisualProfile
from retainpdf_pipeline.render.visual_profile import build_document_visual_profile
from retainpdf_pipeline.render.visual_profile import document_visual_profile_from_manifest
from retainpdf_pipeline.render.visual_profile import document_visual_profile_to_manifest
from retainpdf_pipeline.render.visual_profile import visual_sampling_signature
from retainpdf_pipeline.render.visual_profile import write_document_visual_profile
from retainpdf_pipeline.render.visual_profile.contracts import VISUAL_PROFILE_ALGORITHM_VERSION
from retainpdf_pipeline.render.visual_profile.io import VISUAL_PROFILE_MANIFEST_NAME

STEP = "visual_profile"
PAGE_CACHE_DIR = "visual_profile_pages"
VERSION = f"2:{VISUAL_PROFILE_ALGORITHM_VERSION}"
OUTPUT = "visual_profile.exact.json"
# 对外格式（visual_profile.v1.json，颜色 5 位小数）：交给引擎等读文件的下游，与原来 prewarm 写的逐字节相同。
PUBLIC_OUTPUT = VISUAL_PROFILE_MANIFEST_NAME

VisualProfileBuilder = Callable[[Path, dict[int, list[dict]]], DocumentVisualProfile]


def step_inputs(*, source_pdf_path: Path, pages: dict[int, list[dict]]) -> dict:
    return {"source_pdf": file_identity(source_pdf_path), "sampling": visual_sampling_signature(pages)}


def run_visual_profile(
    store: PrepareStore, *, source_pdf_path: Path, pages: dict[int, list[dict]]
) -> tuple[DocumentVisualProfile, StepRecord]:
    def build(directory: Path) -> dict[str, Path]:
        profile = build_with_page_cache(store, source_pdf_path=source_pdf_path, pages=pages)
        output = directory / OUTPUT
        output.write_text(json.dumps(document_visual_profile_to_manifest(profile, exact=True)), encoding="utf-8")
        public = directory / PUBLIC_OUTPUT
        write_document_visual_profile(public, profile)
        return {OUTPUT: output, PUBLIC_OUTPUT: public}

    record = store.run(STEP, VERSION, step_inputs(source_pdf_path=source_pdf_path, pages=pages), build)
    profile = document_visual_profile_from_manifest(json.loads(record.output(OUTPUT).read_text(encoding="utf-8")))
    return profile, record


def _page_key(source_identity: object, page_index: int, items: list[dict]) -> str:
    return fingerprint(
        {
            "version": VERSION,
            "source_pdf": source_identity,
            "page": int(page_index),
            "sampling": visual_sampling_signature({page_index: items}),
        }
    )


def _load_page(path: Path, page_index: int):
    try:
        profile = document_visual_profile_from_manifest(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return None
    if profile.algorithm != VISUAL_PROFILE_ALGORITHM_VERSION:
        return None
    return profile.pages.get(int(page_index))


def build_with_page_cache(
    store: PrepareStore, *, source_pdf_path: Path, pages: dict[int, list[dict]]
) -> DocumentVisualProfile:
    """按页查缓存，没有的页一起现采（照旧多进程）再按页存；页序和整本现算的一样。"""
    cache_dir = store.root / PAGE_CACHE_DIR
    source_identity = file_identity(source_pdf_path)
    keys = {page_index: _page_key(source_identity, page_index, items) for page_index, items in pages.items()}
    profiles = {}
    missing: dict[int, list[dict]] = {}
    for page_index, items in pages.items():
        page = _load_page(cache_dir / f"{keys[page_index]}.json", page_index)
        if page is None:
            missing[page_index] = items
        else:
            profiles[page_index] = page
    if missing:
        built = build_document_visual_profile(source_pdf_path, missing)
        cache_dir.mkdir(parents=True, exist_ok=True)
        for page_index, page in built.pages.items():
            profiles[page_index] = page
            one_page = DocumentVisualProfile(algorithm=built.algorithm, pages={page_index: page})
            target = cache_dir / f"{keys[page_index]}.json"
            staged = target.with_suffix(".json.tmp")
            staged.write_text(json.dumps(document_visual_profile_to_manifest(one_page, exact=True)), encoding="utf-8")
            staged.replace(target)
    print(f"render visual profile: pages={len(pages)} cached={len(pages) - len(missing)} sampled={len(missing)}", flush=True)
    return DocumentVisualProfile(
        algorithm=VISUAL_PROFILE_ALGORITHM_VERSION,
        pages={page_index: profiles[page_index] for page_index in pages if page_index in profiles},
    )


def precompute_visual_profile_pages(store: PrepareStore, *, source_pdf_path: Path, pages: dict[int, list[dict]]) -> int:
    """渲染准备进程用：把这些页先采好、按页存（不写整本的记录）。持步骤锁，渲染进程撞上就等它做完再读。返回现采了几页。"""
    with store.lock(STEP):
        cache_dir = store.root / PAGE_CACHE_DIR
        source_identity = file_identity(source_pdf_path)
        todo = {
            page_index: items
            for page_index, items in pages.items()
            if _load_page(cache_dir / f"{_page_key(source_identity, page_index, items)}.json", page_index) is None
        }
        if todo:
            build_with_page_cache(store, source_pdf_path=source_pdf_path, pages=todo)
        return len(todo)


def visual_profile_builder(prepare_dir: Path | None) -> VisualProfileBuilder:
    if prepare_dir is None:
        return build_document_visual_profile
    store = PrepareStore(Path(prepare_dir))

    def builder(source_pdf_path: Path, pages: dict[int, list[dict]]) -> DocumentVisualProfile:
        profile, _record = run_visual_profile(store, source_pdf_path=Path(source_pdf_path), pages=pages)
        return profile

    return builder


__all__ = [
    "OUTPUT",
    "PAGE_CACHE_DIR",
    "PUBLIC_OUTPUT",
    "STEP",
    "VERSION",
    "VisualProfileBuilder",
    "build_with_page_cache",
    "precompute_visual_profile_pages",
    "run_visual_profile",
    "step_inputs",
    "visual_profile_builder",
]
