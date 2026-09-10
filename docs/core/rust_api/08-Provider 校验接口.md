# Provider 校验接口

## 1. MinerU Token 校验

接口：

`POST /api/v1/providers/mineru/validate-token`

用途：

- 前端在用户保存或提交 OCR 配置前，先检测 `mineru_token` 是否可用
- 避免等到真正创建 OCR 任务后，才在运行期发现 Token 无效或已过期

## 2. 请求体

```json
{
  "mineru_token": "mineru-xxxx",
  "base_url": "https://mineru.net",
  "model_version": "vlm"
}
```

字段说明：

- `mineru_token`
  - 必填，待校验的 MinerU Token
- `base_url`
  - 可选，默认 `https://mineru.net`
- `model_version`
  - 可选，默认 `vlm`

## 3. 返回结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "ok": false,
    "status": "expired",
    "summary": "MinerU Token 已过期",
    "retryable": false,
    "provider_code": "A0211",
    "provider_message": "token expired",
    "operator_hint": "更换新 Token",
    "trace_id": "trace-1",
    "base_url": "https://mineru.net",
    "checked_at": "2026-04-06T08:30:00Z"
  }
}
```

## 4. `status` 固定取值

- `valid`
  - Token 可用
- `unauthorized`
  - Token 无效
- `expired`
  - Token 已过期
- `network_error`
  - 当前机器到 MinerU 的连通性探测失败
- `provider_error`
  - MinerU 返回了其他错误，未落入前面几类

## 5. 前端怎么用

推荐流程：

1. 用户输入或更新 MinerU Token
2. 前端调用这个接口
3. 根据 `data.status` 给出即时提示
4. 只有 `status=valid` 时再继续提交 OCR 或翻译任务

推荐展示：

- 成功：`summary`
- 失败：`summary + operator_hint`
- 调试模式：补充 `provider_code / provider_message / trace_id`

## 6. 实现约定

- 该接口会调用 MinerU 的轻量探测请求校验 Authorization
- 不会真的创建 OCR 任务
- 不会上传 PDF
- 它的目标只是提前发现：
  - token 无效
  - token 过期
  - 当前网络连不上 MinerU

## 7. 和运行期失败诊断的关系

这个接口是“前置校验”。

运行期如果仍然出现 MinerU 鉴权问题，后端任务失败诊断里仍会继续识别：

- `A0202` -> 无效 Token
- `A0211` -> Token 过期

所以两层是互补关系：

- 提交前：用这个接口提前拦
- 运行中：靠失败诊断兜底归因
