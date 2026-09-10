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


DEFAULT_URL = "http://127.0.0.1:40001/?v=homepage-smoke"


def parse_args():
    parser = argparse.ArgumentParser(description="Smoke test the RetainPDF homepage in Chromium.")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--chromium", default="")
    parser.add_argument("--debug-port", type=int, default=9231)
    parser.add_argument("--wait-seconds", type=float, default=8)
    parser.add_argument("--min-books", type=int, default=1)
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def chromium_binary(explicit):
    if explicit:
        return explicit
    for candidate in (
        "/snap/bin/chromium",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ):
        if shutil.which(candidate) or shutil.which(candidate.split("/")[-1]) or candidate.startswith("/Applications/"):
            return candidate
    found = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    if found:
        return found
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
    responses = []

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
            elif event_method == "Network.responseReceived":
                response = message.get("params", {}).get("response", {})
                url = response.get("url", "")
                if "/api/v1/jobs" in url or "app.bundle" in url or "runtime-config" in url:
                    responses.append([response.get("status"), url])
            if message.get("id") == message_id:
                return message

    return send, events, responses


def evaluate_homepage(send):
    expression = """
(() => ({
  href: location.href,
  bodyText: document.body.innerText.slice(0, 1200),
  runtimeConfig: window.__FRONT_RUNTIME_CONFIG__ || {},
  appShell: !!document.getElementById('app-shell'),
  addPdf: !!document.getElementById('library-add-pdf-btn'),
  listChildren: document.getElementById('recent-jobs-list')?.children.length ?? -1,
  emptyClass: document.getElementById('recent-jobs-empty')?.className || '',
  inlineErrorText: document.getElementById('error-box-inline')?.textContent || '',
  inlineErrorClass: document.getElementById('error-box-inline')?.className || '',
}))()
"""
    result = send("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True,
    })
    return result.get("result", {}).get("result", {}).get("value") or {}


def click_add_pdf(send):
    expression = """
(() => {
  document.getElementById('library-add-pdf-btn')?.click();
  const dialog = document.getElementById('translation-workflow-dialog');
  return {
    className: dialog?.className || '',
    open: dialog?.dataset?.open || '',
  };
})()
"""
    result = send("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True,
    })
    return result.get("result", {}).get("result", {}).get("value") or {}


def assert_homepage(summary, click, events, responses, min_books):
    errors = []
    runtime = summary.get("runtimeConfig") or {}
    if not summary.get("appShell"):
        errors.append("app shell is missing")
    if not summary.get("addPdf"):
        errors.append("add PDF button is missing")
    if not runtime.get("apiBase"):
        errors.append("runtimeConfig.apiBase is empty")
    if not runtime.get("xApiKey"):
        errors.append("runtimeConfig.xApiKey is empty")
    if int(summary.get("listChildren") or 0) < min_books:
        errors.append(f"recent jobs list has fewer than {min_books} item(s)")
    inline_error = str(summary.get("inlineErrorText") or "").strip()
    inline_error_class = str(summary.get("inlineErrorClass") or "")
    if inline_error and inline_error != "-" and "hidden" not in inline_error_class:
        errors.append(f"inline error is visible: {inline_error}")
    if click.get("open") != "1":
        errors.append("add PDF did not open translation workflow dialog")
    exceptions = [event for event in events if event and event[0] == "exception"]
    if exceptions:
        errors.append(f"runtime exceptions: {exceptions[:3]}")
    job_responses = [item for item in responses if "/api/v1/jobs" in item[1]]
    if not job_responses:
        errors.append("no /api/v1/jobs response observed")
    elif not any(int(item[0]) == 200 for item in job_responses):
        errors.append(f"/api/v1/jobs did not return 200: {job_responses[:3]}")
    if errors:
        raise AssertionError("; ".join(errors))


def main():
    args = parse_args()
    binary = chromium_binary(args.chromium)
    profile = tempfile.mkdtemp(prefix="retainpdf-homepage-smoke-")
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
        send, events, responses = make_cdp(ws)
        send("Runtime.enable")
        send("Page.enable")
        send("Network.enable")
        send("Page.navigate", {"url": args.url})
        time.sleep(args.wait_seconds)
        summary = evaluate_homepage(send)
        click = click_add_pdf(send)
        report = {
            "summary": summary,
            "click": click,
            "events": events,
            "responses": responses,
        }
        assert_homepage(summary, click, events, responses, args.min_books)
        if args.json:
            print(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            print(f"homepage smoke ok: {summary.get('listChildren')} books, url={summary.get('href')}")
        return 0
    except Exception as exc:
        if "report" in locals():
            print(json.dumps(report, ensure_ascii=False, indent=2), file=sys.stderr)
        print(f"homepage smoke failed: {exc}", file=sys.stderr)
        return 1
    finally:
        try:
            proc.terminate()
        except Exception:
            pass
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
