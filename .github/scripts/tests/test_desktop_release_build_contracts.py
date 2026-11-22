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
    # 本仓库的包由共用脚本装（不带 --only-binary，照常从源码装）；见下面 test_every_platform_installs_*。
    assert "desktop_python_bundle.py install" in mac


def test_every_platform_installs_repo_python_packages_with_shared_script_and_checks_them():
    """v2026.11.22：三个平台各写一份「装哪些包」，后端拆出只按字符串加载的翻译引擎包
    （retainpdf-translation-classic / -agent）后三份都没跟上，翻译全报 ModuleNotFoundError；
    Windows 还因为缺 wheel、pwsh 不停在原生命令失败上，四个包都没装上照样发了。
    现在三个平台都调 ops/release/desktop_python_bundle.py：名单取后端工作区，装完用自带 python 全量检查。"""
    for name in ("build-windows-release", "build-linux-release", "build-macos-release"):
        job = _job(name)
        install = job.find("desktop_python_bundle.py install")
        check = job.find("desktop_python_bundle.py check")
        assert install >= 0 and check > install, name
        # 不再手写某个本仓库包的路径：名单只在后端工作区里。
        for package in ("base", "math", "translation", "translation-classic", "translation-agent", "pipeline"):
            assert f'RETAIN_PDF_SERVICES_ROOT/{package}"' not in job, (name, package)
            assert f'RETAIN_PDF_SERVICES_ROOT "{package}"' not in job, (name, package)
    win = _job("build-windows-release").splitlines()
    for marker in ("desktop_python_bundle.py install", "desktop_python_bundle.py check"):
        line = next(i for i, text in enumerate(win) if marker in text)
        assert win[line + 1].strip().startswith("Assert-Exit"), marker


def test_desktop_python_bundle_follows_backend_workspace():
    import importlib.util
    import tomllib

    repo = WORKFLOWS.parents[1]
    spec = importlib.util.spec_from_file_location("desktop_python_bundle", repo / "ops/release/desktop_python_bundle.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    names = [name for name, _ in module.workspace_members(repo / "backend")]
    workspace = tomllib.loads((repo / "backend/pyproject.toml").read_text(encoding="utf-8"))
    assert len(names) == len(workspace["tool"]["uv"]["workspace"]["members"])
    for required in ("retainpdf-pipeline", "retainpdf-translation-classic", "retainpdf-translation-agent"):
        assert required in names
    check = (repo / "ops/release/desktop_python_check.py").read_text(encoding="utf-8")
    # 检查要覆盖：每个模块 import、翻译引擎登记表、源码里的第三方 import。
    for needle in ("walk_packages", "retainpdf_translation.workflow.engines", "find_spec", "OPTIONAL_IMPORTS"):
        assert needle in check


def test_each_desktop_build_smokes_frontend_bundle_once_before_manifest_validation():
    for name in ("build-windows-release", "build-linux-release", "build-macos-release"):
        build = _job(name)
        assert build.count("run smoke:frontend-bundle") == 1, name
        assert build.index("run smoke:frontend-bundle") < build.index("validate_desktop_bundle.py"), name


def test_desktop_python_bundle_is_checked_on_every_backend_python_change():
    """平时就照打包的装法装一遍、查一遍，PR 上就能红，不等发版（2026-11-22 三个平台都缺翻译引擎包）。"""
    source = (WORKFLOWS / "desktop-python-bundle.yml").read_text(encoding="utf-8")
    for path in (
        "backend/*/retainpdf_*/**",
        "backend/*/pyproject.toml",
        "backend/pyproject.toml",
        "frontend/desktop/requirements-desktop-*.txt",
        "ops/release/desktop_python_*.py",
    ):
        assert source.count(f'"{path}"') == 2, path  # pull_request 和 push 各一份
    assert "ubuntu-latest" in source and "windows-latest" in source
    assert "requirements-desktop-posix.txt" in source and "requirements-desktop-windows.txt" in source
    assert source.index("desktop_python_bundle.py install") < source.index("desktop_python_bundle.py check")


def test_desktop_python_scripts_print_utf8_on_windows_consoles():
    """Windows 构建机的控制台是 cp1252：两个脚本的中文输出要先把 stdout 换成 UTF-8，
    调检查的子进程也带上 PYTHONIOENCODING（Desktop Python Bundle 第一次跑就红在 UnicodeEncodeError）。"""
    repo = WORKFLOWS.parents[1]
    for name in ("desktop_python_bundle.py", "desktop_python_check.py"):
        source = (repo / "ops/release" / name).read_text(encoding="utf-8")
        assert 'reconfigure(encoding="utf-8"' in source, name
    assert 'PYTHONIOENCODING="utf-8"' in (repo / "ops/release/desktop_python_bundle.py").read_text(encoding="utf-8")


MAC_SIGNING_SECRETS = {"MAC_CSC_LINK", "MAC_CSC_KEY_PASSWORD", "APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"}


def test_mac_signing_lives_in_its_own_workflow_with_only_the_signing_secrets():
    """Developer ID 签名和公证（2026-11-22）：打包和测试并行跑、不碰密钥，签名放在单独的 sign-macos.yml，
    只用这 5 个密钥；调用方显式一个个传，不 secrets: inherit。"""
    import re

    sign = (WORKFLOWS / "sign-macos.yml").read_text(encoding="utf-8")
    assert set(re.findall(r"secrets\.(\w+)", sign)) == MAC_SIGNING_SECRETS
    for step in ("scripts/sign-mac.mjs", "codesign --verify --deep --strict", "xcrun stapler validate",
                 "spctl --assess", "--prepackaged", "security delete-keychain"):
        assert step in sign, step
    assert "if: always()" in sign  # 钥匙串一定删
    assert "desktop-macos-app-" in (WORKFLOWS / "build-desktop-packages.yml").read_text(encoding="utf-8")
    trial = (WORKFLOWS / "mac-sign-trial.yml").read_text(encoding="utf-8")
    assert "secrets: inherit" not in trial
    assert set(re.findall(r"secrets\.(\w+)", trial)) == MAC_SIGNING_SECRETS
    assert "platforms: macos" in trial
    assert '"trial/mac-sign"' in trial
