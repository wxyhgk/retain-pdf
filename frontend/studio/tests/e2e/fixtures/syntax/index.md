---
title: 'Studio 语法夹具'
description: '每种 Markdown 写法各一块：在任一块里改一个字，只有那一块可以变。'
pubDate: '2026-10-14'
tags: []
draft: true
---

普通段落，带 **粗体**、*斜体*、~~删除线~~、`代码`，和[带标题的链接](https://example.com "标题")。

第一行用两个空格硬换行  
第二行有转义：\*不是强调\*，还有 \_下划线\_。

## 二级标题

### 三级标题

| 方法 | 能量 / kcal·mol⁻¹ | 备注 |
| :--- | ---: | :---: |
| HF | −10.40 | 基准 |
| B3LYP | −2.87 | `def2-TZVP` |

- [ ] 待办一
- [x] 已完成

* 星号列表
* 第二项
  * 嵌套项
  * 另一个嵌套

1. 第一步
2. 第二步

插一段，让下一个列表单独开始。

3. 从三开始
4. 第四项

> 引用段落
>
> - 引用里的列表
> - 第二项

这句话有脚注[^note]。

[^note]: 脚注的内容。

<details>
<summary>展开</summary>

折叠里的段落。

</details>

```python
def energy(x):
    return x ** 2
```

---

最后一段，中英 mixed text，行内公式 $x^2$，还有 https://example.com 自动链接。
