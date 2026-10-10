use std::sync::Arc;

use super::*;
use crate::config::DeploymentMode;

fn service(name: &str) -> AccountsService {
    let root = std::env::temp_dir().join(format!("retain-accounts-svc-{name}-{}", fastrand::u64(..)));
    std::fs::create_dir_all(&root).unwrap();
    let db = Arc::new(Db::new(root.join("jobs.db"), root));
    db.init().unwrap();
    AccountsService::new(
        db,
        AccountsConfig {
            mode: DeploymentMode::Multi,
            bootstrap_admin: Some(("root".into(), "correct horse".into())),
            ..AccountsConfig::default()
        },
    )
}

#[test]
fn passwords_hash_with_argon2id_and_verify() {
    let hash = hash_password("s3cret-pass").unwrap();
    assert!(hash.starts_with("$argon2id$"));
    assert!(verify_password("s3cret-pass", &hash));
    assert!(!verify_password("s3cret-pasS", &hash));
    assert!(!verify_password("anything", "not-a-hash"));
}

#[test]
fn initial_passwords_avoid_ambiguous_characters() {
    let password = generate_initial_password();
    assert_eq!(password.chars().count(), 14);
    assert!(!password.contains(['0', 'O', '1', 'l', 'I']));
    assert_ne!(password, generate_initial_password());
}

#[test]
fn usernames_follow_the_published_rule() {
    for ok in ["abc", "Alice.Smith", "a_b-c", &"x".repeat(32)] {
        assert!(validate_username(ok).is_ok(), "{ok}");
    }
    for bad in ["ab", "has space", "中文名", "a@b.com", "local", "service", &"x".repeat(33)] {
        assert!(validate_username(bad).is_err(), "{bad}");
    }
}

#[test]
fn bootstrap_creates_the_first_admin_only_once() {
    let accounts = service("bootstrap");
    assert_eq!(accounts.bootstrap_admin().unwrap().as_deref(), Some("root"));
    assert_eq!(accounts.bootstrap_admin().unwrap(), None);
    let outcome = accounts.login("ROOT", "correct horse").unwrap();
    assert_eq!(outcome.user.role, "admin");
    assert!(!outcome.user.must_change_password);
}

#[test]
fn login_locks_after_repeated_failures() {
    let accounts = service("lock");
    let (user, initial) = accounts.create_user("dora", "user").unwrap();
    assert!(user.must_change_password);
    for _ in 0..LOCK_AFTER_FAILURES {
        let error = accounts.login("dora", "wrong-password").err().unwrap();
        assert!(matches!(error, AppError::Account { code: "INVALID_CREDENTIALS", .. }));
    }
    // 锁定期间连正确密码也不行。
    let error = accounts.login("dora", &initial).err().unwrap();
    assert!(matches!(error, AppError::Account { code: "TOO_MANY_ATTEMPTS", .. }));
}

#[test]
fn last_admin_cannot_be_disabled_and_nobody_disables_themselves() {
    let accounts = service("last-admin");
    accounts.bootstrap_admin().unwrap();
    let admin = accounts.login("root", "correct horse").unwrap().user;
    let (other, _) = accounts.create_user("helper", "admin").unwrap();
    assert!(accounts.set_status(&admin.user_id, &admin.user_id, false).is_err());
    accounts.set_status(&admin.user_id, &other.user_id, false).unwrap();
    // 现在 root 是唯一可用的管理员；换 helper 的身份去停用它也不行（helper 已停用，这里只测规则）。
    assert!(accounts.set_status(&other.user_id, &admin.user_id, false).is_err());
}

#[test]
fn reset_password_kills_sessions_and_requires_a_change() {
    let accounts = service("reset");
    let (user, initial) = accounts.create_user("erin", "user").unwrap();
    let session = accounts.login("erin", &initial).unwrap();
    assert!(accounts.user_for_token(&session.token).unwrap().is_some());
    let fresh = accounts.reset_password(&user.user_id).unwrap();
    assert!(accounts.user_for_token(&session.token).unwrap().is_none());
    assert!(accounts.login("erin", &initial).is_err());
    let again = accounts.login("erin", &fresh).unwrap();
    assert!(again.user.must_change_password);
    let changed = accounts
        .change_password(&user.user_id, &fresh, "a-brand-new-one", Some(&again.token))
        .unwrap();
    assert!(!changed.must_change_password);
    assert!(accounts.user_for_token(&again.token).unwrap().is_some(), "当前设备保留");
}
