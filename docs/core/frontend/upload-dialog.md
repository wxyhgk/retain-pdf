# 上传弹窗（添加 PDF）

2026-11-20 整理：用户要「多用图标、结构清晰」，又要把普通翻译和 Agent 翻译都放到弹窗上。

从上到下：

1. 标题：左边一个图标，「添加 PDF」，一句说明（`IngestDialog.tsx`）。
2. 模式：翻译 / 仅 OCR（`WorkflowPanel.tsx`）。
3. 翻译方式（只在「翻译」下）：普通翻译 / Agent 翻译两张卡片（`components/upload/UploadEngineChoice.tsx`）。
   - 和「选项」里「翻译质量」下拉是同一个设置 `translationQuality`，记在本机：Agent = `refined`（翻译 agent），
     普通 = `standard`；下拉里选了「统一术语」（`terms`）再点普通不会丢。
   - 选 Agent 时下面出一条三项提示：质量大幅提升、速度很慢、消耗大量 token。
   - 主按钮跟着写「Agent 翻译」（一次多本时「Agent 翻译（N 本）」），换机器人图标。
4. 流程条：这一种模式会经过哪几步，用图标一眼看清（`components/upload/UploadFlowStrip.tsx`）。
   翻译：上传 PDF → 识别版面 → 翻译 → 译文 PDF；Agent：第三步写「Agent 翻译」；仅 OCR：上传 PDF → 识别版面 → Markdown。
   手机上缩小不折行，400px 以下去掉箭头。
5. 拖放区：上传文件图标，三个说明小标签各一个图标。
6. 选项、仅收藏、主按钮（`components/upload/ProcessingChoicePanel.tsx`）。

样式：`UploadGuide.css`（标题、流程条、拖放区图标）、`UploadEngineChoice.css`（翻译方式）。
