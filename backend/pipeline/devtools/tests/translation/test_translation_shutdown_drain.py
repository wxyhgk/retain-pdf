"""退出时在途的请求（状态管理设计 S20、L-D2，路线图第 0 步 Z1）。

- 连接都没建成的请求记 ``failed_not_sent``，不再算「结果不明」；发出去以后才断的照旧 ``ambiguous``。
- 翻译期间收到 SIGTERM：不再派发新请求，在途的等回来写上终态再退出；宽限到了还没回来的留成结果不明。

用本机回环上的真 socket 复现，不碰外网、不用真模型。测试进程里装着离线守卫（``tests/performance`` 的
``network_guard``，整个 pytest 会话都生效），所以用到 socket 的场景都放进子进程跑。
"""
import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import textwrap
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import requests
import urllib3

from retainpdf_translation.artifacts import RequestDispatchStopped
from retainpdf_translation.artifacts import TranslationRequestJournal
from retainpdf_translation.artifacts import begin_request_drain
from retainpdf_translation.artifacts import inflight_request_count
from retainpdf_translation.artifacts import wait_for_inflight_requests
from retainpdf_translation.artifacts.request_journal import _DISPATCH_GATE
from retainpdf_translation.llm.providers.deepseek import client as deepseek_client
from retainpdf_translation.workflow import shutdown_drain


NO_TRANSPORT_RECOVERY = {
    "RETAIN_TRANSLATION_TRANSPORT_RECOVERY_ATTEMPTS": "1",
    "RETAIN_TRANSLATION_TRANSPORT_RECOVERY_SECONDS": "0",
}


