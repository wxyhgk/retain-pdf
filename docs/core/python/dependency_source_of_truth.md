# Python 依赖单一事实来源

Python 后端按可部署单元维护依赖：

- Pipeline：[`backend/pipeline/pyproject.toml`](../../../backend/pipeline/pyproject.toml)
- 后端工作区 [`backend/pyproject.toml`](../../../backend/pyproject.toml) 只组合 uv
  workspace，不再重复声明成员的第三方依赖

## 现在怎么维护

- 各服务运行时依赖：对应成员的 `project.dependencies`
- 各服务测试依赖：对应成员的 `project.optional-dependencies.test`
- 可选功能的依赖：成员的其他 extra。现在只有 pipeline 的 `scan-ocr`（`rapidocr`、`onnxruntime`，扫描件的公式编号截图识别，2026-11-26）：
  后端工作区依赖 `retainpdf-pipeline[scan-ocr]`，开发环境、CI、Docker（`uv export` 工作区）都装；生成的 Docker 清单带上它，
  桌面清单只放必装依赖（没装时这一步自己跳过）
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

### Linux 安装包里的 Python 本体和 glibc 基线（2026-11-23）

Linux 的 `.deb` 以前把构建机 `actions/setup-python` 工具缓存里的 Python 整个拷进来，问题有三个（issue #162）：
RUNPATH 写死成 `/opt/hostedtoolcache/...`，用户机器上会载到系统里另一份 libpython（`undefined symbol: _PyModule_Add`）；
它在 `ubuntu-latest`（26.04 一代）上编译，libpython 要 GLIBC_2.38、`termios` 要 2.42，Ubuntu 22.04、Debian 12 起不来；
`_ssl`、`_sqlite3`、`_ctypes`、`_lzma` 等要系统的 `libssl.so.3`、`libffi.so.8`、`libsqlite3.so.0`……，deb 没声明。

现在（`.github/workflows/build-desktop-packages.yml` 的 Linux job）：

- Python 用 [python-build-standalone](https://github.com/astral-sh/python-build-standalone) 的
  `cpython-3.11.x-x86_64-unknown-linux-gnu-install_only_stripped`，地址和 SHA256 钉在 workflow 顶部的
  `LINUX_PYTHON_STANDALONE_URL` / `LINUX_PYTHON_STANDALONE_SHA256`，下载后 `sha256sum -c` 校验。它的解释器静态带着
  libpython，OpenSSL、SQLite、libffi、xz、bzip2、zlib、uuid 都编在里面，RUNPATH 只有 `$ORIGIN`，只要 GLIBC_2.17。
  换版本：从那次 release 的 `SHA256SUMS` 抄校验和，小版本和其他平台保持一致（现在 3.11）。
- 解开后删掉 Tcl/Tk 和 `_tkinter`（RUNPATH 是打包机的 `/tools/deps/lib`）、`_crypt`（唯一要系统 `libcrypt.so.1` 的模块）、
  `lib/libpython3.*.so*`（解释器已静态带着，只给嵌入用）；第三方包只装 manylinux 轮子（`--only-binary=:all:`）。
- Rust（`rust_api`、`retain-jobsd`、`retainpdf`）用 `cargo zigbuild --target x86_64-unknown-linux-gnu.2.28` 按 glibc 2.28
  链接，构建机是哪一代系统都一样；预热 workflow 的命令逐字相同。typst 用的是 musl 静态版，不要 glibc。
- 打完包解开 `.deb` 跑 `.github/scripts/check_linux_glibc_baseline.py`：每个 ELF 要的 glibc 不许超过
  `LINUX_GLIBC_BASELINE`（2.28，Debian 10 / RHEL 8 / Ubuntu 20.04 起；Electron 44 自己要 2.25）；自带 Python 下的
  ELF 只许依赖 glibc 自己的库、`libgcc_s` / `libstdc++` / `libz`（manylinux 允许，dpkg 自己就依赖）和包里自带的文件。
  轮子升级到更新的 manylinux、有人改回在构建机上编，都会在这一步红。
- `relocate_linux_python_runpath.py` 留作兜底：`relocate` 去掉非 `$ORIGIN` 的 RUNPATH，`check` 清掉 `LD_LIBRARY_PATH`
  跑包里的 python3，导入 ssl、sqlite3、ctypes 等。

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
