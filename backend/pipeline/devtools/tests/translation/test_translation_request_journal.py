import json
import multiprocessing
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.artifacts import TranslationRequestJournal


def _crash_after_durable_dispatch(path: str, request_key: str) -> None:
    journal = TranslationRequestJournal(Path(path), attempt_id="source-attempt")
    journal.record_dispatch(
        request_key=request_key,
        stage="translation",
        request_label="book: batch 1/1 item 1/1",
        http_attempt=1,
    )
    os._exit(23)


class TranslationRequestJournalTests(unittest.TestCase):
    def test_group_commit_preserves_concurrent_dispatch_and_terminal_records(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "translation-request-journal.v1.jsonl"
            journal = TranslationRequestJournal(path, attempt_id="parallel-attempt")
            barrier = threading.Barrier(24)

            def worker(index: int) -> None:
                request_key = f"{index:064x}"
                barrier.wait()
                token = journal.record_dispatch(
                    request_key=request_key,
                    stage="translation",
                    request_label=f"item-{index}",
                    http_attempt=1,
                )
                journal.record_terminal(
                    request_token=token,
                    request_key=request_key,
                    outcome="succeeded",
                )

            threads = [threading.Thread(target=worker, args=(index,)) for index in range(24)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=10)
                self.assertFalse(thread.is_alive())
            self.assertEqual(journal.summary()["current_unresolved_dispatches"], 0)
            journal.close()

            events = [json.loads(line) for line in path.read_text().splitlines()]
            self.assertEqual(len(events), 48)
            self.assertEqual(sum(event["event"] == "dispatch" for event in events), 24)
            self.assertEqual(sum(event["event"] == "terminal" for event in events), 24)

    def test_process_crash_leaves_durable_ambiguous_dispatch_for_retry(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "translation-request-journal.v1.jsonl"
            request_key = "a" * 64
            process = multiprocessing.get_context("fork").Process(
                target=_crash_after_durable_dispatch,
                args=(str(path), request_key),
            )
            process.start()
            process.join(timeout=10)
            self.assertEqual(process.exitcode, 23)

            retry_journal = TranslationRequestJournal(path, attempt_id="retry-attempt")
            inherited = retry_journal.summary()
            self.assertEqual(inherited["inherited_unresolved_dispatches"], 1)
            self.assertEqual(inherited["inherited_ambiguous_request_keys"], 1)

            retry_token = retry_journal.record_dispatch(
                request_key=request_key,
                stage="translation",
                request_label="book: batch 1/1 item 1/1",
                http_attempt=2,
            )
            retry_journal.record_terminal(
                request_token=retry_token,
                request_key=request_key,
                outcome="succeeded",
            )
            resolved = retry_journal.summary()
            self.assertEqual(resolved["current_unresolved_dispatches"], 0)
            self.assertEqual(resolved["active_ambiguous_request_keys"], 0)
            self.assertEqual(resolved["known_ambiguous_request_keys"], 1)
            retry_journal.close()

            events = [json.loads(line) for line in path.read_text().splitlines()]
            retry_dispatch = next(
                event
                for event in events
                if event["event"] == "dispatch" and event["attempt_id"] == "retry-attempt"
            )
            self.assertTrue(retry_dispatch["prior_ambiguous"])
            self.assertEqual(events[-1]["outcome"], "succeeded")

    def test_journal_contains_only_hash_and_lifecycle_metadata(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "translation-request-journal.v1.jsonl"
            journal = TranslationRequestJournal(path, attempt_id="attempt-a")
            token = journal.record_dispatch(
                request_key="b" * 64,
                stage="translation",
                request_label="safe-label",
                http_attempt=1,
            )
            journal.record_terminal(
                request_token=token,
                request_key="b" * 64,
                outcome="ambiguous",
                error_class="ReadTimeout",
            )
            journal.close()

            persisted = path.read_text()
            self.assertNotIn("raw secret prompt", persisted)
            self.assertNotIn("sk-sensitive-api-key", persisted)
            self.assertNotIn("https://private-provider.example", persisted)
            self.assertNotIn("safe-label", persisted)
            self.assertIn('"outcome":"ambiguous"', persisted)

    def test_complete_corrupt_line_is_rejected_but_torn_tail_is_ignored(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "translation-request-journal.v1.jsonl"
            path.write_text("{not-json}\n")
            with self.assertRaisesRegex(RuntimeError, "invalid translation request journal"):
                TranslationRequestJournal(path, attempt_id="attempt-a")

            path.write_text('{"schema":"translation_request_journal_v1"')
            journal = TranslationRequestJournal(path, attempt_id="attempt-b")
            self.assertEqual(journal.summary()["current_unresolved_dispatches"], 0)
            journal.close()


if __name__ == "__main__":
    unittest.main()
