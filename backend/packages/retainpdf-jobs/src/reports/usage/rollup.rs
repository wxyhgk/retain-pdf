//! 用量按（阶段，模型，接口域名，月份）合成几组（2026-11-21，数据库重做第 2a 步）。
//!
//! 汇总（按阶段、按模型、按月、总数）都是这些组的和，所以一个任务算一次、存进库（`cache.rs`），之后的请求只读组。
//! 花费逐行估好再加进组里：价格按单次请求的输入量分档、按时刻有时段倍数、按日期有历史价，不能先合计 token 再算。
//! 按模型汇总时「按哪家的价」取全部行里第一条查得到价的（以前逐行汇总就是这样）：每组记下它自己第一条的序号。

use std::collections::BTreeMap;

use retainpdf_providers::{PriceBasis, PriceBook};

use super::{month_of, record_cost, UsageBucket, UsageRecord};

#[derive(Debug, Clone, PartialEq)]
pub struct UsageRollup {
    pub stage: String,
    pub model: String,
    pub host: String,
    /// `YYYY-MM`；时间戳取不出月份的行是 None（照样计入总数，不进按月、不当最早最晚时间）。
    pub month: Option<String>,
    pub first_at: Option<String>,
    pub last_at: Option<String>,
    /// 还没取整的和（`UsageBucket::finish` 在出汇总时才做）。
    pub usage: UsageBucket,
    /// 这一组第一条查得到价的行：（它在这批行里的序号，服务商，怎么对上的）。
    pub first_priced: Option<(u64, String, PriceBasis)>,
}

type RollupKey = (String, String, String, Option<String>);

/// 一批行（一个任务的，或助手的）合成组，按（阶段，模型，域名，月份）排好。
pub fn rollup_records(records: &[UsageRecord], prices: &PriceBook) -> Vec<UsageRollup> {
    let mut groups: BTreeMap<RollupKey, UsageRollup> = BTreeMap::new();
    for (seq, record) in records.iter().enumerate() {
        let month = month_of(&record.ts).map(str::to_string);
        let key = (record.stage.clone(), record.model.clone(), record.host.clone(), month.clone());
        let group = groups.entry(key).or_insert_with(|| UsageRollup {
            stage: record.stage.clone(),
            model: record.model.clone(),
            host: record.host.clone(),
            month: month.clone(),
            first_at: None,
            last_at: None,
            usage: UsageBucket::default(),
            first_priced: None,
        });
        let cost = record_cost(prices, record);
        group.usage.add(record, cost.as_ref());
        if group.first_priced.is_none() {
            group.first_priced = cost.map(|cost| (seq as u64, cost.provider, cost.basis));
        }
        if month.is_some() {
            let ts = record.ts.as_str();
            if group.first_at.as_deref().is_none_or(|first| ts < first) {
                group.first_at = Some(ts.to_string());
            }
            if group.last_at.as_deref().is_none_or(|last| ts > last) {
                group.last_at = Some(ts.to_string());
            }
        }
    }
    groups.into_values().collect()
}
