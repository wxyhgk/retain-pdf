use std::cell::RefCell;
use std::rc::Rc;

use anyhow::Result;
use serde_json::{json, Value};

use super::{Server, Transport};

/// 记下发出去的请求，按地址回预先放好的答复。
#[derive(Default)]
struct Fake {
    calls: RefCell<Vec<(String, String, Option<Value>)>>,
    json_reply: RefCell<Option<(u16, Value)>>,
    bytes_reply: RefCell<Option<(u16, Vec<u8>)>>,
}

struct Handle(Rc<Fake>);

impl Transport for Handle {
    fn json(&self, method: &str, path: &str, body: Option<&Value>) -> Result<(u16, Value)> {
        self.0.calls.borrow_mut().push((method.into(), path.into(), body.cloned()));
        Ok(self.0.json_reply.borrow().clone().expect("json reply"))
    }

    fn bytes(&self, path: &str) -> Result<(u16, Vec<u8>)> {
        self.0.calls.borrow_mut().push(("GET".into(), path.into(), None));
        Ok(self.0.bytes_reply.borrow().clone().expect("bytes reply"))
    }
}

fn server(fake: &Rc<Fake>) -> Server<impl Fn() -> Result<Box<dyn Transport>, String>> {
    let fake = fake.clone();
    Server::new(move || Ok(Box::new(Handle(fake.clone())) as Box<dyn Transport>))
}

fn call(server: &Server<impl Fn() -> Result<Box<dyn Transport>, String>>, name: &str, arguments: Value) -> Value {
    let line = json!({"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": name, "arguments": arguments}});
    server.handle_line(&line.to_string()).expect("reply")["result"].clone()
}

fn text_of(result: &Value) -> String {
    result["content"].as_array().unwrap().iter().filter_map(|part| part["text"].as_str()).collect::<Vec<_>>().join("\n")
}

