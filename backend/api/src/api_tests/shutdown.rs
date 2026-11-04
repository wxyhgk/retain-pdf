//! 停机：收到信号以后最多再等 `shutdown_grace_secs`，还没结束的连接（进度流、发了一半的上传）到点断开。

use std::time::{Duration, Instant};

use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

use crate::app::spawn_servers;
use crate::config::AppConfig;
use crate::test_support::config::TestDirs;

fn free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .expect("free port")
}

async fn connect_when_listening(port: u16) -> TcpStream {
    for _ in 0..200 {
        if let Ok(stream) = TcpStream::connect(("127.0.0.1", port)).await {
            return stream;
        }
        tokio::time::sleep(Duration::from_millis(25)).await;
    }
    panic!("server never started listening on {port}");
}

/// 一条一直不结束的连接：上传的请求头说有 1 MB，只发开头几个字节，处理函数就一直等请求体。
/// 以前优雅停机会陪它等到客户端自己断开（`docker stop` 等满 10 秒 SIGKILL）。
///
/// 反证方式：把 `serve_with_shutdown` 里 `drain_deadline` 那一支去掉，这个测试必须变红。
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn shutdown_stops_waiting_for_hung_connections_after_the_grace_period() {
    let dirs = TestDirs::create(&format!("rust-api-shutdown-drain-{}", fastrand::u64(..)));
    let port = free_port();
    let config = AppConfig {
        port,
        simple_port: free_port(),
        shutdown_grace_secs: 1,
        ..dirs.config()
    };
    let servers = spawn_servers(config);

    let mut hung = connect_when_listening(port).await;
    hung.write_all(
        format!(
            "POST /api/v1/uploads HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nX-API-Key: test-key\r\n\
             Content-Type: multipart/form-data; boundary=x\r\nContent-Length: 1048576\r\n\r\n--x\r\n"
        )
        .as_bytes(),
    )
    .await
    .expect("write partial request");
    // 让服务器把请求读进处理函数。
    tokio::time::sleep(Duration::from_millis(300)).await;

    let started = Instant::now();
    tokio::time::timeout(Duration::from_secs(5), servers.shutdown())
        .await
        .expect("停机必须在等满宽限期之后结束，而不是陪着挂住的连接一直等")
        .expect("servers stopped cleanly");
    assert!(started.elapsed() >= Duration::from_millis(900), "宽限期内应该先等着: {:?}", started.elapsed());
    // 那条连接本身由 axum 的连接任务持有，正式运行时停机返回后进程退出，它随之断开；
    // 这里测试运行时还活着，所以只看停机按时返回。
    drop(hung);
    let _ = std::fs::remove_dir_all(&dirs.root);
}

/// 退出时停 worker 之前重新拿运行时锁：锁在别人手里（新的运行时已经接手）时一个都不碰，锁空出来才终止。
#[cfg(any(target_os = "linux", target_os = "macos"))]
#[test]
fn stopping_workers_after_shutdown_leaves_them_alone_while_another_runtime_holds_the_lock() {
    use std::os::unix::process::CommandExt;

    use crate::models::domain::{CreateJobInput, JobSnapshot, JobStatusKind};

    let dirs = TestDirs::create(&format!("rust-api-shutdown-workers-{}", fastrand::u64(..)));
    let config = dirs.config();
    let db = crate::db::Db::new(config.jobs_db_path.clone(), config.data_root.clone());
    db.init().expect("init db");
    let mut worker = std::process::Command::new("sleep")
        .arg("60")
        .process_group(0)
        .spawn()
        .expect("spawn worker");
    let mut job = JobSnapshot::new("running".to_string(), CreateJobInput::default(), vec![]);
    job.status = JobStatusKind::Running;
    job.pid = Some(worker.id());
    db.save_job(&job).expect("save job");
    db.record_worker_identity("running", retainpdf_proc::process_identity(worker.id()).as_deref())
        .expect("record identity");

    let held = crate::job_runner::acquire_runtime_owner_lock(&config.jobs_db_path).expect("hold lock");
    crate::stop_owned_workers_after_shutdown(&config);
    std::thread::sleep(Duration::from_millis(200));
    assert!(worker.try_wait().expect("poll").is_none(), "锁在别人手里时不能碰它的 worker");

    drop(held);
    crate::stop_owned_workers_after_shutdown(&config);
    assert!(!worker.wait().expect("reap").success(), "锁空出来以后应该终止");
    assert_eq!(db.get_job("running").unwrap().status, JobStatusKind::Running, "库不改，留给下次启动");
    let _ = std::fs::remove_dir_all(&dirs.root);
}

/// 锁晚一点才空出来（别的线程正好 fork 子进程，子进程 exec 之前也拿着锁文件，锁跟着多留一会儿）：
/// 停机时重新拿锁要等一等，不能把自己的 worker 当成别人的、一个都不停（并发跑测试时偶发，2026-11-04）。
#[cfg(any(target_os = "linux", target_os = "macos"))]
#[test]
fn stopping_workers_after_shutdown_waits_briefly_for_a_lock_that_is_about_to_be_released() {
    use std::os::unix::process::CommandExt;

    use crate::models::domain::{CreateJobInput, JobSnapshot, JobStatusKind};

    let dirs = TestDirs::create(&format!("rust-api-shutdown-late-lock-{}", fastrand::u64(..)));
    let config = dirs.config();
    let db = crate::db::Db::new(config.jobs_db_path.clone(), config.data_root.clone());
    db.init().expect("init db");
    let mut worker = std::process::Command::new("sleep")
        .arg("60")
        .process_group(0)
        .spawn()
        .expect("spawn worker");
    let mut job = JobSnapshot::new("running".to_string(), CreateJobInput::default(), vec![]);
    job.status = JobStatusKind::Running;
    job.pid = Some(worker.id());
    db.save_job(&job).expect("save job");
    db.record_worker_identity("running", retainpdf_proc::process_identity(worker.id()).as_deref())
        .expect("record identity");

    let held = crate::job_runner::acquire_runtime_owner_lock(&config.jobs_db_path).expect("hold lock");
    let releaser = std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(300));
        drop(held);
    });
    crate::stop_owned_workers_after_shutdown(&config);
    releaser.join().expect("releaser");
    assert!(!worker.wait().expect("reap").success(), "锁晚 300 毫秒空出来也要终止自己的 worker");
    let _ = std::fs::remove_dir_all(&dirs.root);
}
