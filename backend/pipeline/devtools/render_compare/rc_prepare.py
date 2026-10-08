"""任务目录 → 渲染用的最小拷贝；原任务目录只读，跑前跑后做指纹对比。

只复制 render-only 需要的部分：
- specs/render.spec.json（不复制 provider / translate / normalize spec：渲染用不到，且可能带凭据引用）；
- source/（原 PDF，copy2 保留 mtime，prewarm 指纹要比对 size + mtime_ns）；
- translated/（逐页译文 + manifest）；
- ocr/normalized/document.v1.json（块框、保护区；prewarm 指纹里的 protected_source_hash 由它算）；
- artifacts/render_prewarm/（预热 manifest、去文字层 PDF、visual_profile、pdf_structure_profile）。

拷贝里所有指向原任务目录的绝对路径改写到拷贝（spec 的 job_root / inputs、prewarm 指纹的
source_pdf_path、document.v1 的 source_json），改完断言拷贝里不再有原路径。
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from pathlib import Path

REQUIRED = (
    "specs/render.spec.json",
    "translated/translation-manifest.json",
    "ocr/normalized/document.v1.json",
    "artifacts/render_prewarm/render_source_prewarm_manifest.json",
)
COPY_DIRS = ("source", "translated", "artifacts/render_prewarm")
COPY_FILES = ("specs/render.spec.json", "ocr/normalized/document.v1.json")
EMPTY_DIRS = ("rendered", "logs", "md", "ocr")
RELOCATE_JSON = (
    "specs/render.spec.json",
    "artifacts/render_prewarm/render_source_prewarm_manifest.json",
    "ocr/normalized/document.v1.json",
)


def missing_inputs(job_root: Path) -> list[str]:
    missing = [rel for rel in REQUIRED if not (job_root / rel).is_file()]
    spec_path = job_root / "specs/render.spec.json"
    if spec_path.is_file():
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        source_pdf = Path(str(spec.get("inputs", {}).get("source_pdf") or ""))
        if not source_pdf.is_file():
            missing.append(f"source_pdf ({source_pdf.name or '未设置'})")
        manifest = job_root / "artifacts/render_prewarm/render_source_prewarm_manifest.json"
        if manifest.is_file():
            data = json.loads(manifest.read_text(encoding="utf-8"))
            rel = str((data.get("render_source") or {}).get("path") or "")
            if rel and not (manifest.parent / rel).is_file():
                missing.append(f"prewarm 去文字层 PDF ({rel})")
    return missing


def snapshot(job_root: Path) -> dict[str, list]:
    """原任务目录每个文件的 size / mtime_ns / sha256，用来证明一个字节都没改。"""
    entries: dict[str, list] = {}
    for path in sorted(job_root.rglob("*")):
        if path.is_symlink() or not path.is_file():
            continue
        stat = path.stat()
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1 << 20), b""):
                digest.update(chunk)
        entries[str(path.relative_to(job_root))] = [stat.st_size, stat.st_mtime_ns, digest.hexdigest()]
    return entries


def _rewrite(value, old: str, new: str):
    if isinstance(value, str):
        return new + value[len(old) :] if value == old or value.startswith(old + os.sep) else value
    if isinstance(value, list):
        return [_rewrite(item, old, new) for item in value]
    if isinstance(value, dict):
        return {key: _rewrite(item, old, new) for key, item in value.items()}
    return value


def prepare_copy(
    job_root: Path,
    dest: Path,
    *,
    engine: str,
    render_mode: str | None,
) -> dict:
    """复制并改写拷贝，返回改过的 spec params 摘要（不含任何凭据值）。"""
    job_root = job_root.resolve()
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    for rel in COPY_DIRS:
        shutil.copytree(job_root / rel, dest / rel, copy_function=shutil.copy2)
    for rel in COPY_FILES:
        (dest / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(job_root / rel, dest / rel)
    for rel in EMPTY_DIRS:
        (dest / rel).mkdir(parents=True, exist_ok=True)

    old, new = str(job_root), str(dest.resolve())
    for rel in RELOCATE_JSON:
        path = dest / rel
        data = json.loads(path.read_text(encoding="utf-8"))
        path.write_text(json.dumps(_rewrite(data, old, new), ensure_ascii=False, indent=1), encoding="utf-8")

    spec_path = dest / "specs/render.spec.json"
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    spec["job"]["job_root"] = new
    params = spec.setdefault("params", {})
    original_mode = params.get("render_mode")
    params["engine"] = engine
    if render_mode:
        params["render_mode"] = render_mode
    # 对比时：不精修、不联网（Typst LLM 修复要 api_key + model + base_url 三样齐全才会走）。
    params["refine"] = {"mode": "off"}
    params["model"] = ""
    params["base_url"] = ""
    params["credential_ref"] = ""
    spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")

    leftovers = [
        str(path.relative_to(dest))
        for path in dest.rglob("*.json")
        if old in path.read_text(encoding="utf-8", errors="ignore")
    ]
    if leftovers:
        raise RuntimeError(f"拷贝里还有指向原任务目录的路径：{leftovers}")
    source_pdf = Path(spec["inputs"]["source_pdf"])
    if not source_pdf.is_file() or not str(source_pdf).startswith(new):
        raise RuntimeError(f"拷贝里的 source_pdf 不对：{source_pdf}")
    return {
        "engine": engine,
        "render_mode": params.get("render_mode"),
        "original_render_mode": original_mode,
        "refine": "off",
        "llm_credentials": "cleared",
    }

