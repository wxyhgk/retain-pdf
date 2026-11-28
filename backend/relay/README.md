# retainpdf-relay：按页卖翻译的中转服务

方案和用户定的规则见 [按页卖翻译的订阅](../../docs/ops/planning/translation-subscription/20261127-按页卖翻译的订阅.md)。
桌面版照旧在用户电脑上翻译；选了「RetainPDF 订阅」时，OCR 和模型请求走这里、用我们的 key。

- **key 只在服务器的环境变量里**，库里只记变量名；邀请码、设备令牌、单的凭证只存 SHA-256。
- 客户端拿到的只有设备令牌和每单的凭证（只对这一单有效、带 token 上限、结算或超时就失效）。
- 转发时模型换成这一档配的（客户端选不了），上游的响应头不带回去，报错里像 key 的东西去掉。
- **没有管理接口**：后台操作都是服务器上的命令。

## 接口

| 方法 | 地址 | 鉴权 | 做什么 |
|---|---|---|---|
| `POST` | `/v1/devices/activate` | 无 | `{invite_code, device_name}` → `{device_token}`；一个邀请码只绑一台设备（`409`） |
| `GET` | `/v1/me` | 设备令牌 | 档位、本期到哪天、本期页额度、剩余 |
| `POST` | `/v1/orders` | 设备令牌 | 开单 `{mode: classic\|agent, pages, job_ref?}`，预扣 `页数 × 1 或 3`；额度不够 `402`；同时最多 3 单 |
| `POST` | `/v1/orders/{id}/settle` | 设备令牌 | `{translated_pages}`：按 `min(预扣, 计费页 × 倍数)` 扣，计费页不超过中转看到的 OCR 页数 |
| `POST` | `/v1/orders/{id}/cancel` | 设备令牌 | 预扣全退 |
| `POST` | `/relay/anthropic/v1/messages` | 单的凭证（`x-api-key`） | 转到这一档的 Anthropic 连接 |
| `POST` | `/relay/openai/v1/chat/completions`、`/relay/openai/v1/responses` | 单的凭证（`Bearer`） | 转到这一档的 OpenAI 协议连接 |
| `POST` | `/relay/glm/api/paas/v4/layout_parsing` | 单的凭证（`Bearer`） | 转到 GLM-OCR；OCR 页数到了这单的页数就拒绝 |

翻译档用到这单的 token 上限（`页数 × 这一档每页上限`）就 `429 order_token_budget_exceeded`。
单开着超过 24 小时没结算，服务每 10 分钟按已用 token 折成页收掉、其余退回。

## 后台命令

```bash
export RELAY_DB=/var/lib/retainpdf-relay/relay.sqlite
retainpdf-relay admin tier-set --tier classic --protocol anthropic --base-url https://api.anthropic.com/v1 \
  --model claude-haiku-5-5 --key-env RELAY_KEY_ANTHROPIC --per-page-tokens 40000
retainpdf-relay admin tier-set --tier agent --protocol anthropic --base-url https://api.anthropic.com/v1 \
  --model claude-haiku-5-5 --key-env RELAY_KEY_ANTHROPIC --per-page-tokens 80000
retainpdf-relay admin tier-set --tier ocr --protocol glm_ocr --base-url https://open.bigmodel.cn/api/paas/v4/layout_parsing \
  --model glm-ocr --key-env RELAY_KEY_ZHIPU
retainpdf-relay admin tier-show
retainpdf-relay admin invite-create --plan standard --note 内测-张三     # 邀请码只显示这一次
retainpdf-relay admin credits-grant --account acct_… --pages 200 --note 补偿
retainpdf-relay admin renew --account acct_… [--plan pro]
retainpdf-relay admin device-unbind acct_… / account-disable acct_…
retainpdf-relay admin accounts
retainpdf-relay admin usage --since 2026-12-01
```

档位：`basic` 400、`standard` 1200、`pro` 2400 页额度 / 30 天（¥9.9 / ¥29.9 / ¥59.9，统一单价）；`--months N` 连着建 N 期，每期各发一次，当期没用完清零。

## 跑起来

```bash
RELAY_DB=relay.sqlite RELAY_PUBLIC_URL=https://relay.example.com:8443 \
RELAY_KEY_ANTHROPIC=… RELAY_KEY_ZHIPU=… \
retainpdf-relay serve --listen 127.0.0.1:8790
```

部署（还没做，部署前和用户确认域名、端口、放哪台）：只监听本机，前面一个自动签证书的反向代理只开 HTTPS；
用单独的系统用户跑，key 放在只有它能读的环境文件里（systemd `EnvironmentFile`，权限 600）；每个 key 在服务商控制台设花费上限和告警。

## 测试

`cargo test -p retainpdf-relay`：算数（档位、倍数、结算、超时）、脱敏、用量解析；端到端（本机假上游）走激活、开单、转发、结算、
token 上限、取消、超时、key 不外泄、库里不存令牌原文。
