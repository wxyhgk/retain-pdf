// ACP 的设置项（session/new 的 configOptions、session/update 的 config_option_update、session/set_config_option 的返回）
// → AskConfigOption：分组的可选值摊平，字段补齐。纯函数，测试在 frontend/web/tests/ask/。
const text = (value) => (typeof value === "string" ? value : "");
function choices(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const entry of raw) {
        if (Array.isArray(entry?.options)) {
            const group = text(entry.name) || text(entry.group);
            for (const inner of entry.options) {
                if (typeof inner?.value === "string")
                    out.push({ value: inner.value, name: text(inner.name) || inner.value, ...(text(inner.description) ? { description: text(inner.description) } : {}), ...(group ? { group } : {}) });
            }
        }
        else if (typeof entry?.value === "string") {
            out.push({ value: entry.value, name: text(entry.name) || entry.value, ...(text(entry.description) ? { description: text(entry.description) } : {}) });
        }
    }
    return out;
}
/** agent 给的设置项 → 窗口用的。认不出的项跳过。 */
export function normalizeConfigOptions(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const option of raw) {
        const id = text(option?.id);
        if (!id)
            continue;
        const type = option.type === "boolean" ? "boolean" : "select";
        const currentValue = type === "boolean" ? option.currentValue === true : text(option.currentValue);
        out.push({
            id,
            name: text(option.name) || id,
            ...(text(option.description) ? { description: text(option.description) } : {}),
            ...(text(option.category) ? { category: text(option.category) } : {}),
            type,
            currentValue,
            options: type === "select" ? choices(option.options) : [],
        });
    }
    return out;
}
/** 用户想要的值（窗口记的，换会话以后再设一次）里，和 agent 现在的不一样、又是 agent 认的那些。 */
export function pendingConfig(options, desired) {
    const out = [];
    for (const [id, value] of Object.entries(desired)) {
        const option = options.find((entry) => entry.id === id);
        if (!option || option.currentValue === value)
            continue;
        if (option.type === "boolean" ? typeof value !== "boolean" : !option.options.some((choice) => choice.value === value))
            continue;
        out.push([id, value]);
    }
    return out;
}
