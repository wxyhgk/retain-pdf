-- v41：阅读页提问的设置。v40 已经合进本地 main、可能有库跑过，所以另起一版，不往 v40 里补（2026-11-26）。
-- 阅读页提问的设置（2026-11-26 用户定）：只有一行（没有这一行 = 默认）。`memory_enabled` 是「让 AI 使用记忆」总开关，默认开；
-- 关掉以后上下文不带记忆、agent 不能记也不能查，已经记下的都留着。浏览器里的翻译设置后端看不到，这个开关要后端和 agent 都认，所以进库。
CREATE TABLE IF NOT EXISTS ask_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    memory_enabled INTEGER NOT NULL DEFAULT 1 CHECK (memory_enabled IN (0, 1)),
    updated_at TEXT NOT NULL
);
