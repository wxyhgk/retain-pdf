use serde::{Deserialize, Serialize};

/// 翻译 agent 编辑部事件的一段（`GET /jobs/:job_id/progress/editorial`）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct EditorialEventListView {
    /// 事件原样（editorial.v1 每行一条），按写入顺序。格式见 docs/api 的说明，只加不改。
    pub events: Vec<serde_json::Value>,
    /// 下次带 `after=<这个数>` 接着取。就是到这一段为止读过的事件条数；
    /// 比请求的 `after` 还小说明事件文件重开了（换了文档或引擎版本重跑），从 0 重新取。
    pub next_after: u64,
    /// 后面还有：这次只给到 `limit` 条。
    pub has_more: bool,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EditorialEventsQuery {
    /// 跳过前面这么多条（上次的 `next_after`），不带是从头取。
    #[serde(default)]
    pub after: u64,
    /// 一次最多几条，默认 500，最大 2000。
    #[serde(default)]
    pub limit: Option<u32>,
}
