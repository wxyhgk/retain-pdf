# rpr 排版引擎（render.engine = "rpr"）

`engine/` 是 [retain-pdf-rendering](https://github.com/wxyhgk/retain-pdf-rendering)（MIT）运行时文件的**复制品**，
固定在 `UPSTREAM` 记录的提交上。不用 npm git 依赖或子模块：Docker 镜像和桌面包构建时不能依赖联网拉 GitHub。

| 文件 | 作用 |
| --- | --- |
| `engine/` | 引擎源码最小集合（`bin/rpr-retain.js`、`src/{text,typeset,output,retain}`、`data/fonts`、`package.json`、`LICENSE`）与 `COMMIT` |
| `package.json` / `package-lock.json` | 运行时 npm 依赖，只有 `mathjax-full`（锁 3.2.1） |
| `UPSTREAM` | 来源仓库、ref、提交号、同步时间 |
| `sync.sh` | 从引擎仓库指定提交重新复制 `engine/` |

**不要直接改 `engine/` 里的文件**：改引擎仓库，再 `./sync.sh <提交>` 同步过来。

## 开发环境

需要 Node ≥ 22.8 和 Typst 0.15.1（与 Typst 路线同一个）。

```sh
cd backend/rendering-engine
npm ci --omit=dev --ignore-scripts   # 装 mathjax-full 到 ./node_modules（已被 gitignore）
```

没装的话 rpr 路线会回退 Typst（`pipeline_summary.render_engine.fallback_reason = engine_dependencies_missing`），任务不失败。

同步新版本引擎：

```sh
backend/rendering-engine/sync.sh                      # 默认 ~/Code/retain-pdf-rendering-api 的 feat/retain-overlay-api
backend/rendering-engine/sync.sh <ref> <引擎仓库路径>
```

## Python 侧怎么找它

见 `backend/pipeline/retainpdf_pipeline/render/output/rpr/engine_cli.py`：

- 引擎目录：`RETAIN_RPR_ENGINE_DIR`，未设置时用仓库里的本目录；
- Node：`RETAINPDF_NODE_BIN`（桌面端指向 Electron 本体，配 `ELECTRON_RUN_AS_NODE=1`）→ PATH 里的 `node`；
- Typst：`TYPST_BIN` → PATH；字体目录与 Typst 路线相同（`RETAIN_PDF_TYPST_FONT_DIRS` 等），用 `--font-path` 传给引擎。

打包：Docker（`ops/deployment/docker/backend/Dockerfile.app` 的 `rprengine` 阶段，拷到
`/app/services/rendering-engine`）与桌面端（`frontend/desktop/scripts/prepare-app.mjs`，拷到
`app/backend/rendering-engine`）都会删掉 `mathjax-full` 里用不到的 `es5/`、`ts/`、`components/`。

## CLI 契约

```
node engine/bin/rpr-retain.js --input in.json --out-dir DIR [--typst BIN] [--font-path DIR]...
```

输入 `rpr_retain_input_v1`、输出 `DIR/overlay.pdf` + `DIR/report.json`（`rpr_retain_report_v1`），
细节见引擎仓库 README 的「retain-pdf 接入（CLI）」一节。退出码 0 成功；2 输入错误；1 其他，stderr 一行 `{"error": "..."}`。
