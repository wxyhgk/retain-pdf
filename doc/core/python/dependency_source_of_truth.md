# Python 依赖单一事实来源

当前仓库的 Python 依赖真相源已经收敛到根目录的 [`pyproject.toml`](../../pyproject.toml)。

## 现在怎么维护

- 运行时依赖：
  `project.dependencies`
- 测试依赖：
  `project.optional-dependencies.test`
- Python 版本：
  `project.requires-python`
- 非 Python 二进制依赖：
  `tool.retain_pdf.external-binaries`

不要再直接手改这些生成产物：

- [`docker/requirements-app.txt`](../../docker/requirements-app.txt)
- [`docker/requirements-test.txt`](../../docker/requirements-test.txt)
- [`desktop/requirements-desktop-posix.txt`](../../desktop/requirements-desktop-posix.txt)
- [`desktop/requirements-desktop-windows.txt`](../../desktop/requirements-desktop-windows.txt)
- [`desktop/requirements-desktop-macos.txt`](../../desktop/requirements-desktop-macos.txt)

## 更新方式

修改完 [`pyproject.toml`](../../pyproject.toml) 后，执行：

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root .
```

如果只想检查是否漂移：

```bash
python backend/scripts/devtools/sync_python_requirements.py --repo-root . --check
```

## 当前口径

运行时 Python 包：

- `Pillow`
- `PyMuPDF`
- `pikepdf`
- `requests`
- `urllib3`

测试额外包：

- `pytest`

非 Python 二进制依赖：

- `typst`：必需
- `gs`：可选压缩路径依赖

## 为什么这样做

之前 Docker、desktop、CI 各自维护 requirements，容易出现：

- 某个平台漏装包
- 运行时和桌面打包版本漂移
- CI 通过，但本地或发布构建失败

现在的目标是：

- 只改一处
- 多处生成
- CI 用 `--check` 阻止漂移进入主线
