"""终端工作区里的 fx 技能：打开一本书的终端时写进 `.agents/skills/`。

fx 原生从工作区的 `.agents/skills/<名字>/SKILL.md` 发现技能（也认 `.fx/skills`、
`.claude/skills` 等）。元数据是 SKILL.md 开头的 YAML frontmatter：`name` 必填，
是一个安全的目录名；`description` 可选，单行或 `>`/`|` 块。frontmatter 有字节上限
（fx 报 frontmatter_too_long），所以 description 只写「什么时候用」，正文才写怎么做。
模型平时只看到 name + description，需要时用 fx 的 skill 工具把全文读进来。

技能文件每次开终端都**重写**：内容跟着代码版本走，旧终端留下的版本不能留着误导。
"""

from __future__ import annotations

import os
from pathlib import Path

REFINE_TRANSLATION_SKILL_NAME = "refine-translation"
SKILLS_DIR_PARTS = (".agents", "skills")

REFINE_TRANSLATION_SKILL = """---
name: refine-translation
description: 精修这本书的译文。用户说「这段太生硬」「这句翻错了」「精翻第 3 页」「全书把 X 统一成 Y」，或要看翻译质量问题时使用。用 retainpdf-agent translation 查问题、看原文、写回译文、重渲染。
---

# 精修译文

改这本书的译文**只有一条路**：`retainpdf-agent translation ...`。它走后端接口，
写回前会做和翻译时同一套校验，原译留在修订历史里随时可以回退。

`../` 是只读的。直接改 `../translated/*.json` 会让 checkpoint 的 page_hash 对不上，
渲染直接失败，而且报的错跟「有人改过文件」毫无关系。

## 什么时候用

- 「这段太生硬 / 不通顺」「这句翻错了」「第 12 页那个公式后面漏了一句」→ 定点改几块。
- 「精翻第 3 页」「把第 3–5 章再过一遍」→ 先挑问题，再逐块改；也可以交给自动精修。
- 「全书把 X 统一成 Y」→ 先写术语表，再逐块改受影响的地方。
- 「翻译质量怎么样 / 有哪些问题」→ 只读：列问题给用户看。

## 先知道的三件事

1. **终端只能跑单条命令**：不能用管道、`&&`、`;`。命令输出已经是整理好的 JSON，直接读。
2. **`--text` 一律用单引号包**，新译文写成一行。双引号里的 `$k$`、`$x = l - l_0$` 会被 shell
   当成变量展开、公式被吃掉，校验再拦下来也白费一轮。译文里本身有单引号（英文撇号）时，
   把那个单引号写成 `'\\''`。术语、reason 里没有 `$` 时用双引号也行。
3. 会改东西的命令（revise / term-set / refine / rerender）系统不会再拦，执行就生效，所以
   **由你负责先问**：把拟好的改法列给用户，用户同意了再执行。被拒时（例如校验不过）不要换别的
   办法绕过去。

## 流程（一定按这个顺序）

1. **定位**。用户指了页就按页查问题；指了某句话就在那一页的译文里找出它的 `item_id`
   （页文件名带模型后缀，先 `ls ../translated/` 看清楚）：

       retainpdf-agent translation issues --pages 3
       retainpdf-agent translation issues --severity major
       ls ../translated/
       jq -c '.[] | {item_id, translated_text}' ../translated/page-003-deepseek.json

2. **看原文和现译**（每块改之前都要看，别凭 issues 里的片段就动手）：

       retainpdf-agent translation show --item-id p003-b004

3. **提方案，等用户确认**。逐块列出：item_id、原文要点、现在的译文、拟改成什么、为什么。
   一次给一批，让用户说「都改」或挑着改。用户没点头就不要执行下一步。

4. **写回**，一块一条命令，reason 写清楚改了什么、为什么：

       retainpdf-agent translation revise --item-id p003-b004 --text '其中 $k$ 为弹簧的劲度系数。' --reason "force constant 统一译为劲度系数"

   看返回里的 `validation`：被拒（422）就按 `details` 里的问题改好再提交。

5. **全部改完后重渲染一次**（不是每块一次）：

       retainpdf-agent translation rerender

### 全书统一一个术语

    retainpdf-agent translation term-set --source "force constant" --target "劲度系数"

它把术语写进这本书的术语表（锁定译法），然后列出**原文里有这个词、译文里却没用这个译法**
的块（`affected`）。它**不会**自动改译文：照上面第 2–5 步，把受影响的块和拟改法成批给用户
确认，再逐块 revise，最后 rerender 一次。

### 交给自动精修（会调用大模型、要花钱，先问用户）

    retainpdf-agent translation refine --pages 3-5
    retainpdf-agent translation refine --review-only

`--review-only` 只挑错、出报告，不改任何译文。不带它时会挑错、只改 critical/major、
不过校验的改动整块放弃，改完自动重渲染。它在后台跑，几分钟后用 issues 看 `refine` 一栏
和带 `fix` 的条目。

用「精翻」档翻译的书由编辑部处理过（`refine.mode` 是 editorial）。issues 的 `refine` 一栏里：
`needs_human` 是编辑部改不好、留给用户定的块（带原因和试过的改法）——**先把这些逐条拿给用户看**，
用户定了再 revise；`term_changes` / `term_patrol` 是术语专员改过的术语表，告诉用户改了什么。

## 硬规则

- **占位符和公式逐字保留**：`<f1-e32/>`、`[[FORMULA_1]]` 这类占位符和 `$…$` 公式，
  一个字符都不改：不删、不增，也不改它们在句子里的先后。
- **只改有问题的片段，不整段重写**——除非用户明确要求重译这一段。
- **不擅自扩写**：不加原文没有的解释、补充、语气词；也不删原文有的内容。
- 数字、单位、引用编号（式 5.1、图 3、文献 [12]）照原文。
- 术语照术语表；QA 报告里 terms 一类的问题说明这块没用锁定译法。
- 没有用户确认，不执行 revise / term-set / refine / rerender。

## 命令速查

    retainpdf-agent translation issues [--pages 3-5] [--severity critical|major|minor] [--limit 50]
    retainpdf-agent translation show --item-id <块 id>
    retainpdf-agent translation data [--dataset <名字> [--query "字段=值&group_by=字段&sort=-字段&limit=50"]]
    retainpdf-agent translation revise --item-id <块 id> --text '<新译文>' --reason "<为什么改>"
    retainpdf-agent translation refine [--pages 3-5] [--review-only]
    retainpdf-agent translation rerender
    retainpdf-agent translation term-set --source "<原文术语>" --target "<译法>"

- `issues`：合并确定性 QA（origin=qa）和精修报告里的发现（origin=refine_review），
  `--severity major` 表示 major 及更严重的。两个来源都 missing 说明是老任务或还没渲染完。
- `data`：只读的通用取数。不带 `--dataset` 先列出有哪些数据集和字段（revisions 修订记录、
  qa_violations 质检、layout_blocks 排版、refine_fixes 精修处理、escalated 留给人的块、terms 术语表、
  style_rules 风格规则、events 事件、token_usage 用量、editorial_ledger 编辑部台账……）。筛选是
  「字段=值」、逗号为「或」，`group_by=item_id` 按块计数，`sort=-ts&limit=1` 取最新一条。
  回答用户「这本书哪些块改过三次以上」「第 9 页哪些块溢出了」这类问题就用它，别去 jq 原始文件。
- `show`：原文、现译、最近的修订历史。`protected_translated_text` 出现时以它为底稿改。
  有 `note_group` 的块属于跨块连续段，改它会重建整段。
- `revise`：source 记为 agent，默认不重渲染。`changed=false` 说明和现有译文一样。
- 409 冲突：这块刚被改过或任务正在跑——先 show 看最新的，或等任务结束。
"""


