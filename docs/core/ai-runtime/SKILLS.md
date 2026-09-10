# Skills 设计（草案）

**状态：** 未实现的设计草案 v0.2（配合 [AI_RUNTIME.md](./AI_RUNTIME.md)）

**更新：** 2026-09-02

> 当前代码没有 Skill loader、`skill_id` 请求字段或 `retainpdf_ai/skills/`
> 包目录。本文所有 YAML、接口与多 Agent 字段均是提案，不属于现有 API。

---

## 1. Skill vs Tool

| | Tool | Skill |
|--|------|--------|
| 粒度 | 原子 I/O | 面向任务的能力包 |
| 内容 | name + JSON Schema + handler | 工具子集 + 提示词 + 策略 |
| 测试 | handler 单测 | 场景/契约测 |
| 示例 | `search_markdown` | `literature-qa`（提案） |

一句话：

> **Tool 是动词；Skill 是剧本。**

---

## 2. 包格式

```text
retainpdf_ai/skills/literature_qa/
  skill.yaml      # 清单
  prompt.md       # system（可拆 system.md / developer.md）
  # 可选 policy.py  — 复杂策略时再加
```

### skill.yaml

```yaml
id: literature-qa
version: 1
display_name: 文献整本问答
description: >
  在单文档（或指定 job）范围内检索并回答，强制引用锚点。
tools:
  - search_markdown
  - read_markdown_chunk
# list_documents 故意不放进阅读器 skill
policies:
  require_document_scope: true
  allow_global_search: false
  max_tool_rounds: 6
  output_locale: zh-CN
  require_citations: true
  allow_markdown_assets: true
model:
  # 可选覆盖；空则用请求/全局配置
  temperature: 0.3
```

### prompt.md

- 从当前 `prompts/agent.py::build_reading_system_prompt` 迁入；`agent.py` 导出的
  `SYSTEM_PROMPT` 只是兼容面
- 占位符（装配时替换）：

```text
{{document_id}}
{{job_id}}
{{evidence_table}}   # 未来跨轮 evidence 注入；当前尚无该持久化状态
```

---

## 3. 加载器接口

```python
class Skill(Protocol):
    id: str
    version: int
    tools: list[str]
    policies: dict
    def system_prompt(self, *, scope, evidence_table: str) -> str: ...

def load_skill(skill_id: str) -> Skill: ...
def list_skills() -> list[SkillMeta]: ...
```

错误：`unknown skill` → 400。

---

## 4. 首发：literature-qa

首个 Skill 应保持当前阅读器问答的安全面：

- scope 强制 document  
- 工具层注入 document_id / job_id  
- 只暴露 `search_markdown` / `read_markdown_chunk`
- 引用 `[n]`，只允许当前 Markdown artifact 产生的受控资源 URL
- 不暴露 `list_documents`、`search_fulltext`、`read_blocks` 或
  `search_favorites`

验收：与现网回答质量同级；仅配置/提示外置，无功能回退。

---

## 5. 后续 Skill 候选

| id | 场景 | 可能工具 |
|----|------|----------|
| `annotation-assist` | 基于批注/选区解释 | 需要新增显式批注读取工具 |
| `paper-compare` | 两篇文档对比 | 需要新的多文档 scope 与检索契约 |
| `figure-explain` | 专讲图/表 | 可基于 Markdown asset，或新增受控图片工具 |

---

## 6. 与 Multi-agent

Skill 可声明：

```yaml
agents:
  - role: retriever
    tools: [search_markdown, read_markdown_chunk]
  - role: analyst
    tools: []    # 只写
```

当前没有实现该字段。未来 schema 在真正支持 handoff 前应拒绝 `agents`，不能静默
忽略后仍让调用方误以为多 Agent 已经生效。

---

## 7. 实施顺序

1. 目录 + loader + literature-qa 迁入（行为不变）  
2. ask 请求支持 `skill_id`  
3. 契约测试锁定未知 Skill、版本和工具白名单错误
4. 第二个 Skill 再证明扩展性；之后再设计多 Agent handoff
