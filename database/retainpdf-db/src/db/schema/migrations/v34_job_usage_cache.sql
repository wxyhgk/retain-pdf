-- 2026-11-21：每个任务的模型用量汇总存进库（数据库重做第 2a 步，docs/ops/planning/database-redesign/）。
--
-- 「总用量」接口以前每次都把全部任务目录里的台账（token-usage.v1.jsonl，真实库合计约 45MB）和旧任务的翻译诊断
-- （约 75MB）逐行解析一遍，本机要几秒到几十秒。现在按任务存一份汇总：（阶段，模型，接口域名，月份）一组一行，
-- 花费逐行估好再加（价格按单次请求的输入量分档、按时刻有时段倍数，不能先合计 token 再算）。
--
-- 这是**缓存**，正本照旧是任务目录里的台账和报告：`source_key` 记着读的时候这些文件的大小和修改时间、价格表的指纹，
-- 对不上就重算这一个任务（还在跑的任务台账一直在长，每次都会重算它自己）。不设指向 jobs 的外键：库里删了记录、
-- 任务目录还在的，用量照样要算（和以前一样按目录算）。不同步（各设备自己算）。
CREATE TABLE IF NOT EXISTS job_usage_cache (
    job_id TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    has_records INTEGER NOT NULL,
    estimated INTEGER NOT NULL,
    computed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_usage_rollups (
    job_id TEXT NOT NULL REFERENCES job_usage_cache(job_id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    model TEXT NOT NULL,
    host TEXT NOT NULL,
    -- `YYYY-MM`；时间戳取不出月份的行是空串（照样计入总数，不进按月、不当最早最晚时间）
    month TEXT NOT NULL,
    first_at TEXT,
    last_at TEXT,
    requests INTEGER NOT NULL,
    requests_without_usage INTEGER NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cache_hit_tokens INTEGER NOT NULL,
    cache_reported_input_tokens INTEGER NOT NULL,
    cache_write_tokens INTEGER NOT NULL,
    reasoning_tokens INTEGER NOT NULL,
    estimated_cost_usd REAL NOT NULL,
    priced_requests INTEGER NOT NULL,
    list_priced_requests INTEGER NOT NULL,
    unpriced_requests INTEGER NOT NULL,
    -- 这一组里第一条查得到价的行：按哪家的价、怎么对上的、它是任务里的第几行（按模型汇总时取最先的那条）
    price_provider TEXT,
    price_basis TEXT,
    first_priced_seq INTEGER,
    PRIMARY KEY (job_id, stage, model, host, month)
);
