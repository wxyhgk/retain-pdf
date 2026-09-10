# Legacy Reader 当前状态

旧 pdf.js Reader 引擎已经从当前生产链路移除。此文件保留用于说明边界，避免历史注释或文件名被误认为仍受支持的回退能力。

## 当前事实

- `frontend/web/reader.html` 只加载 `dist/reader.bundle.js`。
- `frontend/web/src/pages/reader/entry.tsx` 注册 RetainPDF adapters 后调用 `@retainpdf/reader/boot`。
- `frontend/packages/reader/src/boot.tsx` 始终挂载 react-pdf `ReaderApp`，没有 engine 选择分支。
- `frontend/web` 已不存在 `src/pages/reader/legacy`、`src/js/reader` 或 `src/styles/entries/reader-legacy.css`。
- 当前 CSS 构建只生成 `home.css`、`detail.css` 和 `reader.css`。
- `?engine=legacy` 不再是受支持的运行时入口；旧书签中的该参数不会启用另一套引擎。

## 仍可能看到的 `legacy` 名称

仓库中保留少量历史命名，含义不等同于旧引擎仍存在：

- payload、localStorage 或字段读取中的 `legacy`：兼容旧数据形状；
- `frontend/packages/reader/styles/*-legacy.css` 等文件：未被当前样式入口导入的历史分片；
- `frontend/web/dist/css/reader-legacy.css`：旧构建留下的跟踪产物，不是当前构建输出；
- 注释中的 “对齐 legacy”：描述交互语义来源，不是运行时依赖。

新增功能不得接入这些历史分片，也不要恢复按查询参数切换引擎的分支。若确需重新提供第二阅读引擎，应按新功能重新设计公开包入口、adapter 契约、CSS 产物和测试，而不是复活旧路径。

## 检查命令

```bash
# Web 宿主应只有当前 Reader 入口和 adapters
find frontend/web/src/pages/reader -type f | sort

# 当前构建入口不应包含 reader-legacy
rg -n "reader-legacy|engine=legacy" \
  frontend/web/scripts/build-css.mjs \
  frontend/web/src/styles/entries \
  frontend/web/src/pages/reader

# Reader boot 应只挂载当前 ReaderApp
sed -n '1,200p' frontend/packages/reader/src/boot.tsx
```
