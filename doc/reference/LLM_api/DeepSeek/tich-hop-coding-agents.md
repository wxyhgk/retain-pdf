Tích hợp Claude Code
Cài đặt Claude Code
npm install -g @anthropic-ai/claude-code

Cấu hình biến môi trường
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
export ANTHROPIC_AUTH_TOKEN=${DEEPSEEK_API_KEY}
export ANTHROPIC_MODEL=deepseek-v4-pro[1m]
export ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro
export ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro
export ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
export CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
export CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK=1
export CLAUDE_CODE_EFFORT_LEVEL=max

Vào thư mục dự án, chạy lệnh claude để bắt đầu sử dụng.
cd my-project
claude


Tích hợp OpenCode
Cài đặt OpenCode
Tham khảo tài liệu chính thức của OpenCode để cài đặt.

Sửa file cấu hình
Thêm cấu hình provider sau vào file cấu hình của bạn. Đường dẫn file: ~/.config/opencode/opencode.jsonc

  "provider": {
    "deepseek": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepSeek",
      "options": {
        "baseURL": "https://api.deepseek.com",
        "apiKey": "<DeepSeek API Key>"
      },
      "models": {
        "deepseek-v4-pro": {
          "name": "DeepSeek-V4-Pro",
          "limit": {
            "context": 1048576,
            "output": 262144
          },
          "options": {
            "reasoningEffort": "max",
            "thinking": {
              "type": "enabled"
            }
          }
        }
      }
    }
  }