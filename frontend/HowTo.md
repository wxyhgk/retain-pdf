# Frontend HowTo

这份文档描述当前 `frontend/` 的用户版定位与接口边界。

## 页面目标

- 上传单个 PDF
- 轮询任务状态
- 查询历史任务
- 下载 PDF / Markdown / ZIP

当前页面只面向普通用户，不再提供高级参数入口。

## 当前界面结构

- `Hero`
  标题与产品说明。
- `Notice`
  展示文件限制、Key 填写方式、排错提示。
- `Submit`
  只保留：
  - `MinerU API key`
  - `Model API key`
  - PDF 上传
  - 运行任务
- `Status`
  只展示：
  - `job_id`
  - `status`
  - `stage_detail`
  - `finished_at`
  - 任务进度
  - 公共错误提示
- `Query / Download`
  通过 `job_id` 查询并下载结果。

## 固定提交策略

前端不再让用户调整这些内部参数，统一使用固定值提交：

- `workflow = mineru`
- `mode = sci`
- `render_mode = auto`
- `model_version = vlm`
- `language = ch`
- `rule_profile_name = general_sci`

其余高级参数不在页面暴露。

## 运行方式

当前前端支持两种运行方式：

- 浏览器静态页
  通过 `runtime-config.js` 和本地 `rust_api` 运行。
- Tauri 桌面版
  由桌面壳注入 API 地址和用户保存的两项 Key。

## 后端接口

页面只依赖这些接口：

- `GET /health`
- `POST /api/v1/uploads`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/{job_id}`
- `POST /api/v1/jobs/{job_id}/cancel`
- `GET /api/v1/jobs/{job_id}/download`

以及任务详情里返回的 PDF / Markdown / ZIP 下载地址。

## 约束

- 不要在前端暴露服务端默认 Key
- 不要在前端暴露内部日志、原始 JSON、内部路径
- 不要把开发 / 调试参数重新加回主界面
- 普通用户上传限制保持为 `200MB / 600 页`

## 本地调试

```bash
cd /home/wxyhgk/tmp/Code/frontend
npm install
npm run build:css
python -m http.server 8080
```

默认访问：

```text
http://127.0.0.1:8080
```
