"""User-facing Stop contracts, exercised through installed commands and real nmem."""

import json
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[1]


def exercise_stop_contract(scenario):
    nmem = shutil.which("nmem")
    assert nmem, "Real nmem CLI is required for this acceptance gate"
    with tempfile.TemporaryDirectory(prefix=".synthetic-stop-", dir=PLUGIN / "tests") as directory:
        root = Path(directory)
        home = root / "home"
        proma = home / ".proma"
        scripts = proma / "scripts"
        scripts.mkdir(parents=True)
        shutil.copy2(PLUGIN / "hooks" / "save-to-nmem.py", scripts)
        binary_dir = root / "bin"
        binary_dir.mkdir()
        (binary_dir / "python3").symlink_to(sys.executable)
        (binary_dir / "nmem").symlink_to(nmem)
        queue = root / "queue"
        requests = []

        class Sink(BaseHTTPRequestHandler):
            def do_GET(self):
                requests.append(self.path)
                self.send_response(503)
                self.end_headers()

            do_POST = do_GET

            def log_message(self, *args):
                pass

        server = HTTPServer(("127.0.0.1", 0), Sink)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            env = {
                "HOME": str(home), "PROMA_HOME": str(proma),
                "PATH": str(binary_dir), "PYTHONDONTWRITEBYTECODE": "1",
                "NMEM_SESSION_CAPTURE_QUEUE_DIR": str(queue),
                "NMEM_CLI_CONFIG_DIR": str(root / "cli-config"),
                "NMEM_APP_CONFIG_DIR": str(root / "app-config"),
                "NMEM_API_URL": f"http://127.0.0.1:{server.server_port}",
            }
            transcript = proma / "sdk-config/projects/synthetic/synthetic-stop.jsonl"
            if scenario == "legacy":
                transcript = proma / "agent-sessions/synthetic-stop.jsonl"
            transcript.parent.mkdir(parents=True)
            transcript.write_text(json.dumps({"type": "user", "uuid": "synthetic-user", "message": {"role": "user", "content": "synthetic acceptance only"}}) + "\n")
            project = proma / "agent-workspaces/default"
            project.mkdir(parents=True)
            command = [nmem, "--json", "t", "capture", "--from", "proma", "--session-id", "synthetic-stop", "--project", "." if scenario == "missing-cwd" else str(project), "--transcript-path", str(transcript), "--sync", "--all-projects"]
            result = subprocess.run(command, env=env, cwd=root, capture_output=True, text=True, timeout=15, check=False)
            assert result.returncode == 0, result.stderr
            output = json.loads(result.stdout)
            assert output["status"] == "enqueued", output
            repeated = subprocess.run(command, env=env, cwd=root, capture_output=True, text=True, timeout=15, check=False)
            assert repeated.returncode == 0, repeated.stderr
            assert json.loads(repeated.stdout)["status"] == "enqueued"
            receipts = list(queue.rglob("pending-*.json"))
            assert receipts
            expected_receipts = [json.loads(receipt.read_text()) for receipt in receipts]
            receipt = json.loads(receipts[0].read_text())
            assert receipt["source_app"] == "proma"
            assert receipt["session_id"] == "synthetic-stop"
            assert receipt["transcript_path"] == str(transcript)
            assert receipt["project"] == str(root if scenario == "missing-cwd" else project)
            assert receipt["use_sync"] is True and receipt["all_projects"] is True
            for receipt_path in receipts:
                receipt_path.unlink()
            payload = {"session_id": "synthetic-stop", "cwd": str(project)}
            if scenario in {"missing-cwd", "unknown-workspace"}:
                payload.pop("cwd")
            if scenario in {"denied-workspace", "unknown-workspace"}:
                env["PROMA_ALLOWED_WORKSPACES"] = "other"
            if scenario == "missing-session":
                payload["session_id"] = "absent-synthetic-session"
            if scenario == "missing-cli":
                (binary_dir / "nmem").unlink()
            if scenario == "rejected-cli":
                blocked = root / "not-a-directory"
                blocked.write_text("synthetic queue failure")
                env["NMEM_SESSION_CAPTURE_QUEUE_DIR"] = str(blocked / "queue")
            hooks = json.loads((PLUGIN / "hooks/hooks.json").read_text())
            stop = hooks["hooks"]["Stop"][0]["hooks"][0]["command"]
            for _ in range(2):
                result = subprocess.run(["/bin/sh", "-c", stop], input=json.dumps(payload), env=env, cwd=root, capture_output=True, text=True, timeout=15, check=False)
                assert result.returncode == 0, result.stderr
            pending = list(queue.rglob("pending-*.json"))
            accepted = scenario in {"sdk", "legacy", "missing-cwd"}
            assert len(pending) == (len(expected_receipts) if accepted else 0), pending
            if accepted:
                actual_receipts = [json.loads(receipt.read_text()) for receipt in pending]
                assert sorted(actual_receipts, key=lambda value: json.dumps(value, sort_keys=True)) == sorted(expected_receipts, key=lambda value: json.dumps(value, sort_keys=True))
            log_path = proma / "logs/nm-hooks.log"
            assert log_path.exists()
            log = log_path.read_text()
            assert ("queued session=" in log) is accepted
            if scenario in {"missing-cli", "rejected-cli"}:
                assert "durable enqueue was not acknowledged" in log
            assert requests == [], requests
        finally:
            server.shutdown()
            worker.join(timeout=5)
            server.server_close()


@pytest.mark.parametrize("scenario", ["sdk", "legacy", "missing-cwd", "denied-workspace", "unknown-workspace", "missing-session", "missing-cli", "rejected-cli"], ids=lambda value: f"user Given {value} When Stop repeats Then durable queue or fail-open without REST")
def test_user_stop_contract(scenario):
    exercise_stop_contract(scenario)
