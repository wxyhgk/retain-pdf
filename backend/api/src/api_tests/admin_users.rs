//! 管理后台：账号列表的搜索筛选排序、详情与统计、某个账号的任务、改身份、软删除与恢复。

use axum::http::{Method, StatusCode};
use serde_json::{json, Value};

use super::accounts::{create_and_login, login, multi_state, send, ADMIN_PASSWORD};
use crate::api_tests::jobs_common::read_json;
use crate::models::domain::{JobSnapshot, JobStatusKind, UploadRecord};
use crate::models::{now_iso, CreateJobInput};

fn usernames(body: &Value) -> Vec<String> {
    body["data"]["users"]
        .as_array()
        .unwrap()
        .iter()
        .map(|user| user["username"].as_str().unwrap().to_string())
        .collect()
}

async fn get(state: &crate::AppState, cookie: &str, uri: &str) -> Value {
    read_json(send(state, Method::GET, uri, Some(cookie), None).await).await
}

async fn grant(state: &crate::AppState, admin: &str, user_id: &str, delta: i64) {
    let response = send(
        state,
        Method::POST,
        &format!("/api/v1/admin/users/{user_id}/pages"),
        Some(admin),
        Some(json!({ "delta": delta })),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
}

/// 在库里放一个属于 `owner` 的排队中任务，并按页预扣（不真的跑）。
fn queued_job(state: &crate::AppState, owner: &str, job_id: &str, pages: i64) {
    let upload_id = format!("up-{job_id}");
    let path = state.config.uploads_dir.join(format!("{upload_id}.pdf"));
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(&path, b"%PDF").unwrap();
    let upload = UploadRecord {
        upload_id: upload_id.clone(),
        filename: format!("{job_id}.pdf"),
        stored_path: path.to_string_lossy().into_owned(),
        bytes: 4,
        page_count: pages as u32,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: format!("hash-{job_id}"),
    };
    state
        .db
        .save_upload_with_document_for(&upload, owner)
        .unwrap();
    let mut input = CreateJobInput::default();
    input.source.upload_id = upload_id.clone();
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()]);
    job.upload_id = Some(upload_id);
    job.status = JobStatusKind::Queued;
    state.db.save_job(&job).unwrap();
    state
        .db
        .reserve_job_pages(job_id, owner, pages, &now_iso())
        .unwrap();
}

#[tokio::test]
async fn list_searches_filters_sorts_and_pages_without_breaking_the_old_call() {
    let state = multi_state("admin-list");
    let admin = login(&state, "root", ADMIN_PASSWORD).await;
    let mut ids = Vec::new();
    for name in ["alice", "albert", "bob"] {
        ids.push(create_and_login(&state, &admin, name).await.0);
    }
    grant(&state, &admin, &ids[0], 10).await;
    grant(&state, &admin, &ids[1], 50).await;

    // 不带参数：和以前的列表一模一样（没删的全部账号、同样的顺序），只多了 total。
    let all = get(&state, &admin, "/api/v1/admin/users").await;
    let old_order: Vec<String> = state
        .db
        .list_users()
        .unwrap()
        .into_iter()
        .map(|user| user.username)
        .collect();
    assert_eq!(usernames(&all), old_order);
    assert_eq!(all["data"]["total"], 4);

    let search = get(&state, &admin, "/api/v1/admin/users?q=AL").await;
    assert_eq!(
        usernames(&search),
        vec!["albert", "alice"],
        "同一秒建的按用户名排"
    );
    let admins = get(&state, &admin, "/api/v1/admin/users?role=admin").await;
    assert_eq!(usernames(&admins), vec!["root"]);
    let by_balance = get(
        &state,
        &admin,
        "/api/v1/admin/users?sort=page_balance&order=desc",
    )
    .await;
    assert_eq!(
        usernames(&by_balance),
        vec!["albert", "alice", "bob", "root"],
        "管理员不限额排最后"
    );
    let page = get(
        &state,
        &admin,
        "/api/v1/admin/users?sort=username&limit=2&offset=1",
    )
    .await;
    assert_eq!(
        (usernames(&page), page["data"]["total"].clone()),
        (vec!["alice".to_string(), "bob".to_string()], json!(4))
    );

    let bad = send(
        &state,
        Method::GET,
        "/api/v1/admin/users?sort=password",
        Some(&admin),
        None,
    )
    .await;
    assert_eq!(bad.status(), StatusCode::BAD_REQUEST);
    assert_eq!(read_json(bad).await["error"]["code"], "INVALID_QUERY");
}

