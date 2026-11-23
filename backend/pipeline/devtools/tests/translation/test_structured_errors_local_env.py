"""本机环境类失败（内存、安装包、路径长度、权限）的结构化分类。

报错文字取自 issue（#7 #38 #80 #81 #135 #143 #162），路径里的用户名、论文标题已换掉。
以前这些不是「暂未识别出明确根因」，就是被误认成渲染失败、鉴权失败。
"""

from __future__ import annotations

import errno
import json
from pathlib import Path

import requests

import retainpdf_pipeline
from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception


LONG_TITLE = "Someone 等 - 2025 - A rather long paper title about alternating current stimulation for complex oscillatory dynamics and inte"
LONG_WINDOWS_PATH = (
    "C:\\Users\\someone\\AppData\\Roaming\\retain-pdf-desktop\\data\\jobs\\20260723084017-be5283"
    f"\\artifacts\\render_prewarm\\{LONG_TITLE}-translated.source-bbox-text-stripped.pdf"
)


def _classify(raise_fn, *, default_stage: str, provider: str = "") -> dict:
    try:
        raise_fn()
    except BaseException as exc:  # noqa: BLE001
        return json.loads(classify_exception(exc, default_stage=default_stage, provider=provider).to_json())
    raise AssertionError("raise_fn did not raise")


def _assert_environment(payload: dict, code: str) -> None:
    assert payload["failure_code"] == code, payload
    assert payload["error_type"] == code
    assert payload["failure_category"] == "environment"
    assert payload["retryable"] is False
    assert payload["summary"] != "任务失败，但暂未识别出明确根因"
    assert payload["suggestion"]


# —— #38 权限 ——


def test_connection_aborted_by_local_permission_error_is_local_permission_denied() -> None:
    # #38：安全软件往 C 盘根目录写日志被拒，requests 报 Connection aborted，以前是 python_unhandled_exception
    def raise_it() -> None:
        try:
            raise PermissionError(13, "Permission denied", "C:\\nss_ssl_sfagent.log")
        except PermissionError:
            raise requests.ConnectionError(("Connection aborted.", PermissionError(13, "Permission denied")))

    payload = _classify(raise_it, default_stage="translation", provider="translation")
    _assert_environment(payload, "local_permission_denied")
    assert payload["failed_stage"] == "translation"
    assert payload["summary"] == "本机权限不足，文件或网络访问被拒绝"
    assert "安全软件" in payload["suggestion"]


def test_permission_error_only_in_text_is_recognised() -> None:
    # 只剩文字（例如 OCR 流里转述过来的）也认得出
    def raise_it() -> None:
        raise RuntimeError("('Connection aborted.', PermissionError(13, 'Permission denied'))")

    _assert_environment(_classify(raise_it, default_stage="translation"), "local_permission_denied")


def test_file_in_use_by_another_program_is_local_permission_denied() -> None:
    def raise_it() -> None:
        raise RuntimeError(
            "[WinError 32] The process cannot access the file because it is being used by another process: 'out.pdf'"
        )

    _assert_environment(_classify(raise_it, default_stage="render"), "local_permission_denied")


def test_winerror_5_without_typst_is_permission_not_typst_runtime() -> None:
    def raise_it() -> None:
        raise PermissionError("[WinError 5] Access is denied: 'C:\\Users\\someone\\out.pdf'")

    _assert_environment(_classify(raise_it, default_stage="render"), "local_permission_denied")


def test_winerror_5_launching_typst_stays_typst_runtime_failed() -> None:
    def raise_it() -> None:
        raise RuntimeError("failed to launch typst.exe: [WinError 5] Access is denied")

    payload = _classify(raise_it, default_stage="render")
    assert payload["failure_code"] == "typst_runtime_failed"


def test_http_403_is_still_auth_not_local_permission() -> None:
    class _Response:
        status_code = 403

    def raise_it() -> None:
        raise requests.HTTPError("403 Client Error: permission denied", response=_Response())

    assert _classify(raise_it, default_stage="translation")["failure_code"] == "auth_failed"


# —— #80 内存 ——


def test_memory_error_is_out_of_memory() -> None:
    # #80：约 180MB 的 document.v1.json 一次性 json.dumps
    def raise_it() -> None:
        raise MemoryError()

    payload = _classify(raise_it, default_stage="normalization", provider="ocr")
    _assert_environment(payload, "out_of_memory")
    assert payload["failed_stage"] == "normalization"
    assert payload["summary"] == "内存不足，处理中断"
    assert "页数" in payload["suggestion"]


def test_memory_error_wrapped_in_another_exception_is_out_of_memory() -> None:
    def raise_it() -> None:
        try:
            raise MemoryError()
        except MemoryError as exc:
            raise RuntimeError("normalize failed") from exc

    _assert_environment(_classify(raise_it, default_stage="normalization"), "out_of_memory")


