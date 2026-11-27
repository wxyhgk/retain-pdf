//! `retainpdf-relay serve`：跑中转服务；`retainpdf-relay admin …`：后台操作（ssh 上服务器跑，直接改库，没有管理接口）。

use std::path::PathBuf;
use std::time::Duration;

use anyhow::Result;
use chrono::Utc;
use clap::{Parser, Subcommand};

use retainpdf_relay::store::{Route, Store};
use retainpdf_relay::{app, AppState};

#[derive(Parser)]
#[command(name = "retainpdf-relay", about = "按页卖翻译的中转服务")]
struct Cli {
    /// 库文件。
    #[arg(long, env = "RELAY_DB", default_value = "relay.sqlite")]
    db: PathBuf,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// 跑服务（前面放一个只开 HTTPS 的反向代理）。
    Serve {
        #[arg(long, env = "RELAY_LISTEN", default_value = "127.0.0.1:8790")]
        listen: String,
        /// 客户端从外面访问的地址，比如 https://relay.example.com:8443。
        #[arg(long, env = "RELAY_PUBLIC_URL")]
        public_url: String,
    },
    /// 后台操作。
    Admin {
        #[command(subcommand)]
        command: Admin,
    },
}

#[derive(Subcommand)]
enum Admin {
    /// 建邀请码（就是账号），发第一期的页额度；邀请码只显示这一次。
    InviteCreate {
        #[arg(long)]
        plan: String,
        #[arg(long, default_value_t = 1)]
        months: i64,
        #[arg(long, default_value = "")]
        note: String,
    },
    /// 停用账号（设备令牌、单的凭证都跟着不能用）。
    AccountDisable { account: String },
    AccountEnable { account: String },
    /// 解绑设备（之后同一个邀请码能在别的设备上再激活）。
    DeviceUnbind { account: String },
    /// 给当期加页额度。
    CreditsGrant {
        #[arg(long)]
        account: String,
        #[arg(long)]
        pages: i64,
        #[arg(long, default_value = "")]
        note: String,
    },
    /// 续期（可以换档）。
    Renew {
        #[arg(long)]
        account: String,
        #[arg(long)]
        plan: Option<String>,
        #[arg(long, default_value_t = 1)]
        months: i64,
    },
    /// 配一档的连接：classic、agent（翻译）或 ocr。key 只填环境变量名。
    TierSet {
        #[arg(long)]
        tier: String,
        #[arg(long)]
        protocol: String,
        #[arg(long)]
        base_url: String,
        #[arg(long)]
        model: String,
        #[arg(long)]
        key_env: String,
        /// 每页 token 上限（翻译档；约为平常用量的 3 倍）。
        #[arg(long, default_value_t = 0)]
        per_page_tokens: i64,
    },
    TierShow,
    Accounts,
    /// 按天、按账号的用量。
    Usage {
        #[arg(long, default_value = "1970-01-01")]
        since: String,
    },
    /// 立刻处理超时没结算的单（服务里每 10 分钟也会跑一次）。
    ExpireOrders,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_env_filter(tracing_subscriber::EnvFilter::from_default_env()).init();
    let cli = Cli::parse();
    let store = Store::open(&cli.db)?;
    match cli.command {
        Command::Serve { listen, public_url } => {
            let sweeper = store.clone();
            tokio::spawn(async move {
                let mut ticker = tokio::time::interval(Duration::from_secs(600));
                loop {
                    ticker.tick().await;
                    match sweeper.expire_orders(Utc::now()) {
                        Ok(0) => {}
                        Ok(count) => tracing::info!("expired {count} unsettled order(s)"),
                        Err(error) => tracing::error!("expire orders failed: {error:#}"),
                    }
                }
            });
            let listener = tokio::net::TcpListener::bind(&listen).await?;
            tracing::info!("retainpdf-relay listening on {listen}");
            axum::serve(listener, app(AppState::new(store, public_url)?)).await?;
        }
        Command::Admin { command } => admin(&store, command)?,
    }
    Ok(())
}

fn admin(store: &Store, command: Admin) -> Result<()> {
    let now = Utc::now();
    match command {
        Admin::InviteCreate { plan, months, note } => {
            let (account, invite) = store.create_account(&plan, months, &note, now)?;
            println!("account {account}");
            println!("invite  {invite}   (只显示这一次，发给用户)");
        }
        Admin::AccountDisable { account } => println!("{} updated", store.set_account_status(&account, "disabled")?),
        Admin::AccountEnable { account } => println!("{} updated", store.set_account_status(&account, "active")?),
        Admin::DeviceUnbind { account } => println!("{} device(s) unbound", store.unbind_devices(&account, now)?),
        Admin::CreditsGrant { account, pages, note } => {
            store.grant(&account, pages, &note, now)?;
            println!("granted {pages} page credits to {account}");
        }
        Admin::Renew { account, plan, months } => {
            store.renew(&account, plan.as_deref(), months, now)?;
            println!("renewed {account}");
        }
        Admin::TierSet { tier, protocol, base_url, model, key_env, per_page_tokens } => {
            anyhow::ensure!(matches!(tier.as_str(), "classic" | "agent" | "ocr"), "tier must be classic, agent or ocr");
            anyhow::ensure!(matches!(protocol.as_str(), "anthropic" | "openai" | "glm_ocr"), "protocol must be anthropic, openai or glm_ocr");
            anyhow::ensure!(base_url.starts_with("https://"), "base_url must be https");
            anyhow::ensure!(tier == "ocr" || per_page_tokens > 0, "translation tiers need --per-page-tokens");
            store.set_route(&Route { tier, protocol, base_url, model, key_env, per_page_tokens })?;
            println!("ok");
        }
        Admin::TierShow => {
            for route in store.routes()? {
                let key_set = std::env::var(&route.key_env).map(|value| !value.is_empty()).unwrap_or(false);
                println!(
                    "{:8} {:8} {} {} key_env={} ({}) per_page_tokens={}",
                    route.tier,
                    route.protocol,
                    route.base_url,
                    route.model,
                    route.key_env,
                    if key_set { "set in this shell" } else { "not set in this shell" },
                    route.per_page_tokens
                );
            }
        }
        Admin::Accounts => {
            for (account, plan, status, note, left) in store.accounts(now)? {
                println!("{account} {plan} {status} left={left} {note}");
            }
        }
        Admin::Usage { since } => {
            println!("day        account               requests input output cache_read ocr_pages credits_charged");
            for (day, account, requests, input, output, cache, ocr, charged) in store.usage_report(&since)? {
                println!("{day} {account} {requests} {input} {output} {cache} {ocr} {charged}");
            }
        }
        Admin::ExpireOrders => println!("{} expired", store.expire_orders(now)?),
    }
    Ok(())
}
