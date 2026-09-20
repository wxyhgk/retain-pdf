from __future__ import annotations

import sys
from pathlib import Path

import pytest


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools.architecture_checks import stage_contract_duplicates as gate


def _synthetic_package(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    files: dict[str, str],
    *,
    required: dict[tuple[str, str], frozenset[str]] | None = None,
    floors: bool = False,
) -> Path:
    """在 tmp_path 下搭一个假 retainpdf_pipeline 包,并把门禁指过去。

    默认关掉「关键配对点名」和「规模下限」这两道自保,好让单条判据的用例只测判据;
    自保本身由专门的用例覆盖。
    """
    package_root = tmp_path / "retainpdf_pipeline"
    for rel_path, source in files.items():
        path = package_root / rel_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source, encoding="utf-8")
    monkeypatch.setattr(gate, "DUPLICATE_SCAN_ROOT", package_root)
    monkeypatch.setattr(gate, "REQUIRED_COMPARISONS", required if required is not None else {})
    if not floors:
        monkeypatch.setattr(gate, "MIN_MARKED_COPIES", 0)
        monkeypatch.setattr(gate, "MIN_RESOLVED_EDGES", 0)
        monkeypatch.setattr(gate, "MIN_COMPARED_SYMBOLS", 0)
        monkeypatch.setattr(gate, "MIN_COMPARED_CONTRACT_STRINGS", 0)
    return package_root


_SOURCE_RECORD_BUILDER = (
    "def build_record(item):\n"
    "    return {\n"
    "        \"item_id\": item.item_id,\n"
    "        \"page_idx\": item.page_idx,\n"
    "        \"translated_text\": \"\",\n"
    "    }\n"
)


def test_matching_copy_passes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "translate/records.py": _SOURCE_RECORD_BUILDER,
            "render/records.py": (
                '"""Render-local copy.\n'
                "\n"
                "Duplicated from retainpdf_pipeline.translate.records\n"
                '"""\n'
            )
            + _SOURCE_RECORD_BUILDER,
        },
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert errors == []


def test_rejects_key_added_only_on_the_source_side(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "translate/records.py": _SOURCE_RECORD_BUILDER.replace(
                '        "translated_text": "",\n',
                '        "translated_text": "",\n        "newly_added_field": "",\n',
            ),
            "render/records.py": (
                '"""Duplicated from retainpdf_pipeline.translate.records"""\n'
            )
            + _SOURCE_RECORD_BUILDER,
        },
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 1
    assert "render/records.py" in errors[0]
    assert "translate/records.py" in errors[0]
    assert "build_record" in errors[0]
    assert "newly_added_field" in errors[0]


def test_rejects_key_dropped_only_on_the_copy_side(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "translate/records.py": _SOURCE_RECORD_BUILDER,
            "render/records.py": (
                '"""Duplicated from retainpdf_pipeline.translate.records"""\n'
            )
            + _SOURCE_RECORD_BUILDER.replace('        "page_idx": item.page_idx,\n', ""),
        },
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 1
    assert "page_idx" in errors[0]


def test_rejects_diverged_closed_vocabulary(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "ocr/vocabulary.py": 'CONTENT_KINDS = ("text", "image", "table")\n',
            "render/vocabulary.py": (
                "# Duplicated from retainpdf_pipeline.ocr.vocabulary\n"
                'CONTENT_KINDS = ("text", "image")\n'
            ),
        },
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 1
    assert "CONTENT_KINDS" in errors[0]
    assert "table" in errors[0]


def test_rejects_diverged_file_name_constant(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "translate/manifest.py": 'MANIFEST_FILE_NAME = "translation-manifest.json"\n',
            "render/manifest.py": (
                "# Duplicated from retainpdf_pipeline.translate.manifest\n"
                'MANIFEST_FILE_NAME = "translation_manifest.json"\n'
            ),
        },
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 1
    assert "MANIFEST_FILE_NAME" in errors[0]


def test_accepts_intentional_partial_copy(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 「故意只抄一部分」是合法的(见 protected_formula_tokens.py 的 formula-only subset):
    # 只在一边存在的符号被跳过,两边都有的那个仍然逐字比对。
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "translate/protection.py": (
                'FORMULA_KINDS = ("formula", "inline_formula")\n'
                'GLOSSARY_KINDS = ("term", "phrase")\n'
            ),
            "render/protection.py": (
                '"""Duplicated formula-only subset of\n'
                "retainpdf_pipeline.translate.protection\n"
                '"""\n'
                'FORMULA_KINDS = ("formula", "inline_formula")\n'
            ),
        },
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert errors == []


def test_rejects_symbol_whose_shape_changed(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "ocr/aliases.py": 'ALIASES = {"figure": "image"}\n',
            "render/aliases.py": (
                "# Duplicated from retainpdf_pipeline.ocr.aliases\n"
                'ALIASES = ("figure", "image")\n'
            ),
        },
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 1
    assert "形态不同" in errors[0]
    assert "ALIASES" in errors[0]


