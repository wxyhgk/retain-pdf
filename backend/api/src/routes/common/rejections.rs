use crate::error::AppError;

pub async fn unknown_route() -> AppError {
    AppError::not_found("route not found")
}

pub async fn method_not_allowed() -> AppError {
    AppError::method_not_allowed("method not allowed")
}

#[cfg(test)]
mod tests {
    use axum::body::Body;
    use axum::http::{header, Method, Request, StatusCode};
    use axum::routing::get;
    use axum::Router;
    use tower::ServiceExt;

    use super::*;

    #[tokio::test]
    async fn custom_method_fallback_preserves_allow_header() {
        let response = Router::new()
            .route("/resource", get(|| async {}))
            .method_not_allowed_fallback(method_not_allowed)
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/resource")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
        let allow = response
            .headers()
            .get(header::ALLOW)
            .expect("method fallback must retain Allow")
            .to_str()
            .unwrap();
        assert!(allow.split(',').any(|method| method == "GET"));
        assert!(allow.split(',').any(|method| method == "HEAD"));
    }
}
