//! 端点实际使用计数，以及按接口的状态码分类、耗时分桶（2026-11-24 起，`GET /metrics` 读的也是这里）。
//!
//! 存在的理由:静态分析判不了哪些端点是死的。前端的 URL 是拼出来的——
//! `buildApiEndpoint(apiPrefix, "library/books")`——路径只以片段形式出现在源码里,
//! grep 搜不到完整 URL。盘点时因此连踩两次误报(见
//! `ops/reports/api-endpoint-audit.md`),最离谱的一次是
//! `internal/agent/operations`:前端零引用、看着像死端点,实际调用方是 AI 服务。
//!
//! 所以删端点之前先量一段真实使用。计的是**路由模板**(`/api/v1/jobs/:job_id`)
//! 而不是具体 URL,否则每个 job_id 都会变成一个条目。
//!
//! 计数是累加的:启动时从磁盘读回,所以重启不清零,跑一两周的数据才有意义。
//!
//! 热路径上只做原子加：登记表里的每个接口（GET 的再加一个 HEAD）启动时就建好计数器，表本身之后只读、不加锁；
//! 只有登记表里没有的方法加地址（405、旧数据里已删掉的接口）走一把锁，很少见。
//!
//! 耗时是拿到回应头的耗时（处理函数返回），不含传正文：大文件下载只算到开始传。事件流（SSE）、WebSocket
//! 这类长连接回应头很快、之后一直开着，单独计数，不进耗时分桶，免得把它们算成快请求或慢请求。

use std::collections::{BTreeMap, HashMap};
use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use axum::extract::{MatchedPath, Request};
use axum::http::{header, StatusCode};
use axum::middleware::Next;
use axum::response::Response;
use serde::{Deserialize, Serialize};

/// 状态码分类，下标是 `状态码 / 100 - 1`。
const STATUS_CLASSES: [&str; 5] = ["1xx", "2xx", "3xx", "4xx", "5xx"];

/// 耗时分桶的上界（毫秒）；超过最后一个上界的落进最后一桶。
const LATENCY_BOUNDS_MS: [u64; 4] = [50, 200, 1_000, 5_000];
/// 用量文件里各桶的键，和上面的上界一一对应，多一个“超过 5 秒”。
const LATENCY_BUCKET_KEYS: [&str; 5] = ["le_50", "le_200", "le_1000", "le_5000", "gt_5000"];

#[derive(Debug, Default, Serialize, Deserialize)]
struct UsageFile {
    /// 首次开始计数的时刻,用来判断样本覆盖了多长时间。
    since: String,
    updated_at: String,
    /// `"GET /api/v1/jobs/:job_id" -> 次数`
    routes: BTreeMap<String, u64>,
    /// 2026-11-24 起：同一个键的状态码分类、耗时分桶。以前的文件没有这一项，读进来当空的。
    #[serde(default)]
    route_stats: BTreeMap<String, RouteStats>,
}

/// 一个接口的状态码分类和耗时分桶（落盘的样子）。只写不为零的项。
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
struct RouteStats {
    /// `"2xx" -> 次数`
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    status: BTreeMap<String, u64>,
    /// `"le_50" | "le_200" | "le_1000" | "le_5000" | "gt_5000" -> 次数`（每桶各自的次数，不累计）
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    latency_ms: BTreeMap<String, u64>,
    /// 进了耗时分桶的那些请求的耗时合计（微秒）。
    #[serde(default, skip_serializing_if = "is_zero")]
    latency_us_sum: u64,
    /// 事件流、WebSocket 这类长连接的次数（不进耗时分桶）。
    #[serde(default, skip_serializing_if = "is_zero")]
    streaming: u64,
}

fn is_zero(value: &u64) -> bool {
    *value == 0
}

/// 一个接口的计数器，全是原子数。
#[derive(Default)]
struct RouteCounters {
    requests: AtomicU64,
    status: [AtomicU64; 5],
    latency: [AtomicU64; 5],
    latency_us_sum: AtomicU64,
    streaming: AtomicU64,
}

