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
