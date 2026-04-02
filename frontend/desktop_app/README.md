# Desktop App

Tauri 桌面壳工程。

当前职责：

- 承载 Windows 桌面窗口
- 管理本地配置
- 启动内嵌 `rust_api`
- 复用 `frontend` 作为静态前端
- 打包时携带 `backend/scripts/` 与内置 `backend/python/`

## 开发

```bash
cd /home/wxyhgk/tmp/Code/frontend/desktop_app
npm install
npm run tauri:dev
```

## 打包说明

桌面版如果要脱离用户机器上的 Python 环境，必须在仓库根目录准备：

```text
/home/wxyhgk/tmp/Code/backend/python/python.exe
```

以及对应的标准库和依赖。

当前桌面端启动时的 Python 查找顺序：

1. `DESKTOP_PYTHON_BIN`
2. 打包资源中的 `python/python.exe`
3. 仓库根目录 `backend/python/python.exe`
4. 仓库根目录 `.venv/Scripts/python.exe`
5. 系统 `python`

如果打包后的 Windows 应用报：

- `Rust API worker crashed`

优先检查：

- 打包资源里是否真的带了 `python/`
- `backend/python/python.exe` 是否存在
- 该 Python 是否已安装项目运行依赖