impl RouteCounters {
    fn observe(&self, status: u16, latency: Duration, streaming: bool) {
        self.requests.fetch_add(1, Ordering::Relaxed);
        if let Some(index) = status_class_index(status) {
            self.status[index].fetch_add(1, Ordering::Relaxed);
        }
        if streaming {
            self.streaming.fetch_add(1, Ordering::Relaxed);
        } else {
            self.latency[latency_bucket_index(latency)].fetch_add(1, Ordering::Relaxed);
            let micros = u64::try_from(latency.as_micros()).unwrap_or(u64::MAX);
            self.latency_us_sum.fetch_add(micros, Ordering::Relaxed);
        }
    }

    fn add(&self, requests: u64, stats: Option<&RouteStats>) {
        self.requests.fetch_add(requests, Ordering::Relaxed);
        let Some(stats) = stats else { return };
        for (index, class) in STATUS_CLASSES.iter().enumerate() {
            if let Some(count) = stats.status.get(*class) {
                self.status[index].fetch_add(*count, Ordering::Relaxed);
            }
        }
        for (index, key) in LATENCY_BUCKET_KEYS.iter().enumerate() {
            if let Some(count) = stats.latency_ms.get(*key) {
                self.latency[index].fetch_add(*count, Ordering::Relaxed);
            }
        }
        self.latency_us_sum.fetch_add(stats.latency_us_sum, Ordering::Relaxed);
        self.streaming.fetch_add(stats.streaming, Ordering::Relaxed);
    }

    fn snapshot(&self) -> RouteSnapshot {
        RouteSnapshot {
            requests: self.requests.load(Ordering::Relaxed),
            status: std::array::from_fn(|index| self.status[index].load(Ordering::Relaxed)),
            latency: std::array::from_fn(|index| self.latency[index].load(Ordering::Relaxed)),
            latency_us_sum: self.latency_us_sum.load(Ordering::Relaxed),
            streaming: self.streaming.load(Ordering::Relaxed),
        }
    }
}

fn status_class_index(status: u16) -> Option<usize> {
    match status {
        100..=599 => Some(usize::from(status / 100 - 1)),
        _ => None,
    }
}

fn latency_bucket_index(latency: Duration) -> usize {
    let millis = latency.as_millis();
    LATENCY_BOUNDS_MS
        .iter()
        .position(|bound| millis <= u128::from(*bound))
        .unwrap_or(LATENCY_BOUNDS_MS.len())
}

/// 某一刻读出来的一个接口的数（各项分别读，彼此之间可能差一两个正在进行的请求）。
#[derive(Clone, Debug, Default, PartialEq, Eq)]
struct RouteSnapshot {
    requests: u64,
    status: [u64; 5],
    latency: [u64; 5],
    latency_us_sum: u64,
    streaming: u64,
}

impl RouteSnapshot {
    fn to_stats(&self) -> RouteStats {
        let nonzero = |keys: &[&str], values: &[u64]| -> BTreeMap<String, u64> {
            keys.iter()
                .zip(values)
                .filter(|(_, count)| **count > 0)
                .map(|(key, count)| (key.to_string(), *count))
                .collect()
        };
        RouteStats {
            status: nonzero(&STATUS_CLASSES, &self.status),
            latency_ms: nonzero(&LATENCY_BUCKET_KEYS, &self.latency),
            latency_us_sum: self.latency_us_sum,
            streaming: self.streaming,
        }
    }
}

/// 全部接口的计数器。
struct Stats {
    /// 路由模板 → [(方法, 计数器)]。建好以后只读。
    registered: HashMap<&'static str, Vec<(&'static str, RouteCounters)>>,
    /// 登记表里没有的 `"方法 模板"`。
    extra: Mutex<BTreeMap<String, RouteCounters>>,
}

