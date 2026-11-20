"""Local scheduling observations; never confuse these with HTTP attempts."""
import threading
import time


class SchedulerMetrics:
    def __init__(self, task_count, workers):
        self.started_at = time.monotonic()
        self.lock = threading.Lock()
        self.task_count, self.workers = task_count, workers
        self.active = self.peak = self.started = self.finished = 0
        self.wait_ms = []
        self.first_applied_ms = {}

    def start(self):
        with self.lock:
            self.active += 1
            self.started += 1
            self.peak = max(self.peak, self.active)
            self.wait_ms.append(round((time.monotonic() - self.started_at) * 1000, 3))

    def finish(self):
        with self.lock:
            self.active -= 1
            self.finished += 1

    def applied(self, pages):
        for page in pages:
            self.first_applied_ms.setdefault(str(page + 1), round((time.monotonic() - self.started_at) * 1000, 3))

    def snapshot(self):
        with self.lock:
            values = sorted(self.wait_ms)
            return {"task_count": self.task_count, "workers": self.workers, "peak_active_tasks": self.peak,
                    "started_tasks": self.started, "finished_tasks": self.finished,
                    "python_queue_wait_ms": {"sum": sum(values), "max": max(values, default=None),
                                             "p95": values[min(len(values)-1, int(len(values)*0.95))] if values else None},
                    "first_result_applied_ms_by_page": dict(self.first_applied_ms),
                    "timing_scope": "since_translation_queue_creation; task metrics, not HTTP; applied is not committed"}
