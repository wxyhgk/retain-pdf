#!/usr/bin/env python3

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

try:
    import websocket
except ImportError as exc:
    raise SystemExit("python websocket-client is required for this smoke script") from exc


def parse_args():
    parser = argparse.ArgumentParser(description="Smoke test RetainPDF mock submit lifecycle in Chromium.")
    parser.add_argument("--url", default="http://127.0.0.1:40002/?mock=translate")
    parser.add_argument("--chromium", default="")
    parser.add_argument("--debug-port", type=int, default=9233)
    parser.add_argument("--wait-seconds", type=float, default=6)
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


def append_mock_query(url):
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    if "mock" in query:
        return url
    separator = "&" if parsed.query else "?"
    return f"{url}{separator}mock=translate"


def run_mock_submit(send):
    return evaluate(send, """
(async () => {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const snapshots = [];
  let createdEvents = 0;
  let updatedEvents = 0;
  document.addEventListener("retainpdf:library-job-created", () => { createdEvents += 1; });
  document.addEventListener("retainpdf:library-job-updated", () => { updatedEvents += 1; });

  const snapshot = (label) => {
    const cards = Array.from(document.querySelectorAll("recent-job-card, .recent-job-item"));
    const first = cards[0];
    snapshots.push({
      label,
      cardCount: cards.length,
      firstJobId: first?.jobId || first?.dataset?.jobId || "",
      firstText: (first?.innerText || first?.textContent || "").replace(/\\s+/g, " ").trim(),
      workflowOpen: document.getElementById("translation-workflow-dialog")?.dataset?.open || "",
      submitDisabled: Boolean(document.getElementById("submit-btn")?.disabled),
      statusPanelHidden: Boolean(document.getElementById("status-section")?.classList?.contains("hidden")),
    });
  };

  snapshot("initial");
  document.querySelector("#library-add-pdf-btn")?.click?.();
  await delay(120);
  snapshot("opened");
  const submit = document.querySelector("#submit-btn");
  submit?.click?.();
  await delay(900);
  snapshot("submitted");
  await delay(1800);
  snapshot("settled");

  return {
    href: location.href,
    createdEvents,
    updatedEvents,
    snapshots,
  };
})()
""")


def assert_mock_submit(report, events):
    errors = []
    snapshots = report.get("snapshots") or []
    opened = next((item for item in snapshots if item.get("label") == "opened"), {})
    submitted = next((item for item in snapshots if item.get("label") == "submitted"), {})
    settled = next((item for item in snapshots if item.get("label") == "settled"), {})
    if opened.get("workflowOpen") != "1":
        errors.append("add PDF did not open workflow dialog")
    if opened.get("submitDisabled"):
        errors.append("mock submit button is disabled")
    if report.get("createdEvents", 0) < 1:
        errors.append("mock submit did not publish library-job-created")
    submitted_text = f"{submitted.get('firstText', '')} {settled.get('firstText', '')}"
    if "mock-job-20260415" not in f"{submitted.get('firstJobId', '')} {settled.get('firstJobId', '')}":
        errors.append("mock job card was not present after submit")
    if "翻译中" not in submitted_text and "处理中" not in submitted_text:
        errors.append("mock job card did not show an active translation/processing state")
    if int(settled.get("cardCount") or 0) < 1:
        errors.append("recent job cards disappeared after mock submit")
    exceptions = [event for event in events if event and event[0] == "exception"]
    if exceptions:
        errors.append(f"runtime exceptions: {exceptions[:3]}")
    if errors:
        raise AssertionError("; ".join(errors))


def main():
    args = parse_args()
    binary = chromium_binary(args.chromium)
    profile = tempfile.mkdtemp(prefix="retainpdf-mock-submit-")
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
        send("Page.navigate", {"url": append_mock_query(args.url)})
        time.sleep(args.wait_seconds)
        report = run_mock_submit(send)
        assert_mock_submit(report, events)
        if args.json:
            print(json.dumps({"report": report, "events": events}, ensure_ascii=False, indent=2))
        else:
            settled = next((item for item in report.get("snapshots", []) if item.get("label") == "settled"), {})
            print(f"mock submit smoke ok: {settled.get('cardCount')} cards, first={settled.get('firstJobId')}")
        return 0
    except Exception as exc:
        if "report" in locals():
            print(json.dumps({"report": report, "events": events}, ensure_ascii=False, indent=2), file=sys.stderr)
        print(f"mock submit smoke failed: {exc}", file=sys.stderr)
        return 1
    finally:
        try:
            proc.terminate()
        except Exception:
            pass
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