def write_refine_translation_skill(workspace: Path) -> Path:
    """把精修技能写进 `<工作区>/.agents/skills/refine-translation/SKILL.md`。"""
    skill_dir = _skill_dir(workspace, create=True)
    target = skill_dir / "SKILL.md"
    if target.is_symlink():
        raise RuntimeError("fx skill file may not be a symlink")
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(target, flags, 0o600)
    try:
        os.write(descriptor, REFINE_TRANSLATION_SKILL.encode("utf-8"))
    finally:
        os.close(descriptor)
    return target


def remove_refine_translation_skill(workspace: Path) -> None:
    """终端没有精修命令可用时删掉旧技能，免得模型照着一份用不了的说明去试。"""
    skill_dir = _skill_dir(workspace, create=False)
    if skill_dir is None:
        return
    target = skill_dir / "SKILL.md"
    if target.is_file() and not target.is_symlink():
        target.unlink()


def _skill_dir(workspace: Path, *, create: bool) -> Path | None:
    current = workspace
    for part in (*SKILLS_DIR_PARTS, REFINE_TRANSLATION_SKILL_NAME):
        current = current / part
        if current.is_symlink():
            raise RuntimeError("fx skill directory may not be a symlink")
        if not current.exists():
            if not create:
                return None
            current.mkdir(mode=0o700)
        elif not current.is_dir():
            raise RuntimeError("fx skill directory is not a directory")
    return current


__all__ = [
    "REFINE_TRANSLATION_SKILL",
    "REFINE_TRANSLATION_SKILL_NAME",
    "remove_refine_translation_skill",
    "write_refine_translation_skill",
]
