# 04 Continuation Hint

## 目标

如果 Paddle 本身已经知道哪些 block 属于同一段，adapter 应该把这类信息映射成统一契约：

- `continuation_hint`

不要让 translation 层直接读取 Paddle 的 `group_id`、`global_group_id`、`block_order`。

## 当前字段

`continuation_hint` 当前结构：

```json
{
  "source": "provider",
  "group_id": "provider-paddle-global-xxx",
  "role": "head",
  "scope": "cross_page",
  "reading_order": 0,
  "confidence": 0.98
}
```

字段说明：

- `source`
  当前 provider 写入时固定为 `provider`
- `group_id`
  连续组稳定 id
- `role`
  `single/head/middle/tail`
- `scope`
  `intra_page` 或 `cross_page`
- `reading_order`
  组内顺序
- `confidence`
  provider 对这个组的置信度

## 当前 Paddle 映射规则

当前代码在：

- `backend/scripts/services/document_schema/provider_adapters/paddle/continuation.py`

当前规则：

1. 优先用 `raw_global_group_id`
2. 没有全局组时，退回 `page_index + raw_group_id`
3. 多 block 组如果没有可靠 `raw_block_order`，则不生成 continuation hint
4. 同页组标为 `intra_page`
5. 跨页组标为 `cross_page`

## 下游消费约定

translation 当前采用 provider-first：

1. 同页 `intra_page` hint 优先直接消费
2. 跨页 `cross_page` hint 只在安全条件满足时受控消费
3. 不满足安全条件时，hint 会被保留，但不会直接触发拼接

也就是说：

- adapter 负责“准确表达 provider 知道的事”
- translation 负责“决定什么时候安全地相信 provider”

## 适配人需要注意

1. `group_id` 只要求组内稳定，不要求跨版本永远不变。
2. `reading_order` 必须是组内唯一且单调的。
3. 如果 Paddle 某个版本的组信息不稳定，宁可不写 `continuation_hint`，不要写错。
4. 不要为了让某个样例过关，伪造跨页连续关系。
