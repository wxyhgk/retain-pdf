接入 Claude Code
安装 Claude Code
npm install -g @anthropic-ai/claude-code

配置环境变量
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

进入项目目录，执行 claude 命令，即可开始使用了。
cd my-project
claude


接入 OpenCode
安装 OpenCode
安装方法请参阅OpenCode 官方文档

修改配置文件
在您的配置文件中，增加以下 provider 配置。配置文件路径：~/.config/opencode/opencode.jsonc

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