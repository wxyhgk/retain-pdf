//! 整条走一遍：邀请码激活 → 开单预扣 → 转发（换上我们的 key 和这一档的模型、记用量、token 上限）→ 结算按页扣、多的退回；
//! 以及 key 不外泄：上游的报错里回显的 key 去掉、上游的响应头不带回去。上游是本机假服务，不花钱。

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::http::{HeaderMap, Request, StatusCode};
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Json, Router};
use chrono::{Duration, Utc};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use retainpdf_relay::store::{Route, Store};
use retainpdf_relay::{app, AppState};

const ANTHROPIC_KEY: &str = "sk-ant-relaytest-0123456789abcdef";
const OPENAI_KEY: &str = "sk-openai-relaytest-0123456789";
const ZHIPU_KEY: &str = "zhipu-relaytest-0123456789abcdef";

#[derive(Default)]
struct Seen {
    requests: Vec<(String, HeaderMap, Value)>,
}

async fn fake_upstream(seen: Arc<Mutex<Seen>>) -> SocketAddr {
    let record = |path: &'static str, seen: Arc<Mutex<Seen>>, reply: Value| {
        post(move |headers: HeaderMap, Json(body): Json<Value>| {
            let seen = seen.clone();
            let reply = reply.clone();
            async move {
                seen.lock().unwrap().requests.push((path.to_string(), headers, body));
                Json(reply)
            }
        })
    };
    let app = Router::new()
        .route(
            "/v1/messages",
            record("anthropic", seen.clone(), json!({"content": [{"type": "text", "text": "译文"}], "usage": {"input_tokens": 1200, "output_tokens": 300}})),
        )
        .route(
            "/v1/chat/completions",
            record("openai", seen.clone(), json!({"choices": [], "usage": {"prompt_tokens": 70000, "completion_tokens": 500}})),
        )
        .route("/layout", record("ocr", seen.clone(), json!({"layout_details": [[], [], [], []], "md_results": ""})))
        .route(
            "/bad/messages",
            post(|| async {
                let mut response = (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({"error": {"message": format!("invalid x-api-key: {ANTHROPIC_KEY}")}})),
                )
                    .into_response();
                response.headers_mut().insert("x-upstream-secret", "do-not-forward".parse().unwrap());
                response
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    addr
}

fn temp_store(name: &str) -> (std::path::PathBuf, Store) {
    let mut bytes = [0u8; 8];
    getrandom::getrandom(&mut bytes).unwrap();
    let dir = std::env::temp_dir().join(format!("relay-{name}-{}", bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()));
    std::fs::create_dir_all(&dir).unwrap();
    let store = Store::open(&dir.join("relay.sqlite")).unwrap();
    (dir, store)
}

fn route(tier: &str, protocol: &str, base_url: String, model: &str, key_env: &str, per_page_tokens: i64) -> Route {
    Route { tier: tier.into(), protocol: protocol.into(), base_url, model: model.into(), key_env: key_env.into(), per_page_tokens }
}

async fn call(router: &Router, method: &str, uri: &str, headers: &[(&str, &str)], body: Option<Value>) -> (StatusCode, HeaderMap, Value) {
    let mut request = Request::builder().method(method).uri(uri).header("content-type", "application/json");
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    let body = body.map(|value| Body::from(value.to_string())).unwrap_or_else(Body::empty);
    let response = router.clone().oneshot(request.body(body).unwrap()).await.unwrap();
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, headers, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

#[tokio::test]
async fn invite_order_relay_and_settle() {
    std::env::set_var("RELAY_TEST_ANTHROPIC_KEY", ANTHROPIC_KEY);
    std::env::set_var("RELAY_TEST_OPENAI_KEY", OPENAI_KEY);
    std::env::set_var("RELAY_TEST_ZHIPU_KEY", ZHIPU_KEY);
    let seen = Arc::new(Mutex::new(Seen::default()));
    let upstream = fake_upstream(seen.clone()).await;
    let (dir, store) = temp_store("flow");
    store.set_route(&route("classic", "anthropic", format!("http://{upstream}/v1"), "claude-haiku-5-5", "RELAY_TEST_ANTHROPIC_KEY", 30_000)).unwrap();
    store.set_route(&route("agent", "openai", format!("http://{upstream}/v1"), "qwen3.8-flash", "RELAY_TEST_OPENAI_KEY", 60_000)).unwrap();
    store.set_route(&route("ocr", "glm_ocr", format!("http://{upstream}/layout"), "glm-ocr", "RELAY_TEST_ZHIPU_KEY", 0)).unwrap();
    let (account, invite) = store.create_account("basic", 1, "内测", Utc::now()).unwrap();
    let router = app(AppState::new(store.clone(), "https://relay.example.com:8443".into()).unwrap());

    // 激活：一个邀请码只绑一台设备
    let (status, _, activated) = call(&router, "POST", "/v1/devices/activate", &[], Some(json!({"invite_code": invite, "device_name": "mac"}))).await;
    assert_eq!(status, StatusCode::OK);
    let device_token = activated["device_token"].as_str().unwrap().to_string();
    let bearer = format!("Bearer {device_token}");
    let device = [("authorization", bearer.as_str())];
    let (status, _, _) = call(&router, "POST", "/v1/devices/activate", &[], Some(json!({"invite_code": invite}))).await;
    assert_eq!(status, StatusCode::CONFLICT);
    let (status, _, _) = call(&router, "POST", "/v1/devices/activate", &[], Some(json!({"invite_code": "inv_wrong"}))).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let (_, _, me) = call(&router, "GET", "/v1/me", &device, None).await;
    assert_eq!((me["plan"].as_str(), me["credits_total"].as_i64(), me["credits_left"].as_i64()), (Some("basic"), Some(400), Some(400)));

    // 开单：普通 10 页预扣 10，token 上限 10 × 30000；额度不够 402
    let (status, _, order) = call(&router, "POST", "/v1/orders", &device, Some(json!({"mode": "classic", "pages": 10, "job_ref": "job-1"}))).await;
    assert_eq!(status, StatusCode::OK, "{order}");
    assert_eq!((order["credits_reserved"].as_i64(), order["token_budget"].as_i64()), (Some(10), Some(300_000)));
    assert_eq!(order["endpoints"]["translation"]["base_url"], "https://relay.example.com:8443/relay/anthropic/v1");
    let order_id = order["order_id"].as_str().unwrap().to_string();
    let order_token = order["order_token"].as_str().unwrap().to_string();
    assert_eq!(call(&router, "GET", "/v1/me", &device, None).await.2["credits_left"], 390);
    let (status, _, _) = call(&router, "POST", "/v1/orders", &device, Some(json!({"mode": "agent", "pages": 1000}))).await;
    assert_eq!(status, StatusCode::PAYMENT_REQUIRED);

    // 转发：上游收到的是我们的 key 和这一档的模型；客户端选的模型不算
    let (status, _, reply) = call(
        &router,
        "POST",
        "/relay/anthropic/v1/messages",
        &[("x-api-key", order_token.as_str()), ("anthropic-version", "2023-06-01")],
        Some(json!({"model": "claude-opus-5-5", "max_tokens": 10, "messages": [{"role": "user", "content": "hi"}]})),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(reply["content"][0]["text"], "译文");
    {
        let seen = seen.lock().unwrap();
        let (path, headers, body) = seen.requests.last().unwrap();
        assert_eq!(path, "anthropic");
        assert_eq!(headers.get("x-api-key").unwrap(), ANTHROPIC_KEY);
        assert_eq!(body["model"], "claude-haiku-5-5");
    }
    // 这一单是 Anthropic 协议，走 OpenAI 的地址 400
    let order_bearer = format!("Bearer {order_token}");
    let (status, _, _) = call(&router, "POST", "/relay/openai/v1/chat/completions", &[("authorization", order_bearer.as_str())], Some(json!({"messages": []}))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    // OCR：中转自己数页（4 页），上游收到智谱的 key
    let (status, _, _) = call(&router, "POST", "/relay/glm/api/paas/v4/layout_parsing", &[("authorization", order_bearer.as_str())], Some(json!({"model": "x", "file": "data:application/pdf;base64,AA=="}))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(seen.lock().unwrap().requests.last().unwrap().1.get("authorization").unwrap(), &format!("Bearer {ZHIPU_KEY}"));

    // 结算：报译成 6 页，但 OCR 只看到 4 页 → 按 4 页扣，退 6
    let (status, _, settled) = call(&router, "POST", &format!("/v1/orders/{order_id}/settle"), &device, Some(json!({"translated_pages": 6}))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!((settled["credits_charged"].as_i64(), settled["credits_refunded"].as_i64()), (Some(4), Some(6)));
    assert_eq!(call(&router, "GET", "/v1/me", &device, None).await.2["credits_left"], 396);
    // 结算过的单的凭证不能再用，也不能再结算
    let (status, _, _) = call(&router, "POST", "/relay/anthropic/v1/messages", &[("x-api-key", order_token.as_str())], Some(json!({"messages": []}))).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let (status, _, _) = call(&router, "POST", &format!("/v1/orders/{order_id}/settle"), &device, Some(json!({"translated_pages": 1}))).await;
    assert_eq!(status, StatusCode::CONFLICT);

    // token 上限：agent 1 页（上限 60000），第一次就用了 70500 → 第二次 429
    let (_, _, agent) = call(&router, "POST", "/v1/orders", &device, Some(json!({"mode": "agent", "pages": 1}))).await;
    assert_eq!(agent["credits_reserved"], 3);
    let agent_bearer = format!("Bearer {}", agent["order_token"].as_str().unwrap());
    let (status, _, _) = call(&router, "POST", "/relay/openai/v1/chat/completions", &[("authorization", agent_bearer.as_str())], Some(json!({"messages": []}))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(seen.lock().unwrap().requests.last().unwrap().2["model"], "qwen3.8-flash");
    let (status, _, budget) = call(&router, "POST", "/relay/openai/v1/chat/completions", &[("authorization", agent_bearer.as_str())], Some(json!({"messages": []}))).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(budget["error"]["code"], "order_token_budget_exceeded");
    // 取消：预扣全退
    let agent_id = agent["order_id"].as_str().unwrap();
    let (_, _, cancelled) = call(&router, "POST", &format!("/v1/orders/{agent_id}/cancel"), &device, None).await;
    assert_eq!(cancelled["credits_refunded"], 3);
    assert_eq!(call(&router, "GET", "/v1/me", &device, None).await.2["credits_left"], 396);

    // key 不外泄：上游报错里回显的 key 去掉，上游的响应头不带回去
    store.set_route(&route("classic", "anthropic", format!("http://{upstream}/bad"), "claude-haiku-5-5", "RELAY_TEST_ANTHROPIC_KEY", 30_000)).unwrap();
    let (_, _, bad_order) = call(&router, "POST", "/v1/orders", &device, Some(json!({"mode": "classic", "pages": 1}))).await;
    let (status, headers, body) = call(
        &router,
        "POST",
        "/relay/anthropic/v1/messages",
        &[("x-api-key", bad_order["order_token"].as_str().unwrap())],
        Some(json!({"messages": []})),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert!(!body.to_string().contains(ANTHROPIC_KEY), "{body}");
    assert!(headers.get("x-upstream-secret").is_none());

    // 超时没结算：按已用 token 收（这单没用 token，全退）
    assert_eq!(store.expire_orders(Utc::now() + Duration::hours(25)).unwrap(), 1);
    assert_eq!(call(&router, "GET", "/v1/me", &device, None).await.2["credits_left"], 396);

    // 解绑设备以后旧的设备令牌不能用；没带、乱带凭证都是 401
    store.unbind_devices(&account, Utc::now()).unwrap();
    assert_eq!(call(&router, "GET", "/v1/me", &device, None).await.0, StatusCode::UNAUTHORIZED);
    assert_eq!(call(&router, "POST", "/relay/anthropic/v1/messages", &[], Some(json!({}))).await.0, StatusCode::UNAUTHORIZED);
    assert_eq!(
        call(&router, "POST", "/relay/anthropic/v1/messages", &[("x-api-key", "ord_nope")], Some(json!({}))).await.0,
        StatusCode::UNAUTHORIZED
    );
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn the_database_never_stores_tokens_or_keys_in_clear() {
    let (dir, store) = temp_store("hashes");
    store.set_route(&route("classic", "anthropic", "https://api.anthropic.com/v1".into(), "claude-haiku-5-5", "RELAY_KEY_ANTHROPIC", 30_000)).unwrap();
    let (_, invite) = store.create_account("pro", 2, "", Utc::now()).unwrap();
    let retainpdf_relay::store::Activation::Activated { device_token } = store.activate(&invite, "mac", Utc::now()).unwrap() else {
        panic!("activated")
    };
    drop(store);
    let raw = std::fs::read(dir.join("relay.sqlite")).unwrap();
    let wal = std::fs::read(dir.join("relay.sqlite-wal")).unwrap_or_default();
    for haystack in [&raw, &wal] {
        let text = String::from_utf8_lossy(haystack);
        assert!(!text.contains(&invite), "invite code stored in clear");
        assert!(!text.contains(&device_token), "device token stored in clear");
    }
    let _ = std::fs::remove_dir_all(dir);
}
