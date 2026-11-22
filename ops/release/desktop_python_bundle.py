"""桌面安装包里的本仓库 Python 包：三个平台共用这一份（.github/workflows/build-desktop-packages.yml 调它）。

以前三个平台各写一份「装哪些包」：后端把翻译引擎拆成 retainpdf-translation-classic / -agent 以后
（它们只按字符串加载，不在任何包的依赖里），三份名单都没跟着改，v2026.11.22 的三个平台翻译都报
ModuleNotFoundError。现在：

- 装哪些包只看后端工作区（backend/pyproject.toml 的 [tool.uv.workspace].members），后端加包自动跟上；
- 先装 wheel / setuptools（缺 wheel 时 --no-build-isolation 报 invalid command 'bdist_wheel'）；
- 装完用安装包自带的 Python 跑 desktop_python_check.py：工作区包和它们的依赖都在、每个模块能 import、
  翻译引擎入口能加载、源码里 import 的第三方库都装了。任何一步失败退出码非 0，构建跟着失败。

用法：
  python ops/release/desktop_python_bundle.py members
  python ops/release/desktop_python_bundle.py install --pip-python <装包用的 python> [--target <site-packages>]
  python ops/release/desktop_python_bundle.py check --python <安装包自带的 python> [--pythonpath <site-packages>]
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CHECK_SCRIPT = Path(__file__).with_name("desktop_python_check.py")


def services_root() -> Path:
    return Path(os.environ.get("RETAIN_PDF_SERVICES_ROOT") or REPO_ROOT / "backend").resolve()


def workspace_members(root: Path | None = None) -> list[tuple[str, Path]]:
    """后端工作区成员：[(包名, 目录)]，按工作区里写的顺序。"""
    root = root or services_root()
    workspace = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    members = workspace["tool"]["uv"]["workspace"]["members"]
    result = []
    for member in members:
        directory = (root / member).resolve()
        project = tomllib.loads((directory / "pyproject.toml").read_text(encoding="utf-8"))["project"]
        result.append((project["name"], directory))
    return result


def run(command: list[str], **kwargs) -> None:
    print("+ " + " ".join(str(part) for part in command), flush=True)
    result = subprocess.run(command, **kwargs)
    if result.returncode != 0:
        raise SystemExit(f"失败（exit={result.returncode}）：{' '.join(str(part) for part in command)}")


def install(pip_python: str, target: str = "") -> None:
    run([pip_python, "-m", "pip", "install", "--upgrade", "wheel", "setuptools"])
    for name, directory in workspace_members():
        command = [pip_python, "-m", "pip", "install", "--no-deps", "--no-build-isolation"]
        if target:
            command += ["--target", target, "--upgrade"]
        run([*command, str(directory)])
        print(f"installed {name}", flush=True)


def check(python: str, pythonpath: str = "") -> None:
    # 下面换了工作目录，相对路径（如 .bundle-venv/bin/python）先变成绝对路径；只写命令名的照 PATH 找。
    python = os.path.abspath(python) if Path(python).exists() else (shutil.which(python) or python)
    env = dict(os.environ)
    if pythonpath:
        env["PYTHONPATH"] = pythonpath
    names = ",".join(name for name, _ in workspace_members())
    # 在临时目录里跑：不让仓库里的源码目录混进 sys.path，查的只能是装进去的那份。
    run([python, str(CHECK_SCRIPT), "--members", names], env=env, cwd=str(Path(CHECK_SCRIPT).anchor))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("members")
    install_parser = sub.add_parser("install")
    install_parser.add_argument("--pip-python", default=sys.executable)
    install_parser.add_argument("--target", default="")
    check_parser = sub.add_parser("check")
    check_parser.add_argument("--python", required=True)
    check_parser.add_argument("--pythonpath", default="")
    args = parser.parse_args(argv)
    if args.command == "members":
        for name, directory in workspace_members():
            print(f"{name}\t{directory}")
    elif args.command == "install":
        install(args.pip_python, args.target)
    else:
        check(args.python, args.pythonpath)
    return 0


if __name__ == "__main__":
    sys.exit(main())