impl Stats {
    fn new(endpoints: impl IntoIterator<Item = (&'static str, &'static str)>) -> Self {
        let mut registered: HashMap<&'static str, Vec<(&'static str, RouteCounters)>> = HashMap::new();
        for (method, path) in endpoints {
            let methods = registered.entry(path).or_default();
            // axum 给 GET 路由自动接 HEAD，用量里记成 `HEAD /路径`。
            let implied_head = (method == "GET").then_some("HEAD");
            for method in std::iter::once(method).chain(implied_head) {
                if !methods.iter().any(|(known, _)| *known == method) {
                    methods.push((method, RouteCounters::default()));
                }
            }
        }
        Self {
            registered,
            extra: Mutex::new(BTreeMap::new()),
        }
    }

    fn with_counters(&self, method: &str, path: &str, f: impl FnOnce(&RouteCounters)) {
        if let Some((_, counters)) = self
            .registered
            .get(path)
            .and_then(|methods| methods.iter().find(|(known, _)| *known == method))
        {
            f(counters);
            return;
        }
        let mut extra = self.extra.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        f(extra.entry(format!("{method} {path}")).or_default());
    }

    fn observe(&self, method: &str, path: &str, status: u16, latency: Duration, streaming: bool) {
        self.with_counters(method, path, |counters| counters.observe(status, latency, streaming));
    }

    /// 把用量文件里的数加进来（启动时读回）。
    fn load(&self, file: &UsageFile) {
        for (key, requests) in &file.routes {
            let (method, path) = key.split_once(' ').unwrap_or(("", key.as_str()));
            self.with_counters(method, path, |counters| counters.add(*requests, file.route_stats.get(key)));
        }
    }

    /// 有过请求的接口，按 `"方法 模板"` 排序。
    fn snapshot(&self) -> BTreeMap<String, RouteSnapshot> {
        let mut out = BTreeMap::new();
        for (path, methods) in &self.registered {
            for (method, counters) in methods {
                let snapshot = counters.snapshot();
                if snapshot.requests > 0 {
                    out.insert(format!("{method} {path}"), snapshot);
                }
            }
        }
        let extra = self.extra.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        for (key, counters) in extra.iter() {
            let snapshot = counters.snapshot();
            if snapshot.requests > 0 {
                out.insert(key.clone(), snapshot);
            }
        }
        out
    }

    fn usage_file(&self, since: &str) -> UsageFile {
        let snapshot = self.snapshot();
        UsageFile {
            since: since.to_string(),
            updated_at: crate::models::domain::now_iso(),
            routes: snapshot.iter().map(|(key, s)| (key.clone(), s.requests)).collect(),
            route_stats: snapshot.iter().map(|(key, s)| (key.clone(), s.to_stats())).collect(),
        }
    }

    /// Prometheus 文本格式的按接口部分（`GET /metrics`）。
    fn render_prometheus(&self, out: &mut String) {
        let snapshot = self.snapshot();
        let labels = |key: &str| -> String {
            let (method, route) = key.split_once(' ').unwrap_or(("", key));
            format!("method=\"{}\",route=\"{}\"", escape_label(method), escape_label(route))
        };

        out.push_str(
            "# HELP retainpdf_http_requests_total 按接口（路由模板）和状态码分类计的请求数，从用量文件的 since 起累计，重启不清零；\
             status=\"unknown\" 是 2026-11-24 以前只计了次数的部分。\n\
             # TYPE retainpdf_http_requests_total counter\n",
        );
        for (key, route) in &snapshot {
            let labels = labels(key);
            for (class, count) in STATUS_CLASSES.iter().zip(route.status) {
                if count > 0 {
                    let _ = writeln!(out, "retainpdf_http_requests_total{{{labels},status=\"{class}\"}} {count}");
                }
            }
            let unknown = route.requests.saturating_sub(route.status.iter().sum());
            if unknown > 0 {
                let _ = writeln!(out, "retainpdf_http_requests_total{{{labels},status=\"unknown\"}} {unknown}");
            }
        }

        out.push_str(
            "# HELP retainpdf_http_request_duration_seconds 拿到回应头的耗时（不含传正文）；事件流、WebSocket 不计。\n\
             # TYPE retainpdf_http_request_duration_seconds histogram\n",
        );
        for (key, route) in &snapshot {
            let timed: u64 = route.latency.iter().sum();
            if timed == 0 {
                continue;
            }
            let labels = labels(key);
            let mut cumulative = 0;
            for (bound, count) in LATENCY_BOUNDS_MS.iter().zip(route.latency) {
                cumulative += count;
                let le = *bound as f64 / 1000.0;
                let _ = writeln!(out, "retainpdf_http_request_duration_seconds_bucket{{{labels},le=\"{le}\"}} {cumulative}");
            }
            let _ = writeln!(out, "retainpdf_http_request_duration_seconds_bucket{{{labels},le=\"+Inf\"}} {timed}");
            let seconds = route.latency_us_sum as f64 / 1_000_000.0;
            let _ = writeln!(out, "retainpdf_http_request_duration_seconds_sum{{{labels}}} {seconds}");
            let _ = writeln!(out, "retainpdf_http_request_duration_seconds_count{{{labels}}} {timed}");
        }

        out.push_str(
            "# HELP retainpdf_http_streaming_requests_total 事件流（SSE）、WebSocket 这类长连接的请求数，不进耗时直方图。\n\
             # TYPE retainpdf_http_streaming_requests_total counter\n",
        );
        for (key, route) in &snapshot {
            if route.streaming > 0 {
                let _ = writeln!(out, "retainpdf_http_streaming_requests_total{{{}}} {}", labels(key), route.streaming);
            }
        }
    }
}

