# rendering/legacy

## 负责什么

这里是渲染层旧调用方兼容入口。它保留历史 API 形状，但新功能不应该继续写到这里。

## 对外入口

- `pdf_overlay.py`
- `typst_page_renderer.py`
- `background_image_route.py`
- `pdf_compress.py`
- `render_payloads.py`

## 不该做什么

- 不新增复杂业务逻辑。
- 不直接实现 redaction、layout、Typst 编译细节。
- 不绕过 `workflow/` 去拼一条新的渲染主流程。

## 命名约定

新代码优先 import 具体实现目录，例如：

- `services.rendering.output.typst.*`
- `services.rendering.source.cleanup.*`
- `services.rendering.source.background.*`
- `services.rendering.source.compression.*`

只有需要兼容旧调用方时才新增这里的 wrapper。
