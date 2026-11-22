"""桌面端构建步骤（build-desktop-packages.yml）里与耗时相关的约束。"""
from pathlib import Path
import re


WORKFLOWS = Path(__file__).resolve().parents[2] / "workflows"


def _job(name: str) -> str:
    source = (WORKFLOWS / "build-desktop-packages.yml").read_text(encoding="utf-8")
    match = re.search(rf"^  {re.escape(name)}:\n(.*?)(?=^  [\w-]+:|\Z)", source, re.M | re.S)
    assert match is not None, f"missing {name}"
    return match.group(1)


def test_macos_python_bundle_uses_prebuilt_wheels_without_homebrew_qpdf():
    """pikepdf 的 macOS wheel 自带 qpdf，brew install qpdf 只是白花 0.4–1.1 分钟；
    改成只装 wheel，缺 wheel 时直接失败，不会悄悄源码编译。"""
    mac = _job("build-macos-release")
    assert "brew install" not in mac
    assert "brew update" not in mac
    assert "qpdf_prefix" not in mac
    for requirements in ("requirements-desktop-posix.txt",):
        line = next(line for line in mac.splitlines() if f"-r frontend/desktop/{requirements}" in line)
        assert "--only-binary=:all:" in line
    # retainpdf-pipeline 是本仓库源码，必须照常从源码装，不能被 --only-binary 拦掉。
    pipeline = next(line for line in mac.splitlines() if '"$RETAIN_PDF_SERVICES_ROOT/pipeline"' in line)
    assert "--no-deps" in pipeline
    assert "--only-binary" not in pipeline
    # 公式包 retainpdf-math 也是本仓库源码：pipeline 依赖它，--no-deps 不会替我们装，必须先装。
    math = next(line for line in mac.splitlines() if '"$RETAIN_PDF_SERVICES_ROOT/math"' in line)
    assert "--no-deps" in math and "--only-binary" not in math
    assert mac.index('"$RETAIN_PDF_SERVICES_ROOT/math"') < mac.index('"$RETAIN_PDF_SERVICES_ROOT/pipeline"')
    # 底座包 retainpdf-base 同理：pipeline 依赖它（阶段事件、JSON 落盘、路径），也得先装。
    base = next(line for line in mac.splitlines() if '"$RETAIN_PDF_SERVICES_ROOT/base"' in line)
    assert "--no-deps" in base and "--only-binary" not in base
    assert mac.index('"$RETAIN_PDF_SERVICES_ROOT/base"') < mac.index('"$RETAIN_PDF_SERVICES_ROOT/pipeline"')
    # 翻译包 retainpdf-translation 同理：pipeline 的翻译 worker 外壳调它，也得先装。
    translation = next(line for line in mac.splitlines() if '"$RETAIN_PDF_SERVICES_ROOT/translation"' in line)
    assert "--no-deps" in translation and "--only-binary" not in translation
    assert mac.index('"$RETAIN_PDF_SERVICES_ROOT/translation"') < mac.index('"$RETAIN_PDF_SERVICES_ROOT/pipeline"')


def test_windows_python_bundle_installs_wheel_first_and_fails_on_native_errors():
    """v2026.11.22 的 Windows 包四个本仓库 Python 包都没装上（缺 wheel，invalid command
    'bdist_wheel'），import 检查也报错，但 pwsh 不因原生命令失败而停，构建照样成功、坏包发了出去。
    现在：先装 wheel；每个 pip install 和 import 检查后都查 $LASTEXITCODE，失败就让构建失败。"""
    win = _job("build-windows-release")
    lines = win.splitlines()
    wheel = next(i for i, line in enumerate(lines) if "pip install --upgrade wheel" in line)
    for package in ("base", "math", "translation"):
        install = next(i for i, line in enumerate(lines) if f'RETAIN_PDF_SERVICES_ROOT "{package}"' in line)
        assert wheel < install, package
    installs = [i for i, line in enumerate(lines) if "pip install" in line and "--target $sitePackages" in line]
    assert len(installs) >= 5
    for i in installs:
        following = lines[i + 1].strip()
        assert following.startswith("Assert-Exit") or "$LASTEXITCODE -ne 0" in following, lines[i].strip()
    check = next(i for i, line in enumerate(lines) if "python_bundle_import_check=ok" in line)
    assert "retainpdf_pipeline" in lines[check]
    assert lines[check + 1].strip().startswith("Assert-Exit")


def test_each_desktop_build_smokes_frontend_bundle_once_before_manifest_validation():
    for name in ("build-windows-release", "build-linux-release", "build-macos-release"):
        build = _job(name)
        assert build.count("run smoke:frontend-bundle") == 1, name
        assert build.index("run smoke:frontend-bundle") < build.index("validate_desktop_bundle.py"), name