def _events(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def _child_env(**extra: str) -> dict[str, str]:
    env = dict(os.environ)
    env.update(NO_TRANSPORT_RECOVERY)
    env["PYTHONPATH"] = os.pathsep.join(path for path in sys.path if path)
    env.update(extra)
    return env


# 子进程：三种情形各发一次请求（只发一次、不重试），把请求日志里的事件和抛出的错打成一行 JSON。
#   refused：没人监听的端口，连接被拒（L-D2 的复现）；
#   closed：对方收下整个请求以后直接关连接；
#   timeout：对方收下请求以后一直不回，读超时。
_CLASSIFY_SCRIPT = textwrap.dedent(
    """
    import json, socket, sys, tempfile, threading
    from pathlib import Path
    from retainpdf_translation.artifacts import TranslationRequestJournal, TranslationRunDiagnostics
    from retainpdf_translation.artifacts import translation_run_diagnostics_scope
    from retainpdf_translation.llm.providers.deepseek import client
    client._prewarm_dns = lambda *args, **kwargs: None

    def closed_port():
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            return probe.getsockname()[1]

    def one_shot_server(behavior):
        listener = socket.socket()
        listener.bind(("127.0.0.1", 0))
        listener.listen(4)
        release = threading.Event()
        def serve():
            conn, _ = listener.accept()
            with conn:
                conn.settimeout(5)
                received = b""
                while b"\\r\\n\\r\\n" not in received:
                    chunk = conn.recv(65536)
                    if not chunk:
                        break
                    received += chunk
                if behavior == "hang":
                    release.wait(10)
        threading.Thread(target=serve, daemon=True).start()
        return listener.getsockname()[1]

    def request_once(port, timeout):
        base_url = f"http://127.0.0.1:{port}/v1"
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "translation-request-journal.v1.jsonl"
            journal = TranslationRequestJournal(path, attempt_id="attempt-classify")
            run = TranslationRunDiagnostics(provider_family="openai", model="m", base_url=base_url,
                configured_workers=1, configured_batch_size=1, configured_classify_batch_size=1,
                request_journal=journal)
            raised = ""
            with translation_run_diagnostics_scope(run):
                try:
                    client.request_chat_content([{"role": "user", "content": "hi"}], api_key="k", model="m",
                        base_url=base_url, request_label="book: p1", max_attempts=1, timeout=timeout)
                except Exception as exc:
                    raised = type(exc).__name__
            summary = journal.summary()
            journal.close()
            events = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
            return {"raised": raised, "events": [[e["event"], e.get("outcome", "")] for e in events],
                    "active_ambiguous": summary["active_ambiguous_request_keys"]}

    print(json.dumps({
        "refused": request_once(closed_port(), 5),
        "closed": request_once(one_shot_server("close"), 5),
        "timeout": request_once(one_shot_server("hang"), 1),
    }))
    """
)


class RequestNeverLeftClassificationTests(unittest.TestCase):
    """L-D2：断网时「连接被拒」以前也记成 ambiguous，下次启动逼用户确认一个根本没发出去的请求。"""

    results: dict = {}

    @classmethod
    def setUpClass(cls):
        completed = subprocess.run(
            [sys.executable, "-c", _CLASSIFY_SCRIPT], capture_output=True, text=True, timeout=120, env=_child_env()
        )
        if completed.returncode != 0:
            raise AssertionError(f"classification child failed: {completed.stderr[-2000:]}")
        cls.results = json.loads(completed.stdout.strip().splitlines()[-1])

    def test_connection_refused_is_recorded_as_not_sent(self):
        result = self.results["refused"]
        self.assertEqual(result["raised"], "ConnectionError")
        self.assertEqual(result["events"], [["dispatch", ""], ["terminal", "failed_not_sent"]])
        self.assertEqual(result["active_ambiguous"], 0, "没发出去的请求不能逼用户确认")

    def test_connection_closed_after_the_request_was_sent_stays_ambiguous(self):
        result = self.results["closed"]
        self.assertEqual(result["raised"], "ConnectionError")
        self.assertEqual(result["events"][-1], ["terminal", "ambiguous"], "已经发出去才断的，可能已经计费")
        self.assertEqual(result["active_ambiguous"], 1)

    def test_read_timeout_after_the_request_was_sent_stays_ambiguous(self):
        result = self.results["timeout"]
        self.assertEqual(result["raised"], "ReadTimeout")
        self.assertEqual(result["events"][-1], ["terminal", "ambiguous"])

    def test_only_errors_raised_before_the_connection_exists_count_as_not_sent(self):
        never_left = deepseek_client._request_never_left
        pool_url = "/v1/chat/completions"

        def wrapped(reason):
            return requests.ConnectionError(urllib3.exceptions.MaxRetryError(None, pool_url, reason=reason))

        refused = urllib3.exceptions.NewConnectionError(None, "Connection refused")
        dns = urllib3.exceptions.NameResolutionError("api.example.com", None, socket.gaierror(8, "nodename"))
        connect_timeout = urllib3.exceptions.ConnectTimeoutError(None, "connect timed out")
        self.assertTrue(never_left(wrapped(refused)))
        self.assertTrue(never_left(wrapped(dns)))
        self.assertTrue(never_left(requests.ConnectTimeout(urllib3.exceptions.MaxRetryError(None, pool_url, reason=connect_timeout))))
        self.assertTrue(never_left(requests.exceptions.ProxyError(urllib3.exceptions.MaxRetryError(
            None, pool_url, reason=urllib3.exceptions.ProxyError("Unable to connect to proxy", refused)))))
        self.assertTrue(never_left(socket.gaierror(8, "nodename nor servname provided")))

        # 连上以后才出的错：可能已经发出去、已经计费
        self.assertFalse(never_left(requests.ConnectionError(urllib3.exceptions.ProtocolError("Connection aborted."))))
        self.assertFalse(never_left(requests.ReadTimeout("read timed out")))
        self.assertFalse(never_left(requests.exceptions.SSLError(urllib3.exceptions.MaxRetryError(
            None, pool_url, reason=urllib3.exceptions.SSLError("bad record mac")))))
        self.assertFalse(never_left(requests.exceptions.ProxyError(urllib3.exceptions.MaxRetryError(
            None, pool_url, reason=urllib3.exceptions.ProxyError("tunnel failed", OSError("reset"))))))
        self.assertFalse(never_left(requests.ConnectionError("no structured reason")))
        self.assertFalse(never_left(RuntimeError("anything else")))


class DispatchGateTests(unittest.TestCase):
    def tearDown(self):
        _DISPATCH_GATE.reset_for_tests()

    def test_drain_stops_new_dispatches_and_waits_for_the_ones_in_flight(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "translation-request-journal.v1.jsonl"
            journal = TranslationRequestJournal(path, attempt_id="attempt-drain")
            token = journal.record_dispatch(request_key="a" * 64, stage="translation", request_label="x", http_attempt=1)
            self.assertEqual(begin_request_drain(), 1)
            self.assertFalse(wait_for_inflight_requests(0.05), "在途请求还没写终态")

            outcome = {}

            def late_request():
                try:
                    journal.record_dispatch(request_key="b" * 64, stage="translation", request_label="y", http_attempt=1)
                    outcome["result"] = "dispatched"
                except RequestDispatchStopped:
                    outcome["result"] = "stopped"

            late = threading.Thread(target=late_request)
            late.start()
            time.sleep(0.2)
            self.assertTrue(late.is_alive(), "排空期间新请求要停在闸门上，不写 dispatch、不发")

            journal.record_terminal(request_token=token, request_key="a" * 64, outcome="succeeded")
            self.assertTrue(wait_for_inflight_requests(1.0))
            self.assertEqual(inflight_request_count(), 0)

            _DISPATCH_GATE.release_stopped_for_tests()
            late.join(timeout=5)
            self.assertEqual(outcome.get("result"), "stopped")
            journal.close()
            self.assertEqual([event["event"] for event in _events(path)], ["dispatch", "terminal"])

    def test_failed_terminal_write_still_releases_the_in_flight_slot(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "translation-request-journal.v1.jsonl"
            journal = TranslationRequestJournal(path, attempt_id="attempt-closed")
            token = journal.record_dispatch(request_key="c" * 64, stage="translation", request_label="z", http_attempt=1)
            journal.close()
            with self.assertRaises(RuntimeError):
                journal.record_terminal(request_token=token, request_key="c" * 64, outcome="succeeded")
            self.assertEqual(inflight_request_count(), 0, "写不上终态的请求也不能一直算在途，否则排空等满宽限")

    def test_unsupported_outcome_is_rejected_and_not_sent_is_accepted(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "translation-request-journal.v1.jsonl"
            journal = TranslationRequestJournal(path, attempt_id="attempt-outcomes")
            token = journal.record_dispatch(request_key="d" * 64, stage="translation", request_label="w", http_attempt=1)
            with self.assertRaises(ValueError):
                journal.record_terminal(request_token=token, request_key="d" * 64, outcome="maybe")
            journal.record_terminal(request_token=token, request_key="d" * 64, outcome="failed_not_sent")
            summary = journal.summary()
            journal.close()
            self.assertEqual(summary["current_unresolved_dispatches"], 0)
            self.assertEqual(summary["active_ambiguous_request_keys"], 0)
            # 重开（续跑）时也不算结果不明
            reopened = TranslationRequestJournal(path, attempt_id="attempt-resume")
            self.assertEqual(reopened.summary()["inherited_active_ambiguous_request_keys"], 0)
            reopened.close()


class DrainSettingsTests(unittest.TestCase):
    def test_grace_defaults_below_the_rust_worker_grace_and_is_clamped(self):
        with patch.dict(os.environ, {shutdown_drain.SHUTDOWN_DRAIN_SECONDS_ENV: ""}, clear=False):
            self.assertEqual(shutdown_drain.shutdown_drain_seconds(), 2.0)
        # Rust 默认 3 秒后 SIGKILL（RUST_API_WORKER_TERMINATE_GRACE_SECS），排空要在那之前自己退出
        self.assertLess(shutdown_drain.DEFAULT_SHUTDOWN_DRAIN_SECONDS, 3.0)
        for raw, expected in (("0.5", 0.5), ("-1", 0.0), ("999", 30.0), ("nan", 2.0), ("abc", 2.0)):
            with patch.dict(os.environ, {shutdown_drain.SHUTDOWN_DRAIN_SECONDS_ENV: raw}, clear=False):
                self.assertEqual(shutdown_drain.shutdown_drain_seconds(), expected, raw)

    @unittest.skipUnless(hasattr(signal, "SIGTERM"), "需要 SIGTERM")
    def test_translation_execution_installs_the_drain_and_restores_the_handler_afterwards(self):
        from retainpdf_translation.workflow import execution

        seen = {}

        def fake_execute(request):
            seen["handler"] = signal.getsignal(signal.SIGTERM)
            seen["stdout"] = sys.stdout
            return {"ok": True}

        before = signal.getsignal(signal.SIGTERM)
        stdout_before = sys.stdout
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch.object(execution, "_execute_with_owned_output", fake_execute):
                result = execution.execute_translation_request(
                    execution.TranslationExecutionRequest(
                        source_json_path=Path(temp_dir) / "document.json", output_dir=Path(temp_dir), api_key=""
                    )
                )
        self.assertEqual(result, {"ok": True})
        self.assertTrue(callable(seen["handler"]))
        self.assertIsNot(seen["handler"], before, "翻译期间 SIGTERM 要换成排空")
        self.assertIsInstance(seen["stdout"], shutdown_drain._PipeTolerantStream)
        self.assertEqual(signal.getsignal(signal.SIGTERM), before, "翻译结束要换回原来的处理")
        self.assertIs(sys.stdout, stdout_before)

    def test_closed_output_is_swallowed_during_the_drain(self):
        class Broken:
            def write(self, data):
                raise BrokenPipeError(32, "Broken pipe")

            def flush(self):
                raise BrokenPipeError(32, "Broken pipe")

        stream = shutdown_drain._PipeTolerantStream(Broken())
        self.assertEqual(stream.write("line\n"), 5)
        stream.flush()

        # 任务日志的镜像先写文件：stdout 的管道断了，日志文件里还有这一行（tee_output.py）
        import io

        from retainpdf_pipeline.foundation.shared.tee_output import _TeeTextIO

        mirror = io.StringIO()
        tee = _TeeTextIO(Broken(), mirror)
        self.assertEqual(shutdown_drain._PipeTolerantStream(tee).write("kept\n"), 5)
        self.assertEqual(mirror.getvalue(), "kept\n")


# 子进程：起一个本机假模型服务（每个请求等 delay 秒才回），装上排空处理，几个线程不停地发请求；
# 服务收齐 workers 个请求（都在途）以后打印 INFLIGHT，等父进程发 SIGTERM。
_WORKER_SCRIPT = textwrap.dedent(
    """
    import json, socketserver, sys, threading, time
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from pathlib import Path
    from retainpdf_translation.artifacts import TranslationRequestJournal, TranslationRunDiagnostics
    from retainpdf_translation.artifacts import translation_run_diagnostics_scope
    from retainpdf_translation.llm.providers.deepseek import client
    from retainpdf_translation.workflow.shutdown_drain import sigterm_drains_inflight_requests

    journal_path, workers, delay = Path(sys.argv[1]), int(sys.argv[2]), float(sys.argv[3])
    arrived = threading.Semaphore(0)

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            self.rfile.read(int(self.headers.get("Content-Length") or 0))
            arrived.release()
            time.sleep(delay)
            body = json.dumps({"choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}]}).encode()
            try:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except OSError:
                pass

        def log_message(self, *args):
            pass

    class Server(ThreadingHTTPServer):
        daemon_threads = True

        def server_bind(self):  # 不查主机名
            socketserver.TCPServer.server_bind(self)
            self.server_name, self.server_port = self.server_address[:2]

    server = Server(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}/v1"
    client._prewarm_dns = lambda *args, **kwargs: None
    journal = TranslationRequestJournal(journal_path, attempt_id="attempt-sigterm")
    run = TranslationRunDiagnostics(provider_family="openai", model="m", base_url=base_url,
        configured_workers=workers, configured_batch_size=1, configured_classify_batch_size=1,
        request_journal=journal)

    def loop(index):
        n = 0
        while True:
            n += 1
            client.request_chat_content([{"role": "user", "content": f"w{index}-{n}"}], api_key="k", model="m",
                base_url=base_url, request_label=f"book: w{index} r{n}", max_attempts=1, timeout=60)

    with sigterm_drains_inflight_requests():
        with translation_run_diagnostics_scope(run):
            for index in range(workers):
                threading.Thread(target=loop, args=(index,), daemon=True).start()
            for _ in range(workers):
                arrived.acquire()
            print("INFLIGHT", flush=True)
            while True:
                time.sleep(0.05)
    """
)


@unittest.skipUnless(os.name == "posix", "POSIX 才有 SIGTERM 排空；Windows 上 Rust 用 taskkill 强杀 worker")
class SigtermDrainProcessTests(unittest.TestCase):
    """真进程：worker 收到 SIGTERM 后留下的请求日志，就是下次启动对账看到的东西。"""

    def _run_worker(self, *, response_delay: float, drain_seconds: str, workers: int = 3):
        with tempfile.TemporaryDirectory() as temp_dir:
            journal_path = Path(temp_dir) / "translation-request-journal.v1.jsonl"
            process = subprocess.Popen(
                [sys.executable, "-c", _WORKER_SCRIPT, str(journal_path), str(workers), str(response_delay)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=_child_env(**{shutdown_drain.SHUTDOWN_DRAIN_SECONDS_ENV: drain_seconds}),
            )
            try:
                # 客户端也往 stdout 打日志：读到 INFLIGHT 为止
                for line in iter(process.stdout.readline, b""):
                    if line.strip() == b"INFLIGHT":
                        break
                else:
                    self.fail("worker exited before its requests were in flight")
                # 模拟运行时退出：Rust 先停自己的运行时、不再读 stdout，然后才发 SIGTERM
                process.stdout.close()
                signaled_at = time.monotonic()
                process.send_signal(signal.SIGTERM)
                returncode = process.wait(timeout=30)
                elapsed = time.monotonic() - signaled_at
                stderr = process.stderr.read().decode("utf-8", "replace")
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
                process.stderr.close()
            return returncode, elapsed, _events(journal_path), stderr

    def test_sigterm_waits_for_in_flight_requests_and_closes_them_in_the_journal(self):
        returncode, elapsed, events, stderr = self._run_worker(response_delay=0.6, drain_seconds="2")
        self.assertEqual(returncode, 143, stderr)
        self.assertLess(elapsed, 2.0, "在途请求回来了就该退出，不必等满宽限")
        dispatches = [event for event in events if event["event"] == "dispatch"]
        terminals = {event["request_token"]: event["outcome"] for event in events if event["event"] == "terminal"}
        self.assertEqual(len(dispatches), 3, "排空开始以后不能再有新的 dispatch")
        self.assertEqual(
            {dispatch["request_token"]: terminals.get(dispatch["request_token"]) for dispatch in dispatches},
            {dispatch["request_token"]: "succeeded" for dispatch in dispatches},
            "每个在途请求都要写上终态，下次启动才不会算结果不明",
        )

    def test_requests_still_out_after_the_grace_period_stay_unresolved(self):
        returncode, elapsed, events, stderr = self._run_worker(response_delay=20, drain_seconds="0.5")
        self.assertEqual(returncode, 143, stderr)
        self.assertLess(elapsed, 3.0, "宽限到了要自己退出，不能等到 Rust 的 SIGKILL")
        dispatches = [event for event in events if event["event"] == "dispatch"]
        terminals = [event for event in events if event["event"] == "terminal"]
        self.assertEqual(len(dispatches), 3)
        self.assertEqual(terminals, [], "没回来的请求不能被写成别的终态：结果不明，等用户确认")
        self.assertIn("still in flight", stderr)


if __name__ == "__main__":
    unittest.main()
