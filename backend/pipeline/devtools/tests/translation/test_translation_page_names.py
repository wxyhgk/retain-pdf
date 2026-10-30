"""每页译文的文件名不带模型名（2026-10-30 起）：新任务写 page-001.json；升级前开始、升级后续跑的任务，这一页已有旧名字的文件就沿用旧名字。"""

from pathlib import Path

from retainpdf_translation.workflow import default_page_translation_name
from retainpdf_translation.workflow import legacy_page_translation_name
from retainpdf_translation.workflow import page_translation_path


def test_new_jobs_use_names_without_a_model(tmp_path: Path) -> None:
    assert default_page_translation_name(0) == "page-001.json"
    assert legacy_page_translation_name(11) == "page-012-deepseek.json"
    assert page_translation_path(tmp_path, 0) == tmp_path / "page-001.json"


def test_a_resumed_old_job_keeps_writing_its_old_file_names(tmp_path: Path) -> None:
    (tmp_path / "page-001-deepseek.json").write_text("[]", encoding="utf-8")
    assert page_translation_path(tmp_path, 0) == tmp_path / "page-001-deepseek.json", "no second copy of a page"
    assert page_translation_path(tmp_path, 1) == tmp_path / "page-002.json"
