"""外部可执行程序的定位。

流水线会调用一些不随 Python 包一起安装的二进制（目前只有 typst）。每种发行
形态各自负责把它准备好：

- 桌面端在 spawn 后端进程前把 ``TYPST_BIN`` 指向随包发行的那一份
  （``frontend/desktop/src/main/backend-env.js``）；
- Docker 镜像把 typst 装进 ``/usr/local/bin``，直接在 PATH 上；
- 本地开发 checkout 两者都没有，需要开发者自己安装。

所以定位失败只可能发生在第三种情况，而且应该说清楚怎么修，而不是回落到某个
平台专属的猜测路径——那样只会在别的平台上抛一个没有上下文的
``FileNotFoundError``。
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path


class ExternalToolNotFound(RuntimeError):
    """需要的外部可执行程序不存在或不可执行。"""


def _resolve_command(command: str) -> str | None:
    """把一条命令解析成可执行文件的绝对路径，解析不到则返回 None。

    带路径分隔符的当成路径校验，裸名字的走 PATH 查找，这样 ``TYPST_BIN`` 既可以
    填绝对路径，也可以填一个依赖 PATH 的命令名。
    """
    separators = [os.sep] + ([os.altsep] if os.altsep else [])
    if any(separator in command for separator in separators):
        candidate = Path(command)
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
        return None
    return shutil.which(command)


def resolve_typst_bin() -> str:
    """定位 typst 可执行文件；每次调用都重新解析。

    不缓存到模块级常量：导入时机早于调用时机，缓存会让"先 import 再设
    ``TYPST_BIN``"的调用方拿到过期的值。
    """
    explicit = os.environ.get("TYPST_BIN", "").strip()
    if explicit:
        resolved = _resolve_command(explicit)
        if resolved:
            return resolved
        raise ExternalToolNotFound(
            f"TYPST_BIN 指向 {explicit!r}，但它不是一个可执行文件。"
            "请把它改成 typst 可执行文件的路径，或清空该变量改用 PATH 查找。"
        )
    discovered = shutil.which("typst")
    if discovered:
        return discovered
    raise ExternalToolNotFound(
        "未找到 typst 可执行文件：TYPST_BIN 未设置，PATH 里也没有 typst。"
        "桌面端和 Docker 镜像都自带 typst，出现这个错误通常是在本地开发环境里——"
        "安装 typst 并加入 PATH，或把 TYPST_BIN 指向可执行文件即可。"
    )
