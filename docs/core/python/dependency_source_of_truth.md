# Python 依赖单一事实来源

Python 后端按可部署单元维护依赖：

- Pipeline：[`backend/pipeline/pyproject.toml`](../../../backend/pipeline/pyproject.toml)
- 后端工作区 [`backend/pyproject.toml`](../../../backend/pyproject.toml) 只组合 uv
  workspace，不再重复声明成员的第三方依赖

## 现在怎么维护

- 各服务运行时依赖：对应成员的 `project.dependencies`
- 各服务测试依赖：对应成员的 `project.optional-dependencies.test`
- Python 版本：
  `project.requires-python`
- 非 Python 二进制依赖：
  `tool.retain_pdf.external-binaries`

不要再直接手改这些生成产物：

- `ops/deployment/docker/requirements-app.txt`
- `ops/deployment/docker/requirements-test.txt`
- `frontend/desktop/requirements-desktop-*.txt`

## 更新方式

修改成员 `pyproject.toml` 后，执行：

```bash
python backend/pipeline/devtools/sync_python_requirements.py --repo-root .
```

如果只想检查是否漂移：

```bash
python backend/pipeline/devtools/sync_python_requirements.py --repo-root . --check
```

## 桌面安装包里的本仓库 Python 包

2026-11-22 起，三个平台的桌面安装包都用 `ops/release/desktop_python_bundle.py` 装本仓库的 Python 包：

- 装哪些：只看 `backend/pyproject.toml` 的 `[tool.uv.workspace].members`。新加的包登记进工作区就会被打进安装包，
  不用改打包脚本。以前三个平台各写一份名单，后端拆出只按字符串加载的翻译引擎包（`retainpdf-translation-classic`、
  `retainpdf-translation-agent`）后名单没跟上，v2026.11.22 的翻译在三个平台上都报 `ModuleNotFoundError`。
- 装完检查（`ops/release/desktop_python_check.py`，用安装包自带的 Python 跑，失败就让构建失败）：
  工作区包和它们声明的依赖都装了；每个模块都能 import；翻译引擎登记表里的入口都能加载；源码里所有 import
  （含函数里面的）指向的第三方库都装了。确实可选的第三方库写进 `OPTIONAL_IMPORTS` 并写明理由。
- 平时：`.github/workflows/desktop-python-bundle.yml` 在后端 Python 包、桌面依赖清单改动时，
  照同样的装法在 Linux 和 Windows 上装一遍、查一遍，PR 上就能发现，不等发版。

本地照着查一遍：

```bash
python -m venv /tmp/bundle-venv && /tmp/bundle-venv/bin/python -m pip install -r frontend/desktop/requirements-desktop-posix.txt
python ops/release/desktop_python_bundle.py install --pip-python /tmp/bundle-venv/bin/python
python ops/release/desktop_python_bundle.py check --python /tmp/bundle-venv/bin/python
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
- `python-docx`（Word export 测试）

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
