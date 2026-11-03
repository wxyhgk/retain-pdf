//! 子服务健康探测用的 HTTP 客户端（jobsd 监督器用）。

use std::time::Duration;

/// 构造健康探测客户端：**不保留空闲连接**。
///
/// 探测循环每 `health_interval`（默认 5 秒）打一次健康接口。客户端把连接留在池里复用，就可能撞上
/// 服务端的 keep-alive 空闲回收：到点关连接、客户端正好复用那一条，请求在途中被 RST，日志上就是
/// "health probe failed → health recovered" 反复横跳（以前监督 Python AI 服务时撞过：uvicorn 默认
/// keep-alive 正好也是 5 秒；AI 服务 2026-11-03 删了）。jobsd 是 axum/hyper，默认不主动回收空闲连接，
/// 眼下没有这个竞态，照旧每次新建连接，免得将来给 jobsd 加上空闲超时时再踩一遍。
///
/// 代价是每次探测都要对 localhost 做一次 TCP 握手，每 5 秒一次，可忽略。
pub(crate) fn build_probe_client(
    connect_timeout: Duration,
    request_timeout: Duration,
    label: &str,
) -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(connect_timeout)
        .timeout(request_timeout)
        .pool_max_idle_per_host(0)
        .build()
        .unwrap_or_else(|error| panic!("build {label} probe client: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    /// 探测客户端每次探测都必须新开连接。
    ///
    /// 直接断言"不复用"这个可观测行为,而不是去复现那个竞态本身——竞态要靠
    /// 服务端在客户端下一次请求即将发出的那一刻恰好关闭连接,时序上没法在
    /// 单元测试里稳定地摆出来,写出来只会是个偶发红的用例。
    ///
    /// 这里的服务器是裸 TCP:每 accept 一条连接就计数,并在那条连接上循环
    /// 应答任意多个请求(标准 HTTP/1.1 keep-alive 行为,不发 `Connection:
    /// close`)。于是连接数就精确等于"客户端开了几条连接":复用则 accept 一次,
    /// 不复用则三次。
    #[tokio::test]
    async fn probe_client_opens_a_fresh_connection_for_every_probe() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind probe stub");
        let addr = listener.local_addr().expect("stub addr");
        let accepted = Arc::new(AtomicUsize::new(0));

        let server_accepted = accepted.clone();
        let server = tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else {
                    break;
                };
                server_accepted.fetch_add(1, Ordering::SeqCst);
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    // keep-alive:同一条连接上服务到客户端主动断开为止。
                    while let Ok(read) = socket.read(&mut buf).await {
                        if read == 0 {
                            break;
                        }
                        if socket
                            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok")
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                });
            }
        });

        let client = build_probe_client(
            Duration::from_secs(1),
            Duration::from_secs(2),
            "probe client test",
        );
        let url = format!("http://{addr}/readyz");
        const PROBES: usize = 3;
        for round in 1..=PROBES {
            let response = client
                .get(&url)
                .send()
                .await
                .unwrap_or_else(|error| panic!("第 {round} 次探测失败: {error}"));
            assert!(response.status().is_success());
            // 读完 body,让连接走完一个完整的请求周期——否则"有没有被放回池"
            // 这件事根本没发生,用例就测不到东西了。
            response.text().await.expect("read body");
        }

        assert_eq!(
            accepted.load(Ordering::SeqCst),
            PROBES,
            "探测客户端复用了空闲连接：那正是与 uvicorn 5 秒 keep-alive 撞车、\
             让 health probe 反复 failed/recovered 的原因"
        );
        server.abort();
    }
}
