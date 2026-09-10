# resources

此目录保存仓库级的品牌、动画、样例和设计参考资源，不是后端源码或 runtime
目录。

## 分类

- `brand/`：Logo、二维码和发布展示图。
- `animations/`：加载和阶段动效素材。
- `samples/`：可公开的小型测试输入。
- 设计参考稿已经迁入 `experiments/claude-design/`，不作为生产前端入口。
- OCR 参考文档已经迁入 `docs/reference/ocr/`。
- `fonts/`：默认排版字体及再分发许可证。
- `runtime/`：预留的资源归档入口；不要在这里提交凭据或可再生成的大型二进制。
- `misc/`：现有未归类资源，暂时保留；新文件应按所有者归类，不继续扩充。

## 当前源码与运行资源位置

- 后端源码：[`backend/`](../backend/README.md)
- Web 应用：`frontend/web/`
- Reader 包：`frontend/packages/reader/`
- Docker / 发布基础设施：`ops/deployment/` 与 `ops/release/`
- 字体：`resources/fonts/`
- Windows Typst runtime 元数据：`ops/deployment/typst/win32/`
- 任务数据：本轮不迁移现有运行目录，以实际运行配置为准

不要把源码重新放入旧 `services/` 或 `apps/` 路径。后端构建产物例如
`target/` 可以重新生成，应保持忽略；运行数据和模型/OCR 密钥也不应
提交到 `resources/`。
