//! 混合逻辑时钟:`<毫秒 13 位>-<计数 6 位>-<设备号>`,按字符串比较即按先后。
//!
//! 物理部分取改动发生的时刻;本机时钟只增不减,并且看到别的设备的时钟后追到它后面,
//! 所以「看到了别人的改动之后再改」一定比别人的那次新,即使两台机器的时间有偏差。

use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default)]
pub(super) struct Hlc {
    pub ms: u64,
    pub counter: u32,
}

impl Hlc {
    pub fn parse(text: &str) -> Option<Self> {
        let mut parts = text.splitn(3, '-');
        let ms = parts.next()?.parse().ok()?;
        let counter = parts.next()?.parse().ok()?;
        Some(Self { ms, counter })
    }

    pub fn encode(&self) -> String {
        format!("{:013}-{:06}", self.ms, self.counter)
    }

    /// 本机一次改动的时钟。`physical_ms`:改动发生的时刻。
    pub fn tick(&mut self, physical_ms: u64, device: &str) -> String {
        if physical_ms > self.ms {
            self.ms = physical_ms;
            self.counter = 0;
        } else {
            self.counter += 1;
        }
        format!("{}-{device}", self.encode())
    }

    /// 看到别的设备的时钟。
    pub fn observe(&mut self, clock: &str) {
        if let Some(seen) = Self::parse(clock) {
            if seen > *self {
                *self = seen;
            }
        }
    }
}

pub(super) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// `2026-10-08T12:34:56.789Z`(sync_dirty.changed_at)-> 毫秒;解析不了用现在。
pub(super) fn iso_ms(text: &str) -> u64 {
    chrono::DateTime::parse_from_rfc3339(text)
        .map(|t| t.timestamp_millis().max(0) as u64)
        .unwrap_or_else(|_| now_ms())
}
