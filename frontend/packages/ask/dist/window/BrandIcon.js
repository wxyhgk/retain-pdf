import { jsx as _jsx } from "react/jsx-runtime";
import { Bot, BookOpenText, Pi } from "lucide-react";
import { BRAND_ICONS } from "./brand-icons.generated.js";
/** 按顺序匹配：先认 agent（Claude Code、Codex 这类有自己的标），再认模型厂商。 */
const RULES = [
    [/claude[-_ ]?code|claude-agent/i, "claudecode"],
    [/codex/i, "codex"],
    [/gemini[-_ ]?cli/i, "geminicli"],
    [/antigravity/i, "antigravity"],
    [/opencode/i, "opencode"],
    [/qoder/i, "qoder"],
    [/kiro/i, "kiro"],
    [/cline/i, "cline"],
    [/goose/i, "goose"],
    [/cursor/i, "cursor"],
    [/\bamp\b/i, "amp"],
    [/trae/i, "trae"],
    [/copilot/i, "githubcopilot"],
    [/claude|anthropic|opus|sonnet|haiku|fable/i, "claude"],
    [/gpt|openai|\bo[1-9]\b|chatgpt/i, "openai"],
    [/gemini|gemma/i, "gemini"],
    [/qwen|qwq|tongyi|通义|dashscope|bailian/i, "qwen"],
    [/deepseek/i, "deepseek"],
    [/kimi|moonshot/i, "kimi"],
    [/glm|zhipu|智谱|bigmodel/i, "zhipu"],
    [/doubao|豆包|volc|ark\./i, "doubao"],
    [/minimax|abab/i, "minimax"],
    [/mistral|mixtral|codestral/i, "mistral"],
    [/grok|xai/i, "grok"],
    [/llama|meta/i, "meta"],
    [/hunyuan|混元/i, "hunyuan"],
    [/ernie|wenxin|文心/i, "wenxin"],
    [/\byi-|01\.ai|lingyi/i, "yi"],
    [/spark|讯飞/i, "spark"],
    [/step-|stepfun/i, "stepfun"],
    [/baichuan/i, "baichuan"],
    [/silicon/i, "siliconcloud"],
    [/openrouter/i, "openrouter"],
    [/ollama/i, "ollama"],
];
/** 一串文字（agent id、名字、模型名、服务商）→ 图标名；认不出是空串。 */
export function brandFor(...texts) {
    const text = texts.filter(Boolean).join(" ");
    for (const [pattern, name] of RULES)
        if (pattern.test(text) && BRAND_ICONS[name])
            return name;
    return "";
}
export function BrandIcon({ brand, size = 14, title }) {
    const data = BRAND_ICONS[brand];
    if (!data)
        return _jsx(Bot, { size: size, "aria-label": title });
    if (data.mode === "color")
        return _jsx("img", { className: "ask-brand", src: data.uri, width: size, height: size, alt: title || brand, title: title, draggable: false });
    // 单色图标用 mask：跟着字的颜色走（深色皮肤也看得见）。
    const style = { width: size, height: size, maskImage: `url("${data.uri}")`, WebkitMaskImage: `url("${data.uri}")` };
    return _jsx("span", { className: "ask-brand ask-brand-mono", style: style, role: "img", "aria-label": title || brand, title: title });
}
/** agent 的图标：RetainPDF 自带的两个用我们自己的（书 / π），别的按名字认厂商。 */
export function AgentIcon({ id, name, size = 14 }) {
    if (id === "retainpdf")
        return _jsx(BookOpenText, { size: size, "aria-label": name });
    if (id === "retainpdf-pi" || /^pi(-acp)?$/i.test(id))
        return _jsx(Pi, { size: size, "aria-label": name });
    return _jsx(BrandIcon, { brand: brandFor(id, name), size: size, title: name });
}