#[tokio::test]
async fn detail_and_jobs_show_balance_stats_and_charges() {
    let state = multi_state("admin-detail");
    let admin = login(&state, "root", ADMIN_PASSWORD).await;
    let (alice_id, _alice) = create_and_login(&state, &admin, "alice").await;
    grant(&state, &admin, &alice_id, 30).await;
    queued_job(&state, &alice_id, "job-a", 12);

    let detail = get(&state, &admin, &format!("/api/v1/admin/users/{alice_id}")).await;
    assert_eq!(detail["data"]["user"]["username"], "alice");
    assert_eq!(detail["data"]["page_balance"], 18);
    let stats = &detail["data"]["stats"];
    assert_eq!(
        (
            stats["jobs_total"].as_i64(),
            stats["jobs_by_status"]["queued"].as_i64()
        ),
        (Some(1), Some(1))
    );
    assert_eq!(
        (stats["uploads"].as_i64(), stats["documents"].as_i64()),
        (Some(1), Some(1))
    );
    assert_eq!(
        (
            stats["pages_charged"].as_i64(),
            stats["pages_reserved"].as_i64()
        ),
        (Some(12), Some(12))
    );

    let jobs = get(
        &state,
        &admin,
        &format!("/api/v1/admin/users/{alice_id}/jobs"),
    )
    .await;
    assert_eq!(jobs["data"]["total"], 1);
    let job = &jobs["data"]["jobs"][0];
    assert_eq!(
        (
            job["job_id"].as_str(),
            job["status"].as_str(),
            job["title"].as_str()
        ),
        (Some("job-a"), Some("queued"), Some("job-a.pdf"))
    );
    assert_eq!(
        (job["charged_pages"].as_i64(), job["charge_status"].as_str()),
        (Some(12), Some("reserved"))
    );

    // 管理员打不开别人的任务详情：数据归属照旧。
    let other = send(
        &state,
        Method::GET,
        "/api/v1/jobs/job-a",
        Some(&admin),
        None,
    )
    .await;
    assert_eq!(other.status(), StatusCode::NOT_FOUND);
    assert_eq!(
        send(
            &state,
            Method::GET,
            "/api/v1/admin/users/u_nobody",
            Some(&admin),
            None
        )
        .await
        .status(),
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn role_changes_toggle_unlimited_and_keep_the_ledger() {
    let state = multi_state("admin-role");
    let admin = login(&state, "root", ADMIN_PASSWORD).await;
    let (alice_id, alice) = create_and_login(&state, &admin, "alice").await;
    grant(&state, &admin, &alice_id, 40).await;
    let role_uri = format!("/api/v1/admin/users/{alice_id}/role");

    let promoted = read_json(
        send(
            &state,
            Method::POST,
            &role_uri,
            Some(&admin),
            Some(json!({ "role": "admin" })),
        )
        .await,
    )
    .await;
    assert_eq!(promoted["data"]["user"]["role"], "admin");
    let mine = get(&state, &alice, "/api/v1/account/pages").await;
    assert_eq!(
        mine["data"]["unlimited"], true,
        "身份立即生效，不用重新登录"
    );

    let demoted = send(
        &state,
        Method::POST,
        &role_uri,
        Some(&admin),
        Some(json!({ "role": "user" })),
    )
    .await;
    assert_eq!(demoted.status(), StatusCode::OK);
    let mine = get(&state, &alice, "/api/v1/account/pages").await;
    assert_eq!(
        (
            mine["data"]["unlimited"].as_bool(),
            mine["data"]["balance"].as_i64()
        ),
        (Some(false), Some(40)),
        "降回来余额还是原来的"
    );

    let session = get(&state, &admin, "/api/v1/auth/session").await;
    let root_id = session["data"]["user"]["user_id"]
        .as_str()
        .unwrap()
        .to_string();
    let own = send(
        &state,
        Method::POST,
        &format!("/api/v1/admin/users/{root_id}/role"),
        Some(&admin),
        Some(json!({ "role": "user" })),
    )
    .await;
    assert_eq!(
        read_json(own).await["error"]["code"],
        "CANNOT_CHANGE_OWN_ROLE"
    );
    let bad = send(
        &state,
        Method::POST,
        &role_uri,
        Some(&admin),
        Some(json!({ "role": "owner" })),
    )
    .await;
    assert_eq!(read_json(bad).await["error"]["code"], "INVALID_ROLE");
    let by_user = send(
        &state,
        Method::POST,
        &role_uri,
        Some(&alice),
        Some(json!({ "role": "admin" })),
    )
    .await;
    assert_eq!(by_user.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn soft_delete_locks_the_account_cancels_its_jobs_and_restore_undoes_it() {
    let state = multi_state("admin-delete");
    let admin = login(&state, "root", ADMIN_PASSWORD).await;
    let created = read_json(
        send(
            &state,
            Method::POST,
            "/api/v1/admin/users",
            Some(&admin),
            Some(json!({ "username": "bob" })),
        )
        .await,
    )
    .await;
    let bob_id = created["data"]["user"]["user_id"]
        .as_str()
        .unwrap()
        .to_string();
    let bob_password = created["data"]["initial_password"]
        .as_str()
        .unwrap()
        .to_string();
    let bob = login(&state, "bob", &bob_password).await;
    grant(&state, &admin, &bob_id, 20).await;
    queued_job(&state, &bob_id, "job-b", 8);
    let user_uri = format!("/api/v1/admin/users/{bob_id}");

    let deleted =
        read_json(send(&state, Method::DELETE, &user_uri, Some(&admin), None).await).await;
    assert_eq!(deleted["data"]["user"]["status"], "deleted", "{deleted}");
    assert_eq!(deleted["data"]["canceled_jobs"], json!(["job-b"]));
    assert_eq!(
        state.db.get_job("job-b").unwrap().status,
        JobStatusKind::Canceled
    );
    assert_eq!(
        state.db.page_balance(&bob_id).unwrap(),
        20,
        "取消的任务退回页数"
    );

    assert_eq!(
        send(
            &state,
            Method::GET,
            "/api/v1/account/pages",
            Some(&bob),
            None
        )
        .await
        .status(),
        StatusCode::UNAUTHORIZED,
        "会话作废"
    );
    let relogin = send(
        &state,
        Method::POST,
        "/api/v1/auth/login",
        None,
        Some(json!({ "username": "bob", "password": bob_password })),
    )
    .await;
    assert_eq!(read_json(relogin).await["error"]["code"], "ACCOUNT_DELETED");
    assert!(
        !usernames(&get(&state, &admin, "/api/v1/admin/users").await).contains(&"bob".to_string())
    );
    assert_eq!(
        usernames(&get(&state, &admin, "/api/v1/admin/users?status=deleted").await),
        vec!["bob"]
    );
    for (method, uri, body) in [
        (
            Method::POST,
            format!("{user_uri}/pages"),
            Some(json!({ "delta": 5 })),
        ),
        (Method::POST, format!("{user_uri}/reset-password"), None),
        (Method::POST, format!("{user_uri}/disable"), None),
        (
            Method::POST,
            format!("{user_uri}/role"),
            Some(json!({ "role": "admin" })),
        ),
    ] {
        let response = send(&state, method, &uri, Some(&admin), body).await;
        assert_eq!(response.status(), StatusCode::CONFLICT, "{uri}");
        assert_eq!(
            read_json(response).await["error"]["code"],
            "ACCOUNT_DELETED",
            "{uri}"
        );
    }
    let taken = send(
        &state,
        Method::POST,
        "/api/v1/admin/users",
        Some(&admin),
        Some(json!({ "username": "bob" })),
    )
    .await;
    assert_eq!(taken.status(), StatusCode::CONFLICT, "用户名继续占用");

    let restored = read_json(
        send(
            &state,
            Method::POST,
            &format!("{user_uri}/restore"),
            Some(&admin),
            None,
        )
        .await,
    )
    .await;
    assert_eq!(restored["data"]["user"]["status"], "active");
    login(&state, "bob", &bob_password).await;

    let session = get(&state, &admin, "/api/v1/auth/session").await;
    let root_id = session["data"]["user"]["user_id"]
        .as_str()
        .unwrap()
        .to_string();
    let own = send(
        &state,
        Method::DELETE,
        &format!("/api/v1/admin/users/{root_id}"),
        Some(&admin),
        None,
    )
    .await;
    assert_eq!(read_json(own).await["error"]["code"], "CANNOT_DELETE_SELF");
}
