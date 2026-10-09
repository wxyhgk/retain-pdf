# rpr 排版引擎（render.engine = "rpr"）

`engine/` 是 [retain-pdf-rendering](https://github.com/wxyhgk/retain-pdf-rendering)（MIT）运行时文件的**复制品**，
固定在 `UPSTREAM` 记录的提交上。不用 npm git 依赖或子模块：Docker 镜像和桌面包构建时不能依赖联网拉 GitHub。

| 文件 | 作用 |
| --- | --- |
| `engine/` | 引擎源码最小集合（`bin/rpr-retain.js`、`bin/rpr-fit.js`、`src/`、`data/fonts`（宽度表与后备字体；思源宋体用本仓库 `resources/fonts` 那份，`sync.sh` 不复制）、`package.json`、`LICENSE`）与 `COMMIT` |
| `package.json` / `package-lock.json` | 运行时 npm 依赖：`mathjax-full`（锁 3.2.1，公式）与 `fontkit`（锁 2.0.4，引擎直接写 PDF 时嵌入、整形字体） |
| `UPSTREAM` | 来源仓库、ref、提交号、同步时间 |
| `sync.sh` | 从引擎仓库指定提交重新复制 `engine/` |

**不要直接改 `engine/` 里的文件**：改引擎仓库，再 `./sync.sh <提交>` 同步过来。

## 开发环境

需要 Node ≥ 22.8。引擎自己写 PDF，不需要 Typst（只有设 `RETAIN_RPR_ENGINE_OUTPUT=typst` 对照时才用 Typst 0.15.1）。

```sh
cd backend/rendering-engine
npm ci --omit=dev --ignore-scripts   # 装 mathjax-full、fontkit 到 ./node_modules（已被 gitignore）
```

没装的话 rpr 路线会回退 Typst（`pipeline_summary.render_engine.fallback_reason = engine_dependencies_missing`），任务不失败。

同步新版本引擎：

```sh
backend/rendering-engine/sync.sh                      # 默认 ~/Code/retain-pdf-rendering 的 main
backend/rendering-engine/sync.sh <ref> <引擎仓库路径>
```

## Python 侧怎么找它

见 `backend/pipeline/retainpdf_pipeline/render/output/rpr/engine_cli.py`：

- 引擎目录：`RETAIN_RPR_ENGINE_DIR`，未设置时用仓库里的本目录；
- Node：`RETAINPDF_NODE_BIN`（桌面端指向 Electron 本体，配 `ELECTRON_RUN_AS_NODE=1`）→ PATH 里的 `node`；
- 字体：目录与 Typst 路线相同（`RETAIN_PDF_TYPST_FONT_DIRS` 等，含 `resources/fonts` 的思源宋体），用 `--font-path` 传给引擎；引擎再找自带的 `data/fonts/fallback`（Typst 内置的那几个后备字体，授权见其 NOTICE）。
- 输出：默认 `--output pdf`（引擎直接写 PDF）；`RETAIN_RPR_ENGINE_OUTPUT=typst` 改用引擎的 Typst 输出（需要 `TYPST_BIN` → PATH），只用于对照。

打包：Docker（`ops/deployment/docker/backend/Dockerfile.app` 的 `rprengine` 阶段，拷到
`/app/services/rendering-engine`）与桌面端（`frontend/desktop/scripts/prepare-app.mjs`，拷到
`app/backend/rendering-engine`）都会删掉 `mathjax-full` 里用不到的 `es5/`、`ts/`、`components/`。

## CLI 契约

```
node engine/bin/rpr-retain.js --input in.json --out-dir DIR [--output pdf|typst] [--typst BIN] [--font-path DIR]...
```

输入 `rpr_retain_input_v1`、输出 `DIR/overlay.pdf` + `DIR/report.json`（`rpr_retain_report_v1`），
细节见引擎仓库 README 的「retain-pdf 接入（CLI）」一节。退出码 0 成功；2 输入错误；1 其他，stderr 一行 `{"error": "..."}`。

## 调试：layout.json

引擎直接写 PDF 时，在输出目录（rpr_fit：`rendered/typst/rpr-fit-engine/out/`，rpr：`rendered/typst/rpr-engine/out/`）
里同时写 `layout.json`（schema `rpr_layout_v1`）：PDF 只从它画出。逐行记录整行文字、基线、每个字簇的
横坐标与文字、每个公式的 LaTeX 与盒子，坐标单位 pt、原点在页面左上角、y 朝下（与 OCR 框同一坐标系）。
看、比对或手改它之后重画：

```bash
node engine/bin/rpr-layout-pdf.js --layout <out>/layout.json --out /tmp/overlay.pdf --font-path resources/fonts
```

没改过的文件重画出逐字节相同的 PDF。重画的是叠加层；要看成品，把它叠回底图（rpr_fit 的
`rpr-fit-base.pdf`）即可。