# —— #7 #135 #143 #162 运行环境 ——


def test_missing_module_is_runtime_environment_broken() -> None:
    # #7：桌面包漏打 PyMuPDF；#143：Windows 上没有 fcntl
    def raise_it() -> None:
        raise ModuleNotFoundError("No module named 'fitz'", name="fitz")

    payload = _classify(raise_it, default_stage="normalization", provider="ocr")
    _assert_environment(payload, "runtime_environment_broken")
    assert payload["failed_stage"] == "normalization"
    assert "重新安装" in payload["suggestion"]


def test_undefined_symbol_is_runtime_environment_broken() -> None:
    # #162：deb 包的 _ssl 链到系统 python3.14 的 libpython
    def raise_it() -> None:
        raise ImportError(
            "/opt/RetainPDF/resources/backend/python/lib/python3.11/lib-dynload/"
            "_ssl.cpython-311-x86_64-linux-gnu.so: undefined symbol: _PyModule_Add"
        )

    _assert_environment(_classify(raise_it, default_stage="translation"), "runtime_environment_broken")


def test_missing_package_data_file_is_runtime_not_render() -> None:
    # #135：OCR worker import 期读安装包里的 latex_commands.json 失败，traceback 里有 direct_typst_math.py，
    # 以前被认成 render_failed「排版或编译阶段失败」
    missing = "/usr/local/lib/python3.11/site-packages/retainpdf_pipeline/foundation/shared/latex_commands.json"

    def direct_typst_math_module_import() -> None:
        raise FileNotFoundError(2, "No such file or directory", missing)

    for stage in ("normalization", "render"):
        payload = _classify(direct_typst_math_module_import, default_stage=stage, provider="ocr")
        _assert_environment(payload, "runtime_environment_broken")
        assert payload["failure_code"] != "render_failed"


def test_missing_file_inside_our_own_package_is_runtime_environment_broken() -> None:
    missing = str(Path(retainpdf_pipeline.__file__).parent / "foundation" / "shared" / "gone.json")

    def raise_it() -> None:
        raise FileNotFoundError(2, "No such file or directory", missing)

    _assert_environment(_classify(raise_it, default_stage="normalization"), "runtime_environment_broken")


def test_missing_job_file_in_render_stage_is_still_render_failed() -> None:
    def raise_it() -> None:
        raise FileNotFoundError(2, "No such file or directory", "/data/jobs/20260101-abc/rendered/page-1.typ")

    payload = _classify(raise_it, default_stage="render")
    assert payload["failure_code"] == "render_failed"


# —— #79 #81 路径过长 ——


def test_long_windows_path_file_not_found_is_path_too_long() -> None:
    # #81：渲染中间文件名带上了很长的论文标题，pikepdf.save 报找不到文件；以前先被说成 auth_failed，后来是 render_failed
    assert len(LONG_WINDOWS_PATH) >= 260

    def raise_it() -> None:
        raise FileNotFoundError(2, "No such file or directory", LONG_WINDOWS_PATH)

    payload = _classify(raise_it, default_stage="render", provider="rendering")
    _assert_environment(payload, "path_too_long")
    assert payload["failed_stage"] == "render"
    assert payload["failure_code"] not in {"auth_failed", "render_failed"}
    assert "LongPathsEnabled" in payload["suggestion"]


def test_long_windows_path_only_in_message_is_path_too_long() -> None:
    # pikepdf 抛的 FileNotFoundError 不一定带 filename 属性，只剩 repr 过的文字（反斜杠成对）
    escaped = LONG_WINDOWS_PATH.replace("\\", "\\\\")

    def raise_it() -> None:
        raise FileNotFoundError(f"[Errno 2] No such file or directory: '{escaped}'")

    _assert_environment(_classify(raise_it, default_stage="render"), "path_too_long")


def test_name_too_long_errno_and_winerror_206_are_path_too_long() -> None:
    def enametoolong() -> None:
        raise OSError(errno.ENAMETOOLONG, "File name too long")

    def winerror_206() -> None:
        raise OSError("[WinError 206] The filename or extension is too long: 'C:\\x'")

    _assert_environment(_classify(enametoolong, default_stage="render"), "path_too_long")
    _assert_environment(_classify(winerror_206, default_stage="render"), "path_too_long")


def test_short_windows_path_file_not_found_is_not_path_too_long() -> None:
    def raise_it() -> None:
        raise FileNotFoundError(2, "No such file or directory", "C:\\Users\\someone\\out.pdf")

    assert _classify(raise_it, default_stage="render")["failure_code"] == "render_failed"
