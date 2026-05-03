# 05 Adapter Checklist

## 任务定义

安排一个人去适配 Paddle OCR 时，建议直接按下面交付：

### 输入

- Paddle OCR 原始 JSON
- 至少一个最小 fixture
- 至少一个较完整 fixture

### 输出

- 可注册的 Paddle adapter
- `document.v1` 输出
- 对应文档
- 对应测试

## 文件范围

允许修改：

- `doc/core/paddle_ocr_api/*`
- `backend/scripts/services/document_schema/provider_adapters/paddle/*`
- `backend/scripts/services/document_schema/adapters.py`
- `backend/scripts/services/document_schema/providers.py`
- `backend/scripts/devtools/tests/document_schema/fixtures/*`
- `backend/scripts/devtools/tests/document_schema/regression_check.py`

不要修改：

- `backend/scripts/services/translation/*`
- `backend/scripts/services/rendering/*`
- `backend/scripts/runtime/pipeline/*`

例外：

- 只有当主契约确实需要新增稳定字段时，才允许先提案，再改 `document_schema`

## 接入顺序

1. 确认 Paddle 原始返回格式
2. 梳理顶层/页级/block 级字段
3. 明确字段落位
4. 实现 detector
5. 实现 adapter
6. 实现 `continuation_hint` 映射
7. 补 fixture
8. 跑回归
9. 更新文档

## 验收命令

```bash
PYTHONPATH=backend/scripts python backend/scripts/devtools/tests/document_schema/regression_check.py
PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/document_schema -q
PYTHONPATH=backend/scripts python -m pytest backend/scripts/devtools/tests/translation -q
```

## 必查项

- provider 检测是否稳定
- `document.v1` 是否通过 schema 校验
- `source.provider` 是否正确写成 `paddle`
- `type/sub_type/tags/derived` 是否符合当前契约
- `metadata/source` 是否保留了必要 trace
- `continuation_hint` 是否只在可靠时写入
- `skip_translation` 标记是否只给该跳过的块

## 交付说明模板

适配人提交时，至少应说明：

1. 支持了哪个 Paddle API 返回格式
2. 用了哪些 fixture
3. 新增或修改了哪些字段映射
4. 哪些 Paddle 字段被故意不接
5. 是否写入了 `continuation_hint`
6. 测试命令和结果
