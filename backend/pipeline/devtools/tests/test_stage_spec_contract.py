"""让 devtools/check_stage_specs_contract.py 真的跑起来。

这个检查器是 Rust/Python stage spec 的契约检查器，架构门禁
（devtools/architecture_checks/entrypoints.py）要求它必须存在、必须覆盖五个
loader、必须打成功标记——但在这个文件之前，全仓没有任何地方执行它。门禁只
grep 了它的源码文本，检查器本身从来没被调用过一次。

而且它默认扫 `data/jobs`：CI 上那是空目录，非 `--strict` 时直接返回 0。
也就是说就算有人把它接进 CI，它也什么都不会拦。

这里用固化的黄金 fixture 当输入：它是一份真实捕获的 spec 快照，
`ops/release/check_standalone.py` 已经要求独立后端归档必须带上它，所以这条门禁
跟着后端包一起走。materialize 到 tmp_path 之后（loader 会校验 source_json /
source_pdf 真的存在），用 `--strict` 跑检查器——找不到 spec 就红，而不是静悄悄
返回 0。

为什么选 pytest 而不是往 .github/workflows/tests.yml 里加一步：

1. CI 的 python-services 已经跑两遍 `pytest backend/pipeline/devtools/tests`
   （一遍装 typst 前的 hermetic 跑，一遍全量），新增用例自动进门禁，不用改
   workflow，也不会漏掉那个 hermetic 跑。
2. 检查器需要一份路径已重写、且 source 文件真实存在的 job 目录。shell 步骤做不到
   这件事，除非再写一个辅助脚本——那就等于把 fixture materialize 逻辑复制两份。
3. 同一个文件里还能顺手把 key 集合和默认值的跨语言断言一起钉住，三条断言共用
   一份 fixture。
"""
from __future__ import annotations

import dataclasses
import json
import re
import shutil
import sys
from pathlib import Path

import pytest

DEVTOOLS_ROOT = Path(__file__).resolve().parents[1]
PIPELINE_ROOT = DEVTOOLS_ROOT.parent
if str(PIPELINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PIPELINE_ROOT))

from devtools import check_stage_specs_contract  # noqa: E402
from retainpdf_pipeline.foundation.shared.stage_specs import (  # noqa: E402
    DEFAULT_TRANSLATION_BATCH_SIZE,
    TranslateStageParams,
    TranslateStageSpec,
)

BACKEND_ROOT = PIPELINE_ROOT.parent
REPO_ROOT = BACKEND_ROOT.parent if BACKEND_ROOT.name == "backend" else BACKEND_ROOT
FIXTURE = REPO_ROOT / "tests" / "fixtures" / "golden-jobs" / "chem-6ada81-10p"
RUST_DEFAULTS_RS = (
    REPO_ROOT / "backend" / "packages" / "retain-core" / "src" / "models" / "defaults.rs"
)

# checker 支持的 stage（SPEC_LOADERS）里，fixture 实际带了这几份 spec。
FIXTURE_SPEC_NAMES = (
    "normalize.spec.json",
    "provider.spec.json",
    "render.spec.json",
    "translate.spec.json",
)


def _materialize(job_root: Path) -> Path:
    """把 fixture 铺进 job_root，占位符换成真实路径，并补齐 loader 要求存在的文件。

    fixture 刻意不带 source PDF（大文件）。loader 只检查路径存在，不读内容，
    所以这里放一个占位文件即可——这条用例校验的是 spec 契约，不是 PDF 解析。
    """
    if not FIXTURE.is_dir():
        pytest.skip(f"golden fixture unavailable: {FIXTURE}")
    rewrites = {
        "{JOB_ROOT}": str(job_root),
        "{REPO_ROOT}": str(REPO_ROOT),
        "{UPLOADS_ROOT}": str(job_root / "uploads"),
    }
    for src in sorted(FIXTURE.rglob("*")):
        if src.is_dir() or src.name == "README.md":
            continue
        dst = job_root / src.relative_to(FIXTURE)
        dst.parent.mkdir(parents=True, exist_ok=True)
        try:
            text = src.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            shutil.copy2(src, dst)
            continue
        for placeholder, value in rewrites.items():
            text = text.replace(placeholder, value)
        dst.write_text(text, encoding="utf-8")

    specs_dir = job_root / "specs"
    for spec_path in sorted(specs_dir.glob("*.spec.json")):
        payload = json.loads(spec_path.read_text(encoding="utf-8"))
        inputs = payload.get("inputs")
        if not isinstance(inputs, dict):
            continue
        for key in ("source_pdf", "layout_json", "source_json"):
            raw = str(inputs.get(key) or "").strip()
            if not raw:
                continue
            target = Path(raw)
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                target.write_bytes(b"%PDF-1.4\n" if target.suffix == ".pdf" else b"{}\n")
    return specs_dir


