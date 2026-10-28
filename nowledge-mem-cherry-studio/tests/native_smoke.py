"""Synthetic companion -> real native CLI -> loopback HTTP contract smoke.

Run explicitly with --nmem /absolute/path/to/reviewed/nmem. Never loads the
operator's profile or an existing Cherry database. Not a live-backend test.
"""

import argparse
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, unquote, urlparse

COMPANION = Path(__file__).resolve().parents[1] / "nowledge_mem_cherry_studio.py"
SPACE = "Exact/Case Space"


def smoke(nmem):
    stored, writes, errors = {}, [], []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def reply(self, status, body):
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            url = urlparse(self.path)
            identifier = unquote(url.path.removeprefix("/threads/"))
            query = parse_qs(url.query)
            if query.get("space_id", [SPACE]) != [SPACE]:
                errors.append("GET scope changed")
            if identifier in stored:
                self.reply(200, stored[identifier])
            else:
                self.reply(404, {"detail": "Thread not found"})

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if self.headers.get("Authorization") != "Bearer synthetic-key":
                errors.append("native auth not propagated")
            if body.get("space_id") != SPACE:
                errors.append("POST scope changed")
            writes.append(self.path)
            if self.path == "/threads/history-sync/completed":
                self.reply(200, {"success": True})
            elif self.path == "/threads":
                identifier = body["thread_id"]
                stored[identifier] = body
                self.reply(200, body)
            elif self.path.endswith("/append"):
                identifier = unquote(self.path[len("/threads/"):-len("/append")])
                rows = stored[identifier]["messages"]
                old = {row["metadata"]["external_id"] for row in rows}
                added = [row for row in body["messages"] if row["metadata"]["external_id"] not in old]
                if body.get("deduplicate") is not True:
                    errors.append("native dedup not enabled")
                rows.extend(added)
                self.reply(200, {"messages_added": len(added), "total_messages": len(rows)})
            elif self.path.endswith("/metadata/merge"):
                self.reply(200, {"success": True})
            else:
                errors.append("unexpected write endpoint: " + self.path)
                self.reply(500, {"detail": "Unexpected endpoint"})

    with tempfile.TemporaryDirectory(prefix="cherry-native-smoke-") as directory:
        root = Path(directory)
        database = root / "cherrystudio.sqlite"
        conn = sqlite3.connect(database)
        conn.executescript("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;"
                           "CREATE TABLE topic(id TEXT,name TEXT,active_node_id TEXT,last_activity_at INTEGER,deleted_at INTEGER);"
                           "CREATE TABLE message(id TEXT,parent_id TEXT,topic_id TEXT,role TEXT,data TEXT,status TEXT,created_at INTEGER,deleted_at INTEGER);"
                           "INSERT INTO topic VALUES('chat','Synthetic smoke','a',1770000000000,NULL);")

        def message(identifier, parent, role, text, created):
            conn.execute("INSERT INTO message VALUES(?,?,'chat',?,?, 'success',?,NULL)",
                         (identifier, parent, role, json.dumps({"parts": [{"type": "text", "text": text}]}), created))
            conn.commit()

        message("root", None, "root", "", 0)
        message("u", "root", "user", "Synthetic question", 1)
        message("a", "u", "assistant", "Synthetic answer", 2)
        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            # No inherited URL/key/Space can reach a real service.
            env = {key: value for key, value in os.environ.items() if not key.startswith("NMEM_")}
            env.update(NMEM_CLI_CONFIG_DIR=str(root / "profile"), NMEM_API_URL=f"http://127.0.0.1:{server.server_port}",
                       NMEM_API_KEY="synthetic-key", NMEM_DISABLE_UPDATE_CHECK="1")
            command = [sys.executable, str(COMPANION), "--nmem", str(nmem), "--database", str(database), "--space-id", SPACE]

            def run(apply=False):
                result = subprocess.run(command + (["--apply"] if apply else []), env=env, capture_output=True, text=True, timeout=30)
                report = json.loads(result.stdout)
                assert result.returncode == 0, report
                return report

            assert run()["uploaded"] is False
            assert not writes, "Preview performed a durable write"
            assert run(True)["created"] == 1
            identifier = "cherrystudio-topic-chat"
            assert len(stored[identifier]["messages"]) == 2
            message("u2", "a", "user", "Follow-up", 3)
            message("a2", "u2", "assistant", "Second answer", 4)
            conn.execute("UPDATE topic SET active_node_id='a2'")
            conn.commit()
            assert run(True)["appended"] == 1
            assert len(stored[identifier]["messages"]) == 4
            assert run(True)["appended"] == 0
            assert len(stored[identifier]["messages"]) == 4
            message("alt", "u", "assistant", "Alternate answer", 5)
            conn.execute("UPDATE topic SET active_node_id='alt'")
            conn.commit()
            assert run(True)["created"] == 1
            assert len(stored) == 2
            assert len(stored[identifier]["messages"]) == 4
            assert not errors, errors
            print("PASS: preview no writes; create; append; replay no duplicate; branch isolation; exact Space and auth")
        finally:
            conn.close()
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)
            assert not thread.is_alive()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nmem", required=True, type=Path)
    smoke(parser.parse_args().nmem.resolve(strict=True))
