//! 中转服务自己的 SQLite 库：账号（邀请码当账号）、设备、订阅期、页额度流水（只追加，余额由流水算）、单、用量、每档的连接。
//! 邀请码、设备令牌、单的凭证只存 SHA-256；key 只存环境变量名，原文在服务器环境变量里（见方案「密钥安全」）。

use std::path::Path;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::Serialize;

use crate::billing::{self, Mode, Settlement};
use crate::secrets::{hash_token, new_token};

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS accounts (
    account_id TEXT PRIMARY KEY,
    invite_hash TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(account_id),
    token_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS periods (
    period_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(account_id),
    plan TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_periods_account ON periods(account_id, ends_at);
-- 页额度流水：grant（发放，正）、reserve（开单预扣，负）、refund（结算或取消退回，正）。余额 = 这一期的总和。
CREATE TABLE IF NOT EXISTS credit_ledger (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL REFERENCES accounts(account_id),
    period_id TEXT NOT NULL REFERENCES periods(period_id),
    kind TEXT NOT NULL CHECK (kind IN ('grant', 'reserve', 'refund')),
    credits INTEGER NOT NULL,
    order_id TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_period ON credit_ledger(period_id);
CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(account_id),
    device_id TEXT NOT NULL REFERENCES devices(device_id),
    period_id TEXT NOT NULL REFERENCES periods(period_id),
    token_hash TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL CHECK (mode IN ('classic', 'agent')),
    pages INTEGER NOT NULL,
    credits_reserved INTEGER NOT NULL,
    token_budget INTEGER NOT NULL,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    ocr_pages INTEGER NOT NULL DEFAULT 0,
    job_ref TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('open', 'settled', 'cancelled', 'expired')),
    translated_pages INTEGER,
    credits_charged INTEGER,
    anomaly TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_open ON orders(status, expires_at);
CREATE TABLE IF NOT EXISTS usage (
    usage_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(order_id),
    account_id TEXT NOT NULL,
    route TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    upstream_status INTEGER NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    ocr_pages INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_account ON usage(account_id, created_at);
-- 每档的连接（后台配，随时改）：classic、agent 是翻译，ocr 是 GLM-OCR。key 只存环境变量名。
CREATE TABLE IF NOT EXISTS routes (
    tier TEXT PRIMARY KEY CHECK (tier IN ('classic', 'agent', 'ocr')),
    protocol TEXT NOT NULL CHECK (protocol IN ('anthropic', 'openai', 'glm_ocr')),
    base_url TEXT NOT NULL,
    model TEXT NOT NULL,
    key_env TEXT NOT NULL,
    per_page_tokens INTEGER NOT NULL DEFAULT 0
);
"#;

/// 同一个账号最多同时开着几单。
pub const MAX_OPEN_ORDERS: i64 = 3;
/// 单开着多久没结算就按已用 token 收掉。
pub const ORDER_TTL_HOURS: i64 = 24;
/// 一单最多几页（防手滑）。
pub const MAX_ORDER_PAGES: i64 = 5000;

#[derive(Clone)]
pub struct Store {
    conn: Arc<Mutex<Connection>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Route {
    pub tier: String,
    pub protocol: String,
    pub base_url: String,
    pub model: String,
    pub key_env: String,
    pub per_page_tokens: i64,
}

#[derive(Debug, Clone)]
pub struct Device {
    pub device_id: String,
    pub account_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Me {
    pub plan: String,
    pub period_ends_at: Option<String>,
    pub credits_total: i64,
    pub credits_left: i64,
}

#[derive(Debug, Clone)]
pub struct Order {
    pub order_id: String,
    pub account_id: String,
    pub mode: Mode,
    pub pages: i64,
    pub credits_reserved: i64,
    pub token_budget: i64,
    pub tokens_used: i64,
    pub ocr_pages: i64,
    pub status: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenedOrder {
    pub order_id: String,
    /// 原文只在这里给出去一次。
    pub order_token: String,
    pub mode: Mode,
    pub pages: i64,
    pub credits_reserved: i64,
    pub token_budget: i64,
    pub expires_at: String,
    /// 这一档翻译走哪个协议（客户端按它选转发地址）。
    pub protocol: String,
}

pub enum Activation {
    Activated { device_token: String },
    InvalidInvite,
    AlreadyBound,
}

pub enum OpenOrder {
    Opened(OpenedOrder),
    NoPeriod,
    Insufficient { needed: i64, left: i64 },
    TooManyOpen,
    NotConfigured,
}

pub enum CloseOrder {
    Closed(Settlement),
    NotFound,
    NotOpen,
}

fn now_text(now: DateTime<Utc>) -> String {
    now.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn parse_time(text: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(text).map(|t| t.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now())
}

fn short_id(prefix: &str) -> String {
    let token = new_token(prefix);
    token[..prefix.len() + 1 + 16].to_string()
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path).with_context(|| format!("open {}", path.display()))?;
        conn.busy_timeout(std::time::Duration::from_secs(10))?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn: Arc::new(Mutex::new(conn)) })
    }

    fn with<T>(&self, f: impl FnOnce(&mut Connection) -> Result<T>) -> Result<T> {
        let mut conn = self.conn.lock().map_err(|_| anyhow::anyhow!("store lock poisoned"))?;
        f(&mut conn)
    }

    // ---- 后台 ----

    /// 建一个账号（邀请码就是账号）和第一期，发这一期的页额度。返回 (账号, 邀请码原文)。
    pub fn create_account(&self, plan: &str, months: i64, note: &str, now: DateTime<Utc>) -> Result<(String, String)> {
        let credits = billing::plan_credits(plan).with_context(|| format!("unknown plan {plan}"))?;
        let invite = new_token("inv");
        let account_id = short_id("acct");
        self.with(|conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            tx.execute(
                "INSERT INTO accounts (account_id, invite_hash, plan, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![account_id, hash_token(&invite), plan, note, now_text(now)],
            )?;
            insert_period(&tx, &account_id, plan, months, credits, now)?;
            tx.commit()?;
            Ok(())
        })?;
        Ok((account_id, invite))
    }

    /// 续一期（或换档）：新的一期从上一期结束（已经过了就从现在）开始，发新一期的页额度；上一期没用完的不带过来。
    pub fn renew(&self, account_id: &str, plan: Option<&str>, months: i64, now: DateTime<Utc>) -> Result<()> {
        self.with(|conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let current_plan: String = tx
                .query_row("SELECT plan FROM accounts WHERE account_id = ?1", params![account_id], |row| row.get(0))
                .optional()?
                .with_context(|| format!("no account {account_id}"))?;
            let plan = plan.unwrap_or(&current_plan).to_string();
            let credits = billing::plan_credits(&plan).with_context(|| format!("unknown plan {plan}"))?;
            let last_end: Option<String> = tx
                .query_row("SELECT MAX(ends_at) FROM periods WHERE account_id = ?1", params![account_id], |row| row.get(0))?;
            let start = last_end.map(|end| parse_time(&end)).filter(|end| *end > now).unwrap_or(now);
            insert_period(&tx, account_id, &plan, months, credits, start)?;
            tx.execute("UPDATE accounts SET plan = ?1 WHERE account_id = ?2", params![plan, account_id])?;
            tx.commit()?;
            Ok(())
        })
    }

    /// 给当期加页额度（补偿、内测加量、加购）。
    pub fn grant(&self, account_id: &str, credits: i64, note: &str, now: DateTime<Utc>) -> Result<()> {
        anyhow::ensure!(credits > 0, "credits must be positive");
        self.with(|conn| {
            let period = current_period(conn, account_id, now)?.context("account has no current period")?;
            conn.execute(
                "INSERT INTO credit_ledger (account_id, period_id, kind, credits, note, created_at) VALUES (?1, ?2, 'grant', ?3, ?4, ?5)",
                params![account_id, period.0, credits, note, now_text(now)],
            )?;
            Ok(())
        })
    }

    pub fn set_account_status(&self, account_id: &str, status: &str) -> Result<usize> {
        self.with(|conn| Ok(conn.execute("UPDATE accounts SET status = ?1 WHERE account_id = ?2", params![status, account_id])?))
    }

    /// 吊销这个账号绑定的设备（之后同一个邀请码能在别的设备上再激活）。
    pub fn unbind_devices(&self, account_id: &str, now: DateTime<Utc>) -> Result<usize> {
        self.with(|conn| {
            Ok(conn.execute(
                "UPDATE devices SET revoked_at = ?1 WHERE account_id = ?2 AND revoked_at IS NULL",
                params![now_text(now), account_id],
            )?)
        })
    }

    pub fn set_route(&self, route: &Route) -> Result<()> {
        self.with(|conn| {
            conn.execute(
                "INSERT INTO routes (tier, protocol, base_url, model, key_env, per_page_tokens) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(tier) DO UPDATE SET protocol = excluded.protocol, base_url = excluded.base_url, model = excluded.model,
                     key_env = excluded.key_env, per_page_tokens = excluded.per_page_tokens",
                params![route.tier, route.protocol, route.base_url.trim_end_matches('/'), route.model, route.key_env, route.per_page_tokens],
            )?;
            Ok(())
        })
    }

    pub fn routes(&self) -> Result<Vec<Route>> {
        self.with(|conn| {
            let mut stmt = conn.prepare("SELECT tier, protocol, base_url, model, key_env, per_page_tokens FROM routes ORDER BY tier")?;
            let rows = stmt.query_map([], row_to_route)?;
            Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
        })
    }

    pub fn route(&self, tier: &str) -> Result<Option<Route>> {
        self.with(|conn| {
            Ok(conn
                .query_row(
                    "SELECT tier, protocol, base_url, model, key_env, per_page_tokens FROM routes WHERE tier = ?1",
                    params![tier],
                    row_to_route,
                )
                .optional()?)
        })
    }

    /// 账号一览：(账号, 档位, 状态, 备注, 当期剩余页额度)。
    pub fn accounts(&self, now: DateTime<Utc>) -> Result<Vec<(String, String, String, String, i64)>> {
        self.with(|conn| {
            let mut stmt = conn.prepare("SELECT account_id, plan, status, note FROM accounts ORDER BY created_at")?;
            let rows = stmt
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))?
                .collect::<rusqlite::Result<Vec<(String, String, String, String)>>>()?;
            rows.into_iter()
                .map(|(id, plan, status, note)| {
                    let left = match current_period(conn, &id, now)? {
                        Some((period, _)) => balance(conn, &period)?,
                        None => 0,
                    };
                    Ok((id, plan, status, note, left))
                })
                .collect()
        })
    }

    /// 用量汇总：按账号和天（UTC），(日期, 账号, 请求数, 输入, 输出, 缓存读, OCR 页, 结算扣的页额度)。
    pub fn usage_report(&self, since: &str) -> Result<Vec<(String, String, i64, i64, i64, i64, i64, i64)>> {
        self.with(|conn| {
            let mut stmt = conn.prepare(
                "SELECT substr(u.created_at, 1, 10) AS day, u.account_id, COUNT(*), SUM(u.input_tokens), SUM(u.output_tokens),
                        SUM(u.cache_read_tokens), SUM(u.ocr_pages),
                        (SELECT COALESCE(SUM(o.credits_charged), 0) FROM orders o
                         WHERE o.account_id = u.account_id AND substr(o.closed_at, 1, 10) = substr(u.created_at, 1, 10))
                 FROM usage u WHERE u.created_at >= ?1 GROUP BY day, u.account_id ORDER BY day, u.account_id",
            )?;
            let rows = stmt.query_map(params![since], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?))
            })?;
            Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
        })
    }

    // ---- 客户端 ----

    /// 邀请码激活这台设备：一个邀请码同时只绑一台设备（后台解绑后才能换）。
    pub fn activate(&self, invite_code: &str, device_name: &str, now: DateTime<Utc>) -> Result<Activation> {
        self.with(|conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let account: Option<(String, String)> = tx
                .query_row(
                    "SELECT account_id, status FROM accounts WHERE invite_hash = ?1",
                    params![hash_token(invite_code)],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional()?;
            let Some((account_id, status)) = account else { return Ok(Activation::InvalidInvite) };
            if status != "active" {
                return Ok(Activation::InvalidInvite);
            }
            let bound: i64 = tx.query_row(
                "SELECT COUNT(*) FROM devices WHERE account_id = ?1 AND revoked_at IS NULL",
                params![account_id],
                |row| row.get(0),
            )?;
            if bound > 0 {
                return Ok(Activation::AlreadyBound);
            }
            let token = new_token("dev");
            let name: String = device_name.chars().filter(|c| !c.is_control()).take(80).collect();
            tx.execute(
                "INSERT INTO devices (device_id, account_id, token_hash, name, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![short_id("device"), account_id, hash_token(&token), name, now_text(now)],
            )?;
            tx.commit()?;
            Ok(Activation::Activated { device_token: token })
        })
    }

    /// 设备令牌 → 设备（吊销了、账号停了都是 None）。顺手记最近使用时间。
    pub fn authenticate_device(&self, token: &str, now: DateTime<Utc>) -> Result<Option<Device>> {
        self.with(|conn| {
            let device: Option<Device> = conn
                .query_row(
                    "SELECT d.device_id, d.account_id FROM devices d JOIN accounts a ON a.account_id = d.account_id
                     WHERE d.token_hash = ?1 AND d.revoked_at IS NULL AND a.status = 'active'",
                    params![hash_token(token)],
                    |row| Ok(Device { device_id: row.get(0)?, account_id: row.get(1)? }),
                )
                .optional()?;
            if let Some(device) = &device {
                conn.execute("UPDATE devices SET last_used_at = ?1 WHERE device_id = ?2", params![now_text(now), device.device_id])?;
            }
            Ok(device)
        })
    }

    pub fn me(&self, account_id: &str, now: DateTime<Utc>) -> Result<Me> {
        self.with(|conn| {
            let plan: String = conn.query_row("SELECT plan FROM accounts WHERE account_id = ?1", params![account_id], |row| row.get(0))?;
            let Some((period, ends_at)) = current_period(conn, account_id, now)? else {
                return Ok(Me { plan, period_ends_at: None, credits_total: 0, credits_left: 0 });
            };
            let total: i64 = conn.query_row(
                "SELECT COALESCE(SUM(credits), 0) FROM credit_ledger WHERE period_id = ?1 AND kind = 'grant'",
                params![period],
                |row| row.get(0),
            )?;
            Ok(Me { plan, period_ends_at: Some(ends_at), credits_total: total, credits_left: balance(conn, &period)? })
        })
    }

    /// 开单：按 `页数 × 倍数` 预扣当期页额度，token 上限 `页数 × 这一档每页上限`。
    pub fn open_order(&self, device: &Device, mode: Mode, pages: i64, job_ref: &str, now: DateTime<Utc>) -> Result<OpenOrder> {
        let Some(route) = self.route(mode.as_str())? else { return Ok(OpenOrder::NotConfigured) };
        self.with(|conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let Some((period, _)) = current_period(&tx, &device.account_id, now)? else { return Ok(OpenOrder::NoPeriod) };
            let open: i64 = tx.query_row(
                "SELECT COUNT(*) FROM orders WHERE account_id = ?1 AND status = 'open'",
                params![device.account_id],
                |row| row.get(0),
            )?;
            if open >= MAX_OPEN_ORDERS {
                return Ok(OpenOrder::TooManyOpen);
            }
            let needed = pages * mode.multiplier();
            let left = balance(&tx, &period)?;
            if needed > left {
                return Ok(OpenOrder::Insufficient { needed, left });
            }
            let order_id = short_id("order");
            let token = new_token("ord");
            let budget = pages * route.per_page_tokens.max(1);
            let expires_at = now + Duration::hours(ORDER_TTL_HOURS);
            tx.execute(
                "INSERT INTO orders (order_id, account_id, device_id, period_id, token_hash, mode, pages, credits_reserved,
                     token_budget, job_ref, status, created_at, expires_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'open', ?11, ?12)",
                params![
                    order_id, device.account_id, device.device_id, period, hash_token(&token), mode.as_str(), pages, needed,
                    budget, job_ref, now_text(now), now_text(expires_at)
                ],
            )?;
            tx.execute(
                "INSERT INTO credit_ledger (account_id, period_id, kind, credits, order_id, created_at) VALUES (?1, ?2, 'reserve', ?3, ?4, ?5)",
                params![device.account_id, period, -needed, order_id, now_text(now)],
            )?;
            tx.commit()?;
            Ok(OpenOrder::Opened(OpenedOrder {
                order_id,
                order_token: token,
                mode,
                pages,
                credits_reserved: needed,
                token_budget: budget,
                expires_at: now_text(expires_at),
                protocol: route.protocol,
            }))
        })
    }

    /// 单的凭证 → 单（不管状态，调用方看）。
    pub fn order_by_token(&self, token: &str) -> Result<Option<Order>> {
        self.with(|conn| {
            Ok(conn
                .query_row(
                    "SELECT order_id, account_id, mode, pages, credits_reserved, token_budget, tokens_used, ocr_pages, status, expires_at
                     FROM orders WHERE token_hash = ?1",
                    params![hash_token(token)],
                    row_to_order,
                )
                .optional()?)
        })
    }

    /// 记一次转发的用量，加到这单上。
    #[allow(clippy::too_many_arguments)]
    pub fn record_usage(
        &self,
        order: &Order,
        route: &str,
        model: &str,
        upstream_status: u16,
        usage: &crate::proxy::Usage,
        now: DateTime<Utc>,
    ) -> Result<()> {
        self.with(|conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            tx.execute(
                "INSERT INTO usage (order_id, account_id, route, model, upstream_status, input_tokens, output_tokens, cache_read_tokens,
                     cache_write_tokens, ocr_pages, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    order.order_id, order.account_id, route, model, upstream_status, usage.input, usage.output, usage.cache_read,
                    usage.cache_write, usage.ocr_pages, now_text(now)
                ],
            )?;
            tx.execute(
                "UPDATE orders SET tokens_used = tokens_used + ?1, ocr_pages = ocr_pages + ?2 WHERE order_id = ?3",
                params![usage.billable_tokens(), usage.ocr_pages, order.order_id],
            )?;
            tx.commit()?;
            Ok(())
        })
    }

    /// 结算：按实际译成的页扣，剩下的退回（OCR 看到的页数封顶）。
    pub fn settle_order(&self, account_id: &str, order_id: &str, translated_pages: i64, now: DateTime<Utc>) -> Result<CloseOrder> {
        self.close_order(account_id, order_id, now, "settled", |order| {
            billing::settle(order.credits_reserved, order.mode.multiplier(), translated_pages, order.ocr_pages)
        }, Some(translated_pages))
    }

    /// 取消：整单没做成，预扣全退。
    pub fn cancel_order(&self, account_id: &str, order_id: &str, now: DateTime<Utc>) -> Result<CloseOrder> {
        self.close_order(account_id, order_id, now, "cancelled", |order| billing::settle(order.credits_reserved, 1, 0, 0), None)
    }

    fn close_order(
        &self,
        account_id: &str,
        order_id: &str,
        now: DateTime<Utc>,
        status: &str,
        settle: impl FnOnce(&Order) -> Settlement,
        translated_pages: Option<i64>,
    ) -> Result<CloseOrder> {
        self.with(|conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let order = tx
                .query_row(
                    "SELECT order_id, account_id, mode, pages, credits_reserved, token_budget, tokens_used, ocr_pages, status, expires_at
                     FROM orders WHERE order_id = ?1 AND account_id = ?2",
                    params![order_id, account_id],
                    row_to_order,
                )
                .optional()?;
            let Some(order) = order else { return Ok(CloseOrder::NotFound) };
            if order.status != "open" {
                return Ok(CloseOrder::NotOpen);
            }
            let settled = settle(&order);
            finish_order(&tx, &order, status, &settled, translated_pages, now)?;
            tx.commit()?;
            Ok(CloseOrder::Closed(settled))
        })
    }

    /// 超时没结算的单：按已用 token 折成页收掉，其余退回。返回处理了几单。
    pub fn expire_orders(&self, now: DateTime<Utc>) -> Result<usize> {
        self.with(|conn| {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let orders = {
                let mut stmt = tx.prepare(
                    "SELECT order_id, account_id, mode, pages, credits_reserved, token_budget, tokens_used, ocr_pages, status, expires_at
                     FROM orders WHERE status = 'open' AND expires_at <= ?1",
                )?;
                let rows = stmt.query_map(params![now_text(now)], row_to_order)?;
                rows.collect::<rusqlite::Result<Vec<_>>>()?
            };
            for order in &orders {
                let per_page = (order.token_budget / order.pages.max(1)).max(1);
                let settled = billing::expire(order.credits_reserved, order.mode.multiplier(), order.tokens_used, per_page);
                finish_order(&tx, order, "expired", &settled, None, now)?;
            }
            tx.commit()?;
            Ok(orders.len())
        })
    }
}

