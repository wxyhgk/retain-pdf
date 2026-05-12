# Python 后端文档

这里记录 Python 后端架构、运行时、测试依赖和 Pipeline 依赖生成规则。

建议阅读顺序：

1. [Python 后端架构边界](./architecture.md)
2. [Python 依赖单一事实来源](./dependency_source_of_truth.md)
3. [Pipeline 依赖说明](./pipeline_dependencies.md)
4. [Pipeline 依赖清单 JSON](./pipeline_dependencies.json)
5. [运行时 requirements 输入](./pipeline_runtime_requirements.in)
6. [测试 requirements 输入](./pipeline_test_requirements.in)

维护原则：

- 依赖真相源是根目录 [`pyproject.toml`](../../pyproject.toml)。
- requirements 文件应由脚本生成，不直接手改。
- Docker、桌面端和 CI 应共享同一套依赖口径。
- 模块边界以 [architecture.md](./architecture.md) 和 `backend/scripts/devtools/check_pipeline_architecture.py` 为准。
