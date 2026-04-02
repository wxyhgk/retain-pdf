# 服务总览

本文档描述当前项目 API 的整体结构。

## 1. 服务端口

- 前端静态页默认运行在 `http://127.0.0.1:8080`
- Rust API 默认运行在 `http://127.0.0.1:41000`
- 简便同步接口默认运行在 `http://127.0.0.1:42000`
- 健康检查：`GET /health`
- 业务前缀：`/api/v1`

## 2. 主链路

当前主链路：

1. 上传 PDF
2. 创建主任务 `/api/v1/jobs`
3. 主任务内部派生 OCR 子任务 `{job_id}-ocr`
4. OCR 完成后生成标准化 `document.v1`
5. 进入翻译与渲染
6. 下载 PDF / Markdown / ZIP

## 3. 统一返回格式

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

失败：

```json
{
  "code": 400,
  "message": "具体错误信息"
}
```

## 4. 当前主 provider

- 当前生产主线以 `mineru` 为主
- `paddle` 已接入，但更偏开发调试用途