#[test]
fn handshake_lists_two_tools_and_ignores_notifications() {
    let fake = Rc::new(Fake::default());
    let server = server(&fake);

    let init = server
        .handle_line(r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}"#)
        .unwrap();
    assert_eq!(init["id"], 1);
    assert_eq!(init["result"]["protocolVersion"], "2025-03-26", "认识的旧版本照客户端的回");
    assert_eq!(init["result"]["capabilities"]["tools"]["listChanged"], false);
    assert_eq!(init["result"]["serverInfo"]["name"], "retainpdf");
    let unknown = server.handle_line(r#"{"jsonrpc":"2.0","id":2,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}"#).unwrap();
    assert_eq!(unknown["result"]["protocolVersion"], super::PROTOCOL_VERSION);

    assert!(server.handle_line(r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#).is_none());
    assert_eq!(server.handle_line(r#"{"jsonrpc":"2.0","id":3,"method":"ping"}"#).unwrap()["result"], json!({}));

    let tools = server.handle_line(r#"{"jsonrpc":"2.0","id":4,"method":"tools/list"}"#).unwrap();
    let names: Vec<_> = tools["result"]["tools"].as_array().unwrap().iter().map(|tool| tool["name"].as_str().unwrap()).collect();
    assert_eq!(names, ["revise_translation", "view_page"]);

    let missing = server.handle_line(r#"{"jsonrpc":"2.0","id":5,"method":"resources/list"}"#).unwrap();
    assert_eq!(missing["error"]["code"], -32601);
    let garbage = server.handle_line("{not json").unwrap();
    assert_eq!(garbage["error"]["code"], -32700);
    let unknown_tool = server
        .handle_line(r#"{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"delete_book","arguments":{}}}"#)
        .unwrap();
    assert_eq!(unknown_tool["error"]["code"], -32602);
    assert!(fake.calls.borrow().is_empty(), "握手、列工具不碰后端");
}

#[test]
fn revise_sends_an_agent_revision_with_the_old_text() {
    let fake = Rc::new(Fake::default());
    *fake.json_reply.borrow_mut() = Some((
        200,
        json!({"code": 0, "data": {"changed": true, "revision": {"revision_id": "rev-1"}, "validation": {"issues": [
            {"severity": "warning", "kind": "english_residue", "message": "还有英文"}
        ]}}}),
    ));
    let server = server(&fake);

    let result = call(&server, "revise_translation", json!({
        "job_id": "job-42", "item_id": "p012-b0003", "new_text": "新的译文。",
        "expected_old_text": "旧的译文。", "reason": "术语统一"
    }));
    assert_eq!(result["isError"], false, "{result}");
    let text = text_of(&result);
    assert!(text.contains("rev-1") && text.contains("english_residue"), "{text}");

    let calls = fake.calls.borrow();
    let (method, path, body) = &calls[0];
    assert_eq!((method.as_str(), path.as_str()), ("PATCH", "/api/v1/jobs/job-42/translations/p012-b0003"));
    assert_eq!(
        body.as_ref().unwrap(),
        &json!({"translated_text": "新的译文。", "source": "agent", "reason": "术语统一", "expected_translated_text": "旧的译文。"})
    );
}

#[test]
fn revise_explains_a_concurrent_edit_and_failed_checks() {
    let fake = Rc::new(Fake::default());
    let server = server(&fake);
    let args = json!({"job_id": "job-42", "item_id": "p012-b0003", "new_text": "新", "expected_old_text": "旧"});

    *fake.json_reply.borrow_mut() = Some((
        409,
        json!({"code": "TRANSLATION_REVISION_CONFLICT", "message": "changed", "error": {"details": {
            "reason": "text_mismatch", "current_translated_text": "别人刚改的译文。"
        }}}),
    ));
    let result = call(&server, "revise_translation", args.clone());
    assert_eq!(result["isError"], true);
    assert!(text_of(&result).contains("别人刚改的译文。"), "{result}");

    *fake.json_reply.borrow_mut() = Some((
        400,
        json!({"code": "TRANSLATION_REVISION_REJECTED", "message": "rejected", "error": {"details": {
            "reason": "validation_failed",
            "validation": {"issues": [{"severity": "error", "kind": "math_delimiter_unbalanced", "message": "$ 不配对"}]}
        }}}),
    ));
    let result = call(&server, "revise_translation", args);
    assert_eq!(result["isError"], true);
    assert!(text_of(&result).contains("math_delimiter_unbalanced"), "{result}");
}

#[test]
fn bad_arguments_never_reach_the_backend() {
    let fake = Rc::new(Fake::default());
    let server = server(&fake);
    for (name, arguments) in [
        ("revise_translation", json!({"job_id": "../admin", "item_id": "p1-b1", "new_text": "x", "expected_old_text": "y"})),
        ("revise_translation", json!({"job_id": "job", "item_id": "p1-b1", "new_text": "  ", "expected_old_text": "y"})),
        ("revise_translation", json!({"job_id": "job", "item_id": "p1-b1", "new_text": "x"})),
        ("view_page", json!({"side": "source", "page": 3})),
        ("view_page", json!({"side": "source", "document_id": "doc/../x", "page": 3})),
        ("view_page", json!({"side": "translated", "job_id": "job"})),
        ("view_page", json!({"side": "translated", "job_id": "job", "item_id": "b0003"})),
        ("view_page", json!({"side": "source", "document_id": "doc", "page": 0})),
        ("view_page", json!({"side": "source", "document_id": "doc", "page": 1, "width": 5000})),
        ("view_page", json!({"side": "both", "document_id": "doc", "page": 1})),
    ] {
        let result = call(&server, name, arguments.clone());
        assert_eq!(result["isError"], true, "{name} {arguments}: {result}");
    }
    assert!(fake.calls.borrow().is_empty(), "参数不对就不发请求: {:?}", fake.calls.borrow());
}

#[test]
fn view_page_returns_a_jpeg_for_either_side() {
    let fake = Rc::new(Fake::default());
    *fake.bytes_reply.borrow_mut() = Some((200, vec![0xFF, 0xD8, 0xFF, 0xD9]));
    let server = server(&fake);

    let result = call(&server, "view_page", json!({"side": "source", "document_id": "doc-1", "page": 12}));
    assert_eq!(result["isError"], false, "{result}");
    assert_eq!(result["content"][0]["type"], "image");
    assert_eq!(result["content"][0]["mimeType"], "image/jpeg");
    assert_eq!(result["content"][0]["data"], "/9j/2Q==");

    // 译文页按块编号前面的页号取。
    call(&server, "view_page", json!({"side": "translated", "job_id": "job-42", "item_id": "p012-b0003", "width": 800}));
    let paths: Vec<String> = fake.calls.borrow().iter().map(|(_, path, _)| path.clone()).collect();
    assert_eq!(
        paths,
        [
            "/api/v1/documents/doc-1/files/pages/12.jpg?width=1000",
            "/api/v1/jobs/job-42/files/pages/12.jpg?width=800",
        ]
    );

    *fake.bytes_reply.borrow_mut() = Some((404, br#"{"message":"page not ready","error":{"details":{"reason":"not_ready"}}}"#.to_vec()));
    let result = call(&server, "view_page", json!({"side": "translated", "job_id": "job-42", "page": 3}));
    assert_eq!(result["isError"], true);
    assert!(text_of(&result).contains("还没排好"), "{result}");
}

#[test]
fn tools_report_a_stopped_backend_instead_of_failing_the_session() {
    let server = Server::new(|| Err("RetainPDF 没开".to_string()));
    let result = call(&server, "view_page", json!({"side": "source", "document_id": "doc-1", "page": 1}));
    assert_eq!(result["isError"], true);
    assert!(text_of(&result).contains("RetainPDF 没开"));
}

// ---------- 互动块（OpenUI，2026-11-26） ----------

mod openui {
    use std::path::{Path, PathBuf};
    use std::rc::Rc;
    use std::time::Duration;

    use serde_json::{json, Value};

    use super::super::openui::{check_result, checker_command, run_checker, CheckOutcome, Checker, OpenUi, MAX_CHECK_OUTPUT_BYTES};
    use super::{call, server, text_of, Fake};

    fn repo() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).ancestors().nth(2).unwrap().to_path_buf()
    }

    fn prompt() -> PathBuf {
        repo().join("contracts/openui/ask-openui-prompt.v1.json")
    }

    fn library() -> PathBuf {
        repo().join("contracts/openui/ask-openui-library.v1.json")
    }

    fn script() -> PathBuf {
        repo().join("backend/openui-check/bin/openui-check.mjs")
    }

    /// 前端演示模式的那段程序（MOCK_OPENUI_BLOCK），解析器挑不出错。
    fn good_program() -> String {
        std::fs::read_to_string(repo().join("backend/openui-check/tests/fixtures/good-program.txt")).unwrap()
    }

    fn node() -> Option<PathBuf> {
        let name = if cfg!(windows) { "node.exe" } else { "node" };
        std::env::split_paths(&std::env::var_os("PATH")?).map(|dir| dir.join(name)).find(|path| path.is_file())
    }

    /// 真起检查器要 node 和 backend/openui-check 的依赖；没有就跳过（CI 的 Tests 装了）。
    fn real_checker_ready() -> bool {
        node().is_some() && repo().join("backend/openui-check/node_modules/@openuidev/lang-core").is_dir()
    }

    fn openui() -> OpenUi {
        OpenUi::load(&prompt(), Some(library()), Some(script()), node()).expect("contract file loads")
    }

    fn intro() -> String {
        let payload: Value = serde_json::from_slice(&std::fs::read(prompt()).unwrap()).unwrap();
        payload["intro"].as_str().unwrap().trim().to_string()
    }

    fn section(id: &str) -> String {
        let payload: Value = serde_json::from_slice(&std::fs::read(prompt()).unwrap()).unwrap();
        payload["sections"].as_array().unwrap().iter().find(|item| item["id"] == id).unwrap()["text"].as_str().unwrap().trim().to_string()
    }

    #[test]
    fn with_openui_the_instructions_carry_l0_and_two_more_tools_are_listed() {
        let fake = Rc::new(Fake::default());
        let server = server(&fake).with_openui(Some(openui()));
        let init = server.handle_line(r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#).unwrap();
        let instructions = init["result"]["instructions"].as_str().unwrap();
        assert!(instructions.starts_with("RetainPDF 书库。"));
        assert!(instructions.ends_with(&format!("\n\n{}", intro())));
        let tools = server.handle_line(r#"{"jsonrpc":"2.0","id":2,"method":"tools/list"}"#).unwrap();
        let names: Vec<_> = tools["result"]["tools"].as_array().unwrap().iter().map(|tool| tool["name"].as_str().unwrap()).collect();
        assert_eq!(names, ["revise_translation", "view_page", "openui_spec", "openui_check"]);

        // 取说明：认识的、多段（按给的顺序、去重）、不认识的
        let one = call(&server, "openui_spec", json!({"sections": ["core"]}));
        assert_eq!((text_of(&one), one["isError"].clone()), (section("core"), json!(false)));
        let many = call(&server, "openui_spec", json!({"sections": ["components:inputs", "core", "components:inputs"]}));
        assert_eq!(text_of(&many), format!("{}\n\n{}", section("components:inputs"), section("core")));
        let unknown = call(&server, "openui_spec", json!({"sections": ["components:image"]}));
        assert_eq!(unknown["isError"], true);
        assert!(text_of(&unknown).starts_with("不认识的段：`components:image`。可取的段：\n- `core`："));
        let mixed = call(&server, "openui_spec", json!({"sections": ["core", "nope"]}));
        assert!(text_of(&mixed).contains("（不认识的段：`nope`，没有取。可取的段：`core`、"));
        assert_eq!(call(&server, "openui_spec", json!({"sections": []}))["isError"], true);
        assert!(fake.calls.borrow().is_empty(), "互动块的工具不碰后端");
    }

    #[test]
    fn without_openui_nothing_changes() {
        let fake = Rc::new(Fake::default());
        let server = server(&fake);
        let init = server.handle_line(r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#).unwrap();
        assert!(!init["result"]["instructions"].as_str().unwrap().contains("openui"));
        let reply = server.handle_line(r#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"openui_spec","arguments":{}}}"#).unwrap();
        assert_eq!(reply["error"]["code"], -32602);
        assert!(OpenUi::load(Path::new("/nonexistent.json"), None, None, None).is_none());
    }

    #[test]
    fn the_real_checker_passes_the_demo_block_and_names_unknown_components() {
        if !real_checker_ready() {
            eprintln!("skip: needs node and backend/openui-check/node_modules");
            return;
        }
        let fake = Rc::new(Fake::default());
        let server = server(&fake).with_openui(Some(openui()));
        let good = call(&server, "openui_check", json!({"program": good_program()}));
        assert_eq!((text_of(&good), good["isError"].clone()), ("没问题。".to_string(), json!(false)));
        for (program, name, statement) in [("root = Col([t])\nt = Titel(\"x\")", "Titel", "t"), ("root = Col([i])\ni = Image(\"https://example.com/a.png\")", "Image", "i")] {
            let result = call(&server, "openui_check", json!({"program": program}));
            let text = text_of(&result);
            assert_eq!(result["isError"], false, "检查出问题不算工具出错");
            assert!(text.contains(&format!("1. [unknown-component] {statement}：Unknown component \"{name}\"")), "{text}");
            assert!(text.contains("Available components: Col, Row"), "{text}");
        }
    }

    #[test]
    fn check_when_node_is_missing_or_not_configured() {
        let missing = Checker { node: "/nonexistent/node".into(), script: script(), library: library(), timeout: Duration::from_secs(5) };
        let result = check_result(Some(|program: &str| run_checker(&missing, program)), Some(&json!(good_program())), Duration::from_secs(5), "");
        assert!(text_of(&result).starts_with("检查器起不来（Node.js："), "{result}");
        assert_eq!(result["isError"], true);
        let no_node = OpenUi::load(&prompt(), Some(library()), Some(script()), Some("/nonexistent/node".into())).unwrap();
        let result = no_node.call("openui_check", &json!({"program": good_program()}));
        assert!(text_of(&result).starts_with("检查器用不了（没找到 Node.js）"), "{result}");
        assert_eq!(no_node.call("openui_spec", &json!({"sections": ["core"]}))["isError"], false);
        let never = Some(|_: &str| -> CheckOutcome { panic!("should not start") });
        assert!(text_of(&check_result(never, Some(&json!("x".repeat(40_001))), Duration::from_secs(1), "")).starts_with("程序太长"));
        let never = Some(|_: &str| -> CheckOutcome { panic!("should not start") });
        assert_eq!(check_result(never, Some(&json!("  ")), Duration::from_secs(1), "")["isError"], true);
    }

    #[test]
    fn check_reports_timeouts_oversized_output_and_garbage() {
        let timeout = check_result(Some(|_: &str| CheckOutcome::Timeout), Some(&json!("x")), Duration::from_millis(500), "");
        assert!(text_of(&timeout).starts_with("检查超时（0.5 秒）"));
        let big = check_result(Some(|_: &str| CheckOutcome::Done(Some(0), vec![b'x'; MAX_CHECK_OUTPUT_BYTES + 1])), Some(&json!("x")), Duration::from_secs(1), "");
        assert!(text_of(&big).contains("输出太大"));
        let garbage = check_result(Some(|_: &str| CheckOutcome::Done(Some(0), b"hello\n".to_vec())), Some(&json!("x")), Duration::from_secs(1), "");
        assert!(text_of(&garbage).starts_with("检查器没有回结果（退出码 0）"));
        let fatal = check_result(
            Some(|_: &str| CheckOutcome::Done(Some(2), r#"{"ok":false,"fatal":"读不了组件库 x"}"#.as_bytes().to_vec())),
            Some(&json!("x")),
            Duration::from_secs(1),
            "",
        );
        assert!(text_of(&fatal).starts_with("检查器用不了：读不了组件库 x"));
    }

    #[cfg(unix)]
    #[test]
    fn a_real_timeout_kills_the_checker() {
        let dir = std::env::temp_dir().join(format!("retainpdf-openui-{}-{}", std::process::id(), line!()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("slow.sh"), "sleep 30\n").unwrap();
        let slow = Checker { node: "/bin/sh".into(), script: dir.join("slow.sh"), library: library(), timeout: Duration::from_millis(300) };
        let started = std::time::Instant::now();
        assert!(matches!(run_checker(&slow, "x"), CheckOutcome::Timeout));
        assert!(started.elapsed() < Duration::from_secs(10));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[test]
    fn the_checker_runs_with_telemetry_off() {
        let checker = Checker { node: "/bin/sh".into(), script: "/s".into(), library: library(), timeout: Duration::from_secs(5) };
        let command = checker_command(&checker);
        let envs: Vec<(String, Option<String>)> = command
            .get_envs()
            .map(|(name, value)| (name.to_string_lossy().into_owned(), value.map(|value| value.to_string_lossy().into_owned())))
            .collect();
        assert!(envs.contains(&("OPENUI_TELEMETRY_DISABLED".into(), Some("1".into()))));
        assert!(envs.contains(&("DO_NOT_TRACK".into(), Some("1".into()))));
        assert!(envs.contains(&("OPENUI_RUNTIME_TELEMETRY_ENABLED".into(), None)), "removed even when the parent has it");

        // 子进程里真看到的：假检查器（sh 脚本）把它们写进 text
        let dir = std::env::temp_dir().join(format!("retainpdf-openui-{}-{}", std::process::id(), line!()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("env.sh"),
            "cat >/dev/null\nprintf '{\"ok\":true,\"errors\":[],\"text\":\"%s|%s|%s\"}\\n' \"$OPENUI_TELEMETRY_DISABLED\" \"$DO_NOT_TRACK\" \"${OPENUI_RUNTIME_TELEMETRY_ENABLED-unset}\"\n",
        )
        .unwrap();
        let checker = Checker { node: "/bin/sh".into(), script: dir.join("env.sh"), library: library(), timeout: Duration::from_secs(5) };
        let result = check_result(Some(|program: &str| run_checker(&checker, program)), Some(&json!("x")), Duration::from_secs(5), "");
        assert_eq!(text_of(&result), "1|1|unset");
        let _ = std::fs::remove_dir_all(dir);
    }
}
