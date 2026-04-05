# Embedded Python

桌面版打包时，这个目录用于携带内置 Python 运行时。
当前目录位置为 `backend/python/`。

当前仓库默认不跟踪完整运行时二进制，只保留这个说明文件。

- 本地手工打包时：可以直接把完整可运行的 Windows Python 放进 `backend/python/`
- GitHub Actions 打 Windows Release 时：会在 CI 上自动下载并组装一份可分发 Python 运行时，再打进 `Setup.exe`
- 也就是说，GitHub 上的 Windows 安装包不依赖仓库里预提交的 `python.exe`

约定结构：

```text
backend/python/
  python.exe
  python311.dll
  Lib/
  DLLs/
  Scripts/
```

最低要求：

- Windows 打包时，目录内必须存在 `python.exe`
- 该 Python 需要已经安装桌面版运行所需依赖
- `desktop_app` 打包时会通过 Tauri `resources` 一起带入安装包

桌面端启动时的 Python 查找顺序：

1. 环境变量 `DESKTOP_PYTHON_BIN`
2. 打包资源目录 `python/python.exe`
3. 仓库根目录 `backend/python/python.exe`
4. 仓库根目录 `.venv/Scripts/python.exe`
5. 系统 `python`

如果你希望桌面版完全脱离用户机器环境，应该把完整可运行的 Python 放到这里。