def test_stage_spec_contract_checker_accepts_the_golden_specs(tmp_path, capsys) -> None:
    specs_dir = _materialize(tmp_path / "job")

    exit_code = check_stage_specs_contract.main([str(specs_dir), "--strict"])
    out = capsys.readouterr()

    assert exit_code == 0, f"stdout={out.out}\nstderr={out.err}"
    assert "stage_spec_contract=ok" in out.out
    assert f"checked={len(FIXTURE_SPEC_NAMES)}" in out.out


def test_stage_spec_contract_checker_is_strict_about_an_empty_input(tmp_path, capsys) -> None:
    """--strict 是这条门禁的全部意义：空目录必须红。

    检查器默认扫 data/jobs，CI 上那是空的；非 --strict 时「什么都没找到」返回 0。
    一个扫不到输入就放行的门禁等于没有。
    """
    empty = tmp_path / "empty"
    empty.mkdir()
    assert check_stage_specs_contract.main([str(empty), "--strict"]) == 1
    capsys.readouterr()


def test_stage_spec_contract_checker_rejects_a_drifted_spec(tmp_path, capsys) -> None:
    """反证：Rust 少写一个字段，这条门禁必须红。

    这里直接删掉 translate spec 的 `source_json`（loader 用 `_require_text` 要求
    它必须在），模拟 Rust 侧漏写。
    """
    specs_dir = _materialize(tmp_path / "job")
    spec_path = specs_dir / "translate.spec.json"
    payload = json.loads(spec_path.read_text(encoding="utf-8"))
    payload["inputs"].pop("source_json")
    spec_path.write_text(json.dumps(payload), encoding="utf-8")

    assert check_stage_specs_contract.main([str(specs_dir), "--strict"]) == 1
    out = capsys.readouterr()
    assert "stage_spec_contract=failed" in out.err


def test_translate_params_keys_match_the_python_loader_exactly() -> None:
    """Rust 写出的 key 集合 == Python loader 解析的字段集合。

    Rust 侧的对照断言在 retain-data 的 `stage_specs_keep_python_loader_contract_keys`
    里，读的是同一份 fixture。两条断言串成一条链：Rust 改 params → Rust 用例红 →
    更新 fixture → 这条用例红 → loader 跟上。少了任何一环，一边加了字段另一边
    不解析（或反过来，解析了一个谁都不写的字段）就没人拦得住——`render_prewarm_*`
    那 4 个死字段正是这么活下来的。
    """
    if not FIXTURE.is_dir():
        pytest.skip(f"golden fixture unavailable: {FIXTURE}")
    payload = json.loads(
        (FIXTURE / "specs" / "translate.spec.json").read_text(encoding="utf-8")
    )
    spec_keys = set(payload["params"])
    loader_fields = {field.name for field in dataclasses.fields(TranslateStageParams)}

    assert spec_keys == loader_fields, (
        f"only in spec: {sorted(spec_keys - loader_fields)}; "
        f"only in loader: {sorted(loader_fields - spec_keys)}"
    )


def _rust_default_batch_size() -> int:
    source = RUST_DEFAULTS_RS.read_text(encoding="utf-8")
    match = re.search(r"fn\s+default_batch_size\(\)\s*->\s*i64\s*\{(.*?)\n\}", source, re.S)
    assert match, f"default_batch_size not found in {RUST_DEFAULTS_RS}"
    numbers = re.findall(r"^\s*(\d+)\s*$", match.group(1), re.M)
    assert len(numbers) == 1, f"ambiguous default_batch_size body: {match.group(1)!r}"
    return int(numbers[0])


def test_batch_size_fallback_matches_the_rust_default(tmp_path) -> None:
    """两边的兜底值必须是同一个数。

    Rust 缺 key 时用 8，Python loader 原本缺 key 时用 1，而 1 会禁用批翻译队列
    （每个文本块单独发一次请求）。今天不咬人只因为这个 key 从没缺过——但兜底值
    存在的意义就是 key 缺失时用。
    """
    if not RUST_DEFAULTS_RS.is_file():
        pytest.skip(f"rust defaults unavailable: {RUST_DEFAULTS_RS}")
    assert DEFAULT_TRANSLATION_BATCH_SIZE == _rust_default_batch_size()

    specs_dir = _materialize(tmp_path / "job")
    spec_path = specs_dir / "translate.spec.json"
    payload = json.loads(spec_path.read_text(encoding="utf-8"))
    payload["params"].pop("batch_size")
    spec_path.write_text(json.dumps(payload), encoding="utf-8")

    spec = TranslateStageSpec.load(spec_path)
    assert spec.params.batch_size == _rust_default_batch_size()
