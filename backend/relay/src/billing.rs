//! 页额度怎么算（2026-11-27 用户定，见 docs/ops/planning/translation-subscription/20261127-按页卖翻译的订阅.md）：
//! 统一「页额度」，普通翻译 1 页扣 1、agent 翻译 1 页扣 3；开单按页数预扣，结算按实际译成的页扣、剩下的退回；
//! 中转自己看到的 OCR 页数封顶客户端报的页数；超时没结算的按已用 token 折成页。这里只有算数，没有库。

use serde::{Deserialize, Serialize};

/// 档位和每期送的页额度（统一单价 ¥0.025 / 页额度：¥9.9 / 400、¥29.9 / 1200、¥59.9 / 2400）。
pub const PLANS: &[(&str, i64)] = &[("basic", 400), ("standard", 1200), ("pro", 2400)];

pub fn plan_credits(plan: &str) -> Option<i64> {
    PLANS.iter().find(|(name, _)| *name == plan).map(|(_, credits)| *credits)
}

/// 翻译的档：普通、agent。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Classic,
    Agent,
}

impl Mode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Classic => "classic",
            Self::Agent => "agent",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "classic" => Some(Self::Classic),
            "agent" => Some(Self::Agent),
            _ => None,
        }
    }

    /// 一页扣几个页额度。
    pub fn multiplier(self) -> i64 {
        match self {
            Self::Classic => 1,
            Self::Agent => 3,
        }
    }
}

/// 结算：`min(预扣, 计费页 × 倍数)`；计费页是客户端报的译成页，OCR 看到过页数时不超过它（超过记异常）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Settlement {
    pub charged: i64,
    pub refunded: i64,
    pub billed_pages: i64,
    /// 客户端报的页数比中转看到的 OCR 页数多。
    pub anomaly: Option<String>,
}

pub fn settle(reserved: i64, multiplier: i64, translated_pages: i64, ocr_pages: i64) -> Settlement {
    let reported = translated_pages.max(0);
    let (billed_pages, anomaly) = if ocr_pages > 0 && reported > ocr_pages {
        (ocr_pages, Some(format!("reported {reported} translated pages but relay saw {ocr_pages} OCR pages")))
    } else {
        (reported, None)
    };
    let charged = (billed_pages * multiplier).clamp(0, reserved.max(0));
    Settlement { charged, refunded: reserved.max(0) - charged, billed_pages, anomaly }
}

/// 超时没结算：已用 token 除以每页平常用量（每页上限的三分之一）折成页、向上取整，再按倍数扣，不超过预扣。
pub fn expire(reserved: i64, multiplier: i64, tokens_used: i64, per_page_token_cap: i64) -> Settlement {
    let typical = (per_page_token_cap / 3).max(1);
    let pages = if tokens_used <= 0 { 0 } else { (tokens_used + typical - 1) / typical };
    let charged = (pages * multiplier).clamp(0, reserved.max(0));
    Settlement { charged, refunded: reserved.max(0) - charged, billed_pages: pages, anomaly: None }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plans_have_a_flat_unit_price() {
        assert_eq!(plan_credits("basic"), Some(400));
        assert_eq!(plan_credits("standard"), Some(1200));
        assert_eq!(plan_credits("pro"), Some(2400));
        assert_eq!(plan_credits("free"), None);
    }

    #[test]
    fn agent_pages_cost_three_credits() {
        assert_eq!(Mode::Classic.multiplier(), 1);
        assert_eq!(Mode::Agent.multiplier(), 3);
        assert_eq!(Mode::parse("agent"), Some(Mode::Agent));
        assert_eq!(Mode::parse("gpt"), None);
    }

    #[test]
    fn settling_charges_what_was_translated_and_refunds_the_rest() {
        // 预扣 30（agent 10 页），译成 7 页：扣 21 退 9
        assert_eq!(settle(30, 3, 7, 0), Settlement { charged: 21, refunded: 9, billed_pages: 7, anomaly: None });
        // 报得比预扣还多：不超过预扣
        assert_eq!(settle(10, 1, 50, 0).charged, 10);
        // 整单没成：全退
        assert_eq!(settle(10, 1, 0, 10).refunded, 10);
    }

    #[test]
    fn ocr_pages_cap_the_reported_pages() {
        let settled = settle(60, 3, 20, 12);
        assert_eq!((settled.charged, settled.refunded, settled.billed_pages), (36, 24, 12));
        assert!(settled.anomaly.is_some());
        assert!(settle(60, 3, 12, 12).anomaly.is_none());
    }

    #[test]
    fn expired_orders_are_charged_by_tokens_used() {
        // 每页上限 30000 → 平常 10000/页；用了 25000 → 3 页；普通扣 3
        assert_eq!(expire(10, 1, 25_000, 30_000).charged, 3);
        // agent 扣 9，但不超过预扣
        assert_eq!(expire(6, 3, 25_000, 30_000).charged, 6);
        assert_eq!(expire(10, 1, 0, 30_000), Settlement { charged: 0, refunded: 10, billed_pages: 0, anomaly: None });
    }
}
