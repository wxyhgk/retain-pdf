use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::{build_app, build_simple_app};
use crate::config::JobsRuntimeMode;
use crate::routes::common::build_health_route_deps;
use crate::runtime::jobsd_supervisor;
use crate::services::platform::build_readiness_view;

#[tokio::test]
async fn liveness_and_readiness_are_public_on_both_routers() {
    for app in [
        build_app(test_state("health-full-router")),
        build_simple_app(test_state("health-simple-router")),
    ] {
        for uri in ["/health", "/ready"] {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri(uri)
                        .body(Body::empty())
                        .expect("health request"),
                )
                .await
                .expect("health response");
            assert_eq!(response.status(), StatusCode::OK, "{uri}");
            let body = read_json(response).await;
            assert_eq!(body["code"], 0);
        }
    }
}

#[tokio::test]
async fn simple_router_serves_only_health_and_ready() {
    // 旧的一步提交接口 `/translate/bundle` 已经删掉：另一个端口上不再有它。
    let app = build_simple_app(test_state("health-simple-only"));
    for (method, uri) in [
        ("POST", "/api/v1/translate/bundle"),
        ("GET", "/api/v1/jobs"),
        ("POST", "/api/v1/uploads"),
    ] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(uri)
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("simple request"),
            )
            .await
            .expect("simple response");
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{method} {uri}");
    }
}

#[test]
fn readiness_requires_only_components_selected_by_config() {
    let state = test_state("readiness-config-boundary");
    let view = build_readiness_view(&build_health_route_deps(&state), jobsd_supervisor::JOBSD_STATUS_UNHEALTHY);
    assert_eq!(view.status, "ready");
    assert!(view.reasons.is_empty());
    // AI 服务 2026-11-03 删了：键留着，永远不需要
    assert!(!view.components.ai_service.required);
    assert_eq!(view.components.ai_service.status, "not_required");
    assert!(!view.components.jobsd.required);
    assert_eq!(view.components.jobsd.status, "not_required");

    let mut config = (*state.config).clone();
    config.jobs_service.mode = JobsRuntimeMode::Remote;
    config.jobs_service.supervise = true;
    let required_state = crate::AppState {
        config: std::sync::Arc::new(config),
        ..state
    };
    let view = build_readiness_view(&build_health_route_deps(&required_state), jobsd_supervisor::JOBSD_STATUS_UNHEALTHY);
    assert_eq!(view.status, "not_ready");
    assert!(!view.is_ready());
    assert_eq!(view.reasons, ["jobsd_not_healthy"]);
    assert!(!view.components.ai_service.required);
    assert!(view.components.jobsd.required);
    assert_eq!(view.components.jobsd.status, "unhealthy");

    let view = build_readiness_view(&build_health_route_deps(&required_state), jobsd_supervisor::JOBSD_STATUS_HEALTHY);
    assert_eq!(view.status, "ready");
    assert!(view.is_ready());
    assert!(view.reasons.is_empty());
}

#[tokio::test]
async fn not_ready_is_a_503_with_an_error_envelope_and_the_readiness_view() {
    let state = test_state("readiness-not-ready-envelope");
    let mut config = (*state.config).clone();
    config.jobs_service.mode = JobsRuntimeMode::Remote;
    config.jobs_service.supervise = true;
    let required_state = crate::AppState {
        config: std::sync::Arc::new(config),
        ..state
    };
    let view = build_readiness_view(&build_health_route_deps(&required_state), jobsd_supervisor::JOBSD_STATUS_STARTING);
    let response = crate::routes::health::readiness_response(view);
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    let body = read_json(response).await;
    // 以前 503 时信封是 `code: 0`、`message: "ok"`，只看信封的客户端会当成就绪。
    assert_eq!(body["code"], 50300);
    assert_eq!(body["message"], "not ready");
    assert_eq!(body["error"]["code"], "SERVICE_UNAVAILABLE");
    assert_eq!(body["error"]["http_status"], 503);
    assert_eq!(body["error"]["details"]["reasons"], serde_json::json!(["jobsd_not_healthy"]));
    // `data` 照旧是整份就绪视图（命令行 `retainpdf status` 读它）。
    assert_eq!(body["data"]["status"], "not_ready");
    assert_eq!(body["data"]["reasons"], body["error"]["details"]["reasons"]);
    assert_eq!(body["data"]["components"]["jobsd"]["status"], "starting");
    assert_eq!(body["data"]["components"]["ai_service"]["status"], "not_required");
}

#[tokio::test]
async fn health_reports_null_counts_when_the_jobs_table_cannot_be_read() {
    let state = test_state("health-null-counts");
    let app = build_app(state.clone());
    let fetch = || async {
        let response = app
            .clone()
            .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        read_json(response).await
    };
    let body = fetch().await;
    for key in [
        "status", "db", "queue_depth", "running_jobs", "provider_backends", "ai_service", "jobsd", "time",
    ] {
        assert!(body["data"].get(key).is_some(), "/health 少了 {key}: {body}");
    }
    assert_eq!(body["data"]["status"], "up");
    assert_eq!(body["data"]["queue_depth"], 0);
    assert_eq!(body["data"]["running_jobs"], 0);

    rusqlite::Connection::open(&state.config.jobs_db_path)
        .unwrap()
        .execute_batch("DROP TABLE jobs")
        .unwrap();
    let body = fetch().await;
    // 读不出来不是「空闲」：计数给 null。
    assert!(body["data"]["queue_depth"].is_null(), "{body}");
    assert!(body["data"]["running_jobs"].is_null(), "{body}");
}
