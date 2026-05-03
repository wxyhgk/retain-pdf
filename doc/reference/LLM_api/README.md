# LLM Provider 资料

这里归档翻译 Provider 和 LLM 接入相关资料。  
它不是 RetainPDF 主流程协议文档，而是“如果要接模型服务，先看什么”的参考目录。

## 适用范围

- 想看模型服务接入参考时看这里
- 想看 RetainPDF 自己的翻译链路，请优先看 [Python 文档](../../core/python/README.md) 和 [Rust API 文档](../../core/rust_api/README.md)

## DeepSeek

建议优先阅读：

1. [RetainPDF 接入建议](./DeepSeek/Retain_接入建议.md)
2. [首次调用 API](./DeepSeek/首次调用%20API.md)
3. [模型与价格](./DeepSeek/模型%20&%20价格.md)
4. [Token 用量计算](./DeepSeek/Token%20用量计算.md)
5. [JSON 输出](./DeepSeek/JSON_output.md)
6. [错误码](./DeepSeek/错误码.md)

补充资料：

- [多轮对话](./DeepSeek/多轮对话.md)
- [思考模式](./DeepSeek/思考模式.md)
- [Tool Calls](./DeepSeek/Tool%20Calls.md)
- [接入 Coding Agents](./DeepSeek/接入%20Coding%20Agents.md)
- [查询余额](./DeepSeek/查询余额.md)

## 项目内实现入口

- [Translation 模块说明](../../backend/scripts/services/translation/README.md)
- [Python 依赖单一事实来源](../python/dependency_source_of_truth.md)
