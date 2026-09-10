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
    parser = argparse.ArgumentParser(description="Smoke test RetainPDF parallel translation/render status in Chromium.")
    parser.add_argument("--url", default="http://127.0.0.1:40002/?mock=parallel")
    parser.add_argument("--chromium", default="")
    parser.add_argument("--debug-port", type=int, default=9234)
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
    if query.get("mock") == ["parallel"]:
        return url
    separator = "&" if parsed.query else "?"
    return f"{url}{separator}mock=parallel"


def collect_report(send):
    return evaluate(send, """
(async () => {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const firstCard = document.querySelector("recent-job-card, .recent-job-item");
  firstCard?.dispatchEvent?.(new MouseEvent("click", { bubbles: true }));
  await delay(1800);
  const statusCard = document.getElementById("job-status-card");
  const selectedStage = statusCard?.querySelector?.(".status-stage-step[aria-selected='true'], .status-stage-step.is-current, .status-stage-step.is-selected");
  return {
    href: location.href,
    cardCount: document.querySelectorAll("recent-job-card, .recent-job-item").length,
    firstJobId: firstCard?.jobId || firstCard?.dataset?.jobId || "",
    firstCardText: (firstCard?.innerText || firstCard?.textContent || "").replace(/\\s+/g, " ").trim(),
    workflowOpen: document.getElementById("translation-workflow-dialog")?.dataset?.open || "",
    statusHidden: Boolean(document.getElementById("status-section")?.classList?.contains("hidden")),
    statusText: (statusCard?.innerText || statusCard?.textContent || "").replace(/\\s+/g, " ").trim(),
    ringLabel: document.getElementById("status-ring-label")?.textContent || "",
    ringValue: document.getElementById("status-ring-value")?.textContent || "",
    ringProgress: document.getElementById("status-progress-ring")?.textContent || "",
    progressText: document.getElementById("job-progress-text")?.textContent || "",
    selectedStageKey: selectedStage?.dataset?.stageKey || "",
  };
})()
""")


def assert_parallel_status(report, events):
    errors = []
    card_text = report.get("firstCardText", "")
    status_text = report.get("statusText", "")
    combined = f"{card_text} {status_text} {report.get('ringLabel', '')} {report.get('ringValue', '')} {report.get('progressText', '')}"
    if report.get("workflowOpen") != "1" or report.get("statusHidden"):
        errors.append("status dialog did not open from the recent job card")
    if "翻译中" not in card_text:
        errors.append("recent job card is not showing translation as the main stage")
    if "渲染中" in card_text:
        errors.append("recent job card was overwritten by background render stage")
    if "翻译" not in combined:
        errors.append("status card is not showing translation content")
    if "第 120/900 批" not in combined and "120/900" not in combined:
        errors.append("status card did not preserve translation batch progress")
    if report.get("selectedStageKey") == "render":
        errors.append("status card selected render stage for background prewarm")
    exceptions = [event for event in events if event and event[0] == "exception"]
    if exceptions:
        errors.append(f"runtime exceptions: {exceptions[:3]}")
    if errors:
        raise AssertionError("; ".join(errors))


def main():
    args = parse_args()
    binary = chromium_binary(args.chromium)
    profile = tempfile.mkdtemp(prefix="retainpdf-parallel-status-")
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
        report = collect_report(send)
        assert_parallel_status(report, events)
        if args.json:
            print(json.dumps({"report": report, "events": events}, ensure_ascii=False, indent=2))
        else:
            print(f"parallel status smoke ok: first={report.get('firstJobId')}, progress={report.get('progressText')}")
        return 0
    except Exception as exc:
        if "report" in locals():
            print(json.dumps({"report": report, "events": events}, ensure_ascii=False, indent=2), file=sys.stderr)
        print(f"parallel status smoke failed: {exc}", file=sys.stderr)
        return 1
    finally:
        try:
            proc.terminate()
        except Exception:
            pass
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