/// Prometheus 标签值里的反斜杠、引号、换行要转义。
fn escape_label(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n")
}

/// 进程里唯一的一份计数。第一次用到时按登记表建好（单测里也会建，只是不落盘）。
fn stats() -> &'static Stats {
    static STATS: OnceLock<Stats> = OnceLock::new();
    STATS.get_or_init(|| {
        Stats::new(
            crate::app::registered_endpoints()
                .into_iter()
                .map(|endpoint| (endpoint.method, endpoint.path)),
        )
    })
}

struct Persistence {
    path: PathBuf,
    since: String,
}

static PERSISTENCE: OnceLock<Persistence> = OnceLock::new();

fn usage_path(data_root: &Path) -> PathBuf {
    data_root.join("diagnostics").join("route-usage.json")
}

/// 从磁盘读回既有计数。读不到就从零开始——这个文件丢了只是少一段样本,
/// 不该让服务起不来。
pub(crate) fn init(data_root: &Path) {
    if PERSISTENCE.get().is_some() {
        return;
    }
    let path = usage_path(data_root);
    let file: UsageFile = std::fs::read_to_string(&path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default();
    let since = if file.since.is_empty() {
        crate::models::domain::now_iso()
    } else {
        file.since.clone()
    };
    if PERSISTENCE.set(Persistence { path, since }).is_ok() {
        stats().load(&file);
    }
}

/// 事件流（`text/event-stream`）和 WebSocket（101）是长连接，不进耗时分桶。
fn is_streaming(response: &Response) -> bool {
    response.status() == StatusCode::SWITCHING_PROTOCOLS
        || response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.starts_with("text/event-stream"))
}

/// 记一次。拿不到 `MatchedPath` 的请求(404 到 fallback)不计——它们没有路由模板,
/// 计进来只会是一堆噪音。打开了访问日志（`RUST_API_ACCESS_LOG`）时，每个请求（包括没匹配上的）记一行。
pub(crate) async fn record(request: Request, next: Next) -> Response {
    let matched = request.extensions().get::<MatchedPath>().cloned();
    let method = request.method().clone();
    let request_id = super::request_log::access_log_enabled()
        .then(|| super::request_log::request_id_of(request.headers()))
        .flatten();
    let started = Instant::now();
    let response = next.run(request).await;
    let latency = started.elapsed();
    let status = response.status().as_u16();
    let streaming = is_streaming(&response);
    if let Some(matched) = &matched {
        stats().observe(method.as_str(), matched.as_str(), status, latency, streaming);
    }
    if super::request_log::access_log_enabled() {
        super::request_log::log_access(
            method.as_str(),
            matched.as_ref().map(MatchedPath::as_str),
            status,
            latency,
            streaming,
            request_id.as_deref(),
        );
    }
    response
}

/// `GET /metrics` 的按接口部分。
pub(crate) fn render_prometheus(out: &mut String) {
    stats().render_prometheus(out);
}

/// 落盘。由后台任务周期调用——每次请求都写盘没必要,丢掉最后一个周期的
/// 计数对「这个端点有没有人用」这个问题毫无影响。
pub(crate) fn flush() {
    let Some(persistence) = PERSISTENCE.get() else {
        return;
    };
    write_usage_file(stats(), persistence);
}

