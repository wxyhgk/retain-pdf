# PaddleOCR-VL 官方服务化说明摘录

来源：

- GitHub 官方文档：
  <https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/PaddleOCR-VL.md>
- 当前仓库早期摘录：
  `backend/rust_api/src/ocr_provider/paddle/AsyncParse.md`

这份摘录只保留和本仓库 provider 对接直接相关的内容，不复制整份官方教程。

## 1. 官方返回里存在 Markdown

官方服务化示例明确展示了如下用法：

- 遍历 `result["layoutParsingResults"]`
- 读取 `res["markdown"]["text"]`
- 读取 `res["markdown"]["images"]`

也就是说，Paddle 官方返回不仅有结构化 `prunedResult`，还可以直接得到 Markdown 文本和 Markdown 图片映射。

## 2. 关键响应结构

和本仓库对接最直接相关的结构是：

```json
{
  "result": {
    "layoutParsingResults": [
      {
        "prunedResult": {},
        "markdown": {
          "text": "...",
          "images": {}
        },
        "outputImages": {},
        "inputImage": "..."
      }
    ]
  }
}
```

字段含义：

- `prunedResult`: 结构化页面解析结果
- `markdown.text`: 页面级 Markdown 文本
- `markdown.images`: Markdown 图片相对路径到图片内容/地址的映射
- `outputImages`: 可视化或中间图像结果
- `inputImage`: 输入页图像

这里要特别注意：

- `markdown.images` 的键不是“建议值”，而是 Markdown/HTML 正文里实际引用的相对路径
- 如果正文里是 `<img src="imgs/xxx.jpg">`，那 `images` 里的 key 就应该是 `imgs/xxx.jpg`
- 集成方不能擅自把这段 provider 返回的相对路径固定改写成另一套目录规范，只能在发布阶段做最小的、可逆的包装

## 3. 与本仓库当前主链直接相关的请求参数

- `restructurePages`
  用于多页 PDF 的重构，影响跨页表格和段落标题级别识别。
- `mergeTables`
  跨页表格合并。
- `relevelTitles`
  段落标题级别识别。
- `showFormulaNumber`
  控制 Markdown 中是否包含公式编号。
- `prettifyMarkdown`
  控制是否输出美化后的 Markdown。
- `visualize`
  控制是否返回图像结果。

## 4. 对我们系统的落地结论

结论很直接：

1. `markdown_ready = false` 不能再归因于 Paddle 官方不支持 Markdown。
2. 如果任务 raw 已经拿到了 `markdown.text` / `markdown.images`，就应该在我们产物层导出成 job markdown artifact。
3. provider adapter / pipeline 需要明确区分：
   - 结构化文档标准化
   - Markdown 产物落盘
   - Markdown 图片落盘
4. Markdown 图片路径应当遵循 provider 返回值；如果为了多页任务防冲突而增加页面前缀，也只能做这类外层作用域包装，不能把内部相对路径模式写死。

## 5. 更新原则

以后如果继续补 Paddle 文档，优先补这里：

- 官方入口
- 与当前仓库强相关的字段和参数
- 对应到本仓库 artifact / normalized document / provider adapter 的映射

不要把整份官方部署教程原样搬进来。