@pytest.mark.parametrize(
    "marker",
    [
        "# Duplicated from retainpdf_pipeline.ocr.vocabulary\n",
        '"""Duplicated from:\n- retainpdf_pipeline.ocr.vocabulary\n"""\n',
        '"""Duplicated normalization from\nretainpdf_pipeline.ocr.vocabulary (``x``)\n"""\n',
        '"""Duplicated formula-only subset of\nretainpdf_pipeline.ocr.vocabulary\n"""\n',
        '"""Duplicated constants/helpers from:\n- retainpdf_pipeline.ocr.vocabulary\n"""\n',
        # 文档字符串排在 `from __future__` 之后,因此不是 ast 意义上的 docstring。
        'from __future__ import annotations\n\n"""Duplicated from retainpdf_pipeline.ocr.vocabulary"""\n',
    ],
)
def test_recognizes_every_marker_wording_in_the_repo(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    marker: str,
) -> None:
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "ocr/vocabulary.py": 'CONTENT_KINDS = ("text",)\n',
            "render/vocabulary.py": marker + 'CONTENT_KINDS = ("image",)\n',
        },
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 1, f"marker not recognized: {marker!r}"
    assert "CONTENT_KINDS" in errors[0]


def test_ignores_reverse_direction_facade_note(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # render/layout/protected_tokens.py 写的是「自己的实现被 duplicated under 别处」,
    # 方向相反,它不是副本,不该被当成配对。
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "render/facade.py": (
                '"""Render-local facade.\n'
                "\n"
                "They are now duplicated under\n"
                ":mod:`retainpdf_pipeline.render.text_analysis`\n"
                '"""\n'
                'CONTENT_KINDS = ("text",)\n'
            ),
            "render/text_analysis.py": 'CONTENT_KINDS = ("image",)\n',
        },
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert errors == []


# ---- 门禁自保 ---------------------------------------------------------------


def test_self_guard_rejects_marker_without_a_source_module(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {"render/records.py": '"""Duplicated from the translate stage."""\n'},
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 1
    assert "没写出源模块全名" in errors[0]


def test_self_guard_rejects_marker_pointing_at_a_missing_module(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {"render/records.py": '"""Duplicated from retainpdf_pipeline.translate.gone"""\n'},
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 1
    assert "不存在" in errors[0]
    assert "retainpdf_pipeline.translate.gone" in errors[0]


def test_self_guard_rejects_a_parse_that_finds_nothing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 措辞全变了、一个副本都扫不到时,门禁必须报错,而不是静默变成空操作。
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {"render/records.py": "X = 1\n"},
        floors=True,
    )
    monkeypatch.setattr(gate, "MIN_MARKED_COPIES", 5)
    monkeypatch.setattr(gate, "MIN_RESOLVED_EDGES", 5)
    monkeypatch.setattr(gate, "MIN_COMPARED_SYMBOLS", 5)
    monkeypatch.setattr(gate, "MIN_COMPARED_CONTRACT_STRINGS", 5)

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 4
    assert all("门禁自保失败" in error for error in errors)
    assert any("带副本标记的文件" in error for error in errors)


def test_self_guard_rejects_an_unparsed_required_pair(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    required = {
        ("retainpdf_pipeline/render/records.py", "retainpdf_pipeline.translate.records"): frozenset(
            {"build_record"}
        )
    }
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "translate/records.py": _SOURCE_RECORD_BUILDER,
            # 标记措辞变了 -> 配对解析不出来。
            "render/records.py": '"""Copied out of retainpdf_pipeline.translate.records"""\n'
            + _SOURCE_RECORD_BUILDER,
        },
        required=required,
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 1
    assert "门禁自保失败" in errors[0]
    assert "没能解析出指向" in errors[0]


def test_self_guard_rejects_a_required_symbol_that_stopped_being_compared(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    package_root = tmp_path / "retainpdf_pipeline"
    required = {
        (str(package_root / "render" / "records.py"), "retainpdf_pipeline.translate.records"): frozenset(
            {"build_record"}
        )
    }
    _synthetic_package(
        tmp_path,
        monkeypatch,
        {
            "translate/records.py": _SOURCE_RECORD_BUILDER,
            # 被改名 -> 不再是「两边同名」的符号 -> 悄悄退出比对。
            "render/records.py": '"""Duplicated from retainpdf_pipeline.translate.records"""\n'
            + _SOURCE_RECORD_BUILDER.replace("def build_record(", "def build_record_v2("),
        },
        required=required,
    )

    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert len(errors) == 1
    assert "门禁自保失败" in errors[0]
    assert "build_record" in errors[0]


# ---- 真实仓库 ---------------------------------------------------------------


def test_real_repository_is_free_of_stage_contract_drift() -> None:
    errors: list[str] = []
    gate.check_stage_contract_duplicates(errors)

    assert errors == []


def test_real_repository_still_covers_the_translation_record_schema() -> None:
    """判据的落点必须是真在比对 88 字段那张表,而不是「扫到了但没比」。"""
    copy_path = gate.DUPLICATE_SCAN_ROOT / "render" / "workflow" / "translation_records.py"
    source_path = gate.resolve_module_path(
        "retainpdf_pipeline.translate.core.payload.template_records"
    )
    assert source_path is not None

    modules = gate.duplicate_source_modules(copy_path)
    assert modules is not None
    assert "retainpdf_pipeline.translate.core.payload.template_records" in modules

    copy_symbols = gate.contract_symbols(copy_path)
    source_symbols = gate.contract_symbols(source_path)
    kind, keys = copy_symbols["build_translation_record"]
    assert kind == "dict-keys"
    assert len(keys) >= 50
    assert keys == source_symbols["build_translation_record"][1]
