# Translation Replay Golden Cases

这个目录只放可复现的翻译回归样本清单和脱敏 fixture，不能放真实 API key。

## 用途

- 复现模型返回协议壳/JSON 壳。
- 复现空译文降级。
- 复现英文残留未翻译。
- 复现技术块误翻译或误跳过。

## 运行方式

优先使用已有工具：

```bash
python3 backend/pipeline/devtools/replay_translation_item.py --case <case-json>
```

如果样本来自真实 job，先用 promptfoo capture 工具脱敏保存成 case artifact，再加入本目录 manifest。不要在本目录提交 `sk-*`、PaddleOCR token、完整用户文件或未脱敏 job 数据。

## 文件约定

- `manifest.json` 是样本索引。
- `cases/*.json` 存放脱敏后的单 item replay 输入。
- 每个 case 必须有 `id`、`category`、`expected`、`fixture` 或 `source_artifact`。
