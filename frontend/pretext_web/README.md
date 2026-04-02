# pretext_web

最小保留排版预览实验页。
当前已归入 `frontend/pretext_web/`。

当前目标：

- 使用原 PDF 页面截图作为背景
- 使用翻译 JSON 作为文本覆盖层
- 用绝对定位快速检查 bbox、换行和双栏错位

## 准备样例

```bash
cd /home/wxyhgk/tmp/Code
python frontend/pretext_web/scripts/prepare_sample.py
```

## 运行

```bash
cd /home/wxyhgk/tmp/Code/frontend/pretext_web
python -m http.server 40110
```

打开：

```text
http://127.0.0.1:40110
```