/// 从 `start` 起连着建 `months` 期，每期 30 天、各发一次这一档的页额度（当月没用完清零：余额只算本期的流水）。
fn insert_period(tx: &rusqlite::Transaction<'_>, account_id: &str, plan: &str, months: i64, credits: i64, start: DateTime<Utc>) -> Result<()> {
    for month in 0..months.max(1) {
        let period_start = start + Duration::days(30 * month);
        let period_end = period_start + Duration::days(30);
        let period_id = short_id("period");
        tx.execute(
            "INSERT INTO periods (period_id, account_id, plan, starts_at, ends_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![period_id, account_id, plan, now_text(period_start), now_text(period_end), now_text(Utc::now())],
        )?;
        tx.execute(
            "INSERT INTO credit_ledger (account_id, period_id, kind, credits, note, created_at) VALUES (?1, ?2, 'grant', ?3, ?4, ?5)",
            params![account_id, period_id, credits, format!("plan {plan}"), now_text(period_start)],
        )?;
    }
    Ok(())
}

fn current_period(conn: &Connection, account_id: &str, now: DateTime<Utc>) -> Result<Option<(String, String)>> {
    let now = now_text(now);
    Ok(conn
        .query_row(
            "SELECT period_id, ends_at FROM periods WHERE account_id = ?1 AND starts_at <= ?2 AND ends_at > ?2
             ORDER BY starts_at DESC LIMIT 1",
            params![account_id, now],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?)
}

fn balance(conn: &Connection, period_id: &str) -> Result<i64> {
    Ok(conn.query_row("SELECT COALESCE(SUM(credits), 0) FROM credit_ledger WHERE period_id = ?1", params![period_id], |row| row.get(0))?)
}

fn finish_order(
    tx: &rusqlite::Transaction<'_>,
    order: &Order,
    status: &str,
    settled: &Settlement,
    translated_pages: Option<i64>,
    now: DateTime<Utc>,
) -> Result<()> {
    let period: String = tx.query_row("SELECT period_id FROM orders WHERE order_id = ?1", params![order.order_id], |row| row.get(0))?;
    tx.execute(
        "UPDATE orders SET status = ?1, translated_pages = ?2, credits_charged = ?3, anomaly = ?4, closed_at = ?5 WHERE order_id = ?6",
        params![status, translated_pages, settled.charged, settled.anomaly, now_text(now), order.order_id],
    )?;
    if settled.refunded > 0 {
        tx.execute(
            "INSERT INTO credit_ledger (account_id, period_id, kind, credits, order_id, note, created_at)
             VALUES (?1, ?2, 'refund', ?3, ?4, ?5, ?6)",
            params![order.account_id, period, settled.refunded, order.order_id, status, now_text(now)],
        )?;
    }
    Ok(())
}

fn row_to_route(row: &rusqlite::Row<'_>) -> rusqlite::Result<Route> {
    Ok(Route {
        tier: row.get(0)?,
        protocol: row.get(1)?,
        base_url: row.get(2)?,
        model: row.get(3)?,
        key_env: row.get(4)?,
        per_page_tokens: row.get(5)?,
    })
}

fn row_to_order(row: &rusqlite::Row<'_>) -> rusqlite::Result<Order> {
    let mode: String = row.get(2)?;
    let expires: String = row.get(9)?;
    Ok(Order {
        order_id: row.get(0)?,
        account_id: row.get(1)?,
        mode: Mode::parse(&mode).unwrap_or(Mode::Classic),
        pages: row.get(3)?,
        credits_reserved: row.get(4)?,
        token_budget: row.get(5)?,
        tokens_used: row.get(6)?,
        ocr_pages: row.get(7)?,
        status: row.get(8)?,
        expires_at: parse_time(&expires),
    })
}