fn write_usage_file(stats: &Stats, persistence: &Persistence) {
    let Ok(text) = serde_json::to_string_pretty(&stats.usage_file(&persistence.since)) else {
        return;
    };
    if let Some(parent) = persistence.path.parent() {
        if std::fs::create_dir_all(parent).is_err() {
            return;
        }
    }
    // 同目录临时文件 + rename:读这个文件的人(运维、脚本)不该看到写了一半的 JSON。
    let temp = persistence.path.with_extension("json.tmp");
    if std::fs::write(&temp, text).is_ok() {
        let _ = std::fs::rename(&temp, &persistence.path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!("route-usage-{}", fastrand::u64(..)));
        std::fs::create_dir_all(&root).expect("temp root");
        root
    }

    fn test_stats() -> Stats {
        Stats::new([
            ("GET", "/api/v1/jobs/:job_id"),
            ("POST", "/api/v1/jobs"),
            ("GET", "/api/v1/jobs/:job_id/progress/stream"),
        ])
    }

    /// 计的必须是路由模板,不是具体 URL。
    ///
    /// 这是这个功能能不能用的关键:按具体 URL 计,每个 job_id 都会变成一个条目,
    /// 跑一天就是几万行,而「/jobs/:job_id 有没有人用」这个问题反而看不出来。
    #[test]
    fn counts_route_templates_not_concrete_urls() {
        let root = temp_root();
        let stats = test_stats();
        // 模拟同一路由被不同 job_id 命中三次（中间件拿到的是 MatchedPath，即模板）。
        for _ in 0..3 {
            stats.observe("GET", "/api/v1/jobs/:job_id", 200, Duration::from_millis(3), false);
        }
        let persistence = Persistence {
            path: usage_path(&root),
            since: "2026-11-01T00:00:00Z".to_string(),
        };
        write_usage_file(&stats, &persistence);

        let text = std::fs::read_to_string(usage_path(&root)).expect("落盘文件");
        let parsed: UsageFile = serde_json::from_str(&text).expect("解析");
        assert_eq!(
            parsed.routes.get("GET /api/v1/jobs/:job_id"),
            Some(&3),
            "三次请求应当合并到同一个模板条目上"
        );
        assert_eq!(parsed.routes.len(), 1, "没有请求的接口不写进文件");
        assert_eq!(parsed.since, "2026-11-01T00:00:00Z", "since 用来判断样本覆盖多长时间");
        assert!(!parsed.updated_at.is_empty());
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn status_classes_and_latency_buckets() {
        let stats = test_stats();
        let ms = Duration::from_millis;
        stats.observe("POST", "/api/v1/jobs", 201, ms(10), false);
        stats.observe("POST", "/api/v1/jobs", 201, ms(50), false);
        stats.observe("POST", "/api/v1/jobs", 400, ms(51), false);
        stats.observe("POST", "/api/v1/jobs", 503, ms(1_500), false);
        stats.observe("POST", "/api/v1/jobs", 500, ms(9_000), false);
        // 事件流：不进耗时分桶，哪怕连着开了一小时。
        stats.observe("GET", "/api/v1/jobs/:job_id/progress/stream", 200, Duration::from_secs(3_600), true);

        let file = stats.usage_file("s");
        let jobs = &file.route_stats["POST /api/v1/jobs"];
        assert_eq!(file.routes["POST /api/v1/jobs"], 5);
        assert_eq!(
            jobs.status,
            BTreeMap::from([("2xx".into(), 2), ("4xx".into(), 1), ("5xx".into(), 2)])
        );
        assert_eq!(
            jobs.latency_ms,
            BTreeMap::from([
                ("le_50".into(), 2),
                ("le_200".into(), 1),
                ("le_5000".into(), 1),
                ("gt_5000".into(), 1),
            ])
        );
        assert_eq!(jobs.latency_us_sum, 10_611_000);
        assert_eq!(jobs.streaming, 0);

        let stream = &file.route_stats["GET /api/v1/jobs/:job_id/progress/stream"];
        assert_eq!(stream.streaming, 1);
        assert!(stream.latency_ms.is_empty(), "长连接不算慢请求");
        assert_eq!(stream.latency_us_sum, 0);
    }

    /// 重启后接着累加；以前只有 `routes` 的文件照样读得进来。登记表外的键（HEAD 以外的未知方法、已删的接口）也留着。
    #[test]
    fn loads_old_and_new_files_and_keeps_unknown_keys() {
        let old: UsageFile = serde_json::from_str(
            r#"{"since":"2026-10-01T00:00:00Z","updated_at":"x","routes":{"GET /api/v1/jobs/:job_id":7,"GET /api/v1/gone":2}}"#,
        )
        .expect("旧格式");
        let stats = test_stats();
        stats.load(&old);
        stats.observe("GET", "/api/v1/jobs/:job_id", 404, Duration::from_millis(1), false);
        stats.observe("HEAD", "/api/v1/jobs/:job_id", 200, Duration::from_millis(1), false);
        stats.observe("DELETE", "/api/v1/jobs", 405, Duration::from_millis(1), false);

        let file = stats.usage_file("2026-10-01T00:00:00Z");
        assert_eq!(file.routes["GET /api/v1/jobs/:job_id"], 8);
        assert_eq!(file.routes["HEAD /api/v1/jobs/:job_id"], 1);
        assert_eq!(file.routes["GET /api/v1/gone"], 2);
        assert_eq!(file.routes["DELETE /api/v1/jobs"], 1);

        // 新格式写出去再读回来，一个数不差。
        let text = serde_json::to_string(&file).expect("写");
        let again = test_stats();
        again.load(&serde_json::from_str(&text).expect("读"));
        let reloaded = again.usage_file("2026-10-01T00:00:00Z");
        assert_eq!(reloaded.routes, file.routes);
        assert_eq!(reloaded.route_stats, file.route_stats);
    }

    #[test]
    fn prometheus_text_uses_templates_and_cumulative_buckets() {
        let stats = test_stats();
        stats.observe("GET", "/api/v1/jobs/:job_id", 200, Duration::from_millis(30), false);
        stats.observe("GET", "/api/v1/jobs/:job_id", 500, Duration::from_millis(300), false);
        stats.observe("GET", "/api/v1/jobs/:job_id/progress/stream", 200, Duration::from_secs(60), true);
        stats.load(&serde_json::from_str(r#"{"since":"","updated_at":"","routes":{"POST /api/v1/jobs":4}}"#).unwrap());

        let mut text = String::new();
        stats.render_prometheus(&mut text);
        let job = r#"method="GET",route="/api/v1/jobs/:job_id""#;
        for line in [
            format!("retainpdf_http_requests_total{{{job},status=\"2xx\"}} 1"),
            format!("retainpdf_http_requests_total{{{job},status=\"5xx\"}} 1"),
            r#"retainpdf_http_requests_total{method="POST",route="/api/v1/jobs",status="unknown"} 4"#.to_string(),
            format!("retainpdf_http_request_duration_seconds_bucket{{{job},le=\"0.05\"}} 1"),
            format!("retainpdf_http_request_duration_seconds_bucket{{{job},le=\"0.2\"}} 1"),
            format!("retainpdf_http_request_duration_seconds_bucket{{{job},le=\"1\"}} 2"),
            format!("retainpdf_http_request_duration_seconds_bucket{{{job},le=\"+Inf\"}} 2"),
            format!("retainpdf_http_request_duration_seconds_sum{{{job}}} 0.33"),
            format!("retainpdf_http_request_duration_seconds_count{{{job}}} 2"),
            r#"retainpdf_http_streaming_requests_total{method="GET",route="/api/v1/jobs/:job_id/progress/stream"} 1"#
                .to_string(),
        ] {
            assert!(text.lines().any(|l| l == line), "缺 {line}\n{text}");
        }
        assert!(
            !text.contains("progress/stream\",le="),
            "长连接不进耗时直方图\n{text}"
        );
        assert!(!text.contains(r#"route="/api/v1/jobs",le="#), "只有次数的旧数据不出直方图");
    }

    #[test]
    fn label_values_are_escaped() {
        assert_eq!(escape_label(r#"a"b\c"#), r#"a\"b\\c"#);
        assert_eq!(escape_label("a\nb"), "a\\nb");
    }
}
