#!/usr/bin/env python3

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

try:
    import websocket
except ImportError as exc:
    raise SystemExit("python websocket-client is required for this smoke script") from exc


def parse_args():
    parser = argparse.ArgumentParser(description="Smoke test RetainPDF homepage actions in Chromium.")
    parser.add_argument("--url", default="http://127.0.0.1:40002/")
    parser.add_argument("--chromium", default="")
    parser.add_argument("--debug-port", type=int, default=9232)
    parser.add_argument("--wait-seconds", type=float, default=8)
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def chromium_binary(explicit):
    if explicit:
        return explicit
    for candidate in (
        "/snap/bin/chromium",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
    ):
        if shutil.which(candidate) or shutil.which(candidate.split("/")[-1]):
            return candidate
    raise SystemExit("Chromium/Chrome binary not found")


def wait_for_page(debug_port):
    endpoint = f"http://127.0.0.1:{debug_port}/json/list"
    for _ in range(80):
        try:
            with urllib.request.urlopen(endpoint, timeout=1) as response:
                targets = json.load(response)
            for target in targets:
                if target.get("type") == "page" and target.get("webSocketDebuggerUrl"):
                    return target
        except Exception:
            pass
        time.sleep(0.1)
    raise RuntimeError("Chromium DevTools page target unavailable")


def make_cdp(ws):
    counter = {"id": 0}
    events = []

    def send(method, params=None):
        counter["id"] += 1
        message_id = counter["id"]
        ws.send(json.dumps({"id": message_id, "method": method, "params": params or {}}))
        while True:
            message = json.loads(ws.recv())
            event_method = message.get("method")
            if event_method == "Runtime.exceptionThrown":
                details = message.get("params", {}).get("exceptionDetails", {})
                events.append([
                    "exception",
                    details.get("text"),
                    details.get("exception", {}).get("description"),
                ])
            elif event_method == "Runtime.consoleAPICalled":
                args = message.get("params", {}).get("args", [])
                events.append([
                    "console",
                    message.get("params", {}).get("type"),
                    " ".join(str(item.get("value") or item.get("description") or "") for item in args),
                ])
            if message.get("id") == message_id:
                return message

    return send, events


def evaluate(send, expression):
    result = send("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True,
    })
    return result.get("result", {}).get("result", {}).get("value") or {}


def run_actions(send):
    return evaluate(send, """
(() => {
  const click = (selector) => {
    const node = document.querySelector(selector);
    node?.click?.();
    return Boolean(node);
  };
  const firstCard = document.querySelector("recent-job-card, .recent-job-item");
  const firstJobId = firstCard?.jobId || firstCard?.dataset?.jobId || "";

  const addPdf = click("#library-add-pdf-btn");
  const workflowDialog = document.getElementById("translation-workflow-dialog");
  const workflowOpen = workflowDialog?.dataset?.open || "";

  const settings = click("#credentials-btn");
  const credentialsDialog = document.getElementById("browser-credentials-dialog");
  credentialsDialog?.close?.();

  const update = click("#app-update-btn");
  const updateDialog = document.getElementById("app-update-dialog");
  updateDialog?.close?.();

  const reader = firstCard?.querySelector?.(".recent-job-reader");
  reader?.click?.();

  firstCard?.dispatchEvent?.(new MouseEvent("click", { bubbles: true }));

  return {
    href: location.href,
    cardCount: document.querySelectorAll("recent-job-card, .recent-job-item").length,
    firstJobId,
    addPdf,
    workflowOpen,
    settings,
    credentialsExists: Boolean(credentialsDialog),
    update,
    updateExists: Boolean(updateDialog),
    readerExists: Boolean(reader),
    readerDialogExists: Boolean(document.getElementById("reader-dialog")),
    detailDialogExists: Boolean(document.getElementById("job-detail-modal") || document.getElementById("status-detail-dialog")),
  };
})()
""")


def assert_actions(report, events):
    errors = []
    if not report.get("addPdf") or report.get("workflowOpen") != "1":
        errors.append("add PDF button did not open workflow dialog")
    if not report.get("settings") or not report.get("credentialsExists"):
        errors.append("credentials/settings dialog is not reachable")
    if not report.get("update") or not report.get("updateExists"):
        errors.append("update dialog is not reachable")
    if not report.get("firstJobId") or int(report.get("cardCount") or 0) < 1:
        errors.append("no recent job card found")
    if not report.get("readerExists"):
        errors.append("first recent job card has no reader action")
    exceptions = [event for event in events if event and event[0] == "exception"]
    if exceptions:
        errors.append(f"runtime exceptions: {exceptions[:3]}")
    if errors:
        raise AssertionError("; ".join(errors))


def main():
    args = parse_args()
    binary = chromium_binary(args.chromium)
    profile = tempfile.mkdtemp(prefix="retainpdf-homepage-actions-")
    proc = subprocess.Popen([
        binary,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-extensions",
        f"--remote-debugging-port={args.debug_port}",
        "--remote-allow-origins=*",
        f"--user-data-dir={profile}",
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        target = wait_for_page(args.debug_port)
        ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=5)
        send, events = make_cdp(ws)
        send("Runtime.enable")
        send("Page.enable")
        send("Network.enable")
        send("Page.navigate", {"url": args.url})
        time.sleep(args.wait_seconds)
        report = run_actions(send)
        assert_actions(report, events)
        if args.json:
            print(json.dumps({"report": report, "events": events}, ensure_ascii=False, indent=2))
        else:
            print(f"homepage actions smoke ok: {report.get('cardCount')} cards, first={report.get('firstJobId')}")
        return 0
    except Exception as exc:
        if "report" in locals():
            print(json.dumps({"report": report, "events": events}, ensure_ascii=False, indent=2), file=sys.stderr)
        print(f"homepage actions smoke failed: {exc}", file=sys.stderr)
        return 1
    finally:
        try:
            proc.terminate()
        except Exception:
            pass
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
