"""Replay synthetic dialogue across a real Pi process restart into a loopback receiver.

Usage: python3 native-pi-dialogue-smoke.py PI_BINARY PACKAGE_DIR [--discover]
No model requests, live-config edits or real Mem writes are made. --discover
loads the package through isolated global Pi settings instead of explicit -e.
"""
import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pi", type=Path)
    parser.add_argument("package", type=Path)
    parser.add_argument("--discover", action="store_true")
    args = parser.parse_args()
    pi, package = args.pi.resolve(), args.package.resolve()
    requests, stored = [], {}

    class Receiver(BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            requests.append({"path": self.path, "body": body})
            status = 200
            if self.path == "/threads" and stored:
                status = 409
                result = {"error_code": "thread_already_exists"}
            else:
                before = len(stored)
                for message in body["messages"]:
                    stored[message["metadata"]["external_id"]] = message
                result = (
                    {"thread": {"thread_id": body["thread_id"], "message_count": len(stored)}}
                    if self.path == "/threads" else
                    {"success": True, "messages_added": len(stored) - before, "total_messages": len(stored)}
                )
            payload = json.dumps(result).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Receiver)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix="pi-native-dialogue-") as tmp:
            root = Path(tmp)
            agent = root / "agent"
            agent.mkdir()
            if args.discover:
                (agent / "settings.json").write_text(json.dumps({"packages": [str(package)]}))
            cli = root / "nmem"
            reply = json.dumps({"binding": None, "content": "Synthetic startup context"})
            cli.write_text("#!/bin/sh\nprintf '%s\\n' " + shlex.quote(reply) + "\n")
            cli.chmod(0o700)
            session = root / "fixture.jsonl"
            timestamp = "2026-10-30T00:00:00Z"
            session.write_text(json.dumps({
                "type": "session", "version": 3, "id": "00000000-0000-4000-8000-000000000030",
                "timestamp": timestamp, "cwd": tmp,
            }) + "\n")

            def append(identifier, role, content, **extra):
                rows = [json.loads(line) for line in session.read_text().splitlines() if line]
                parent = rows[-1].get("id") if len(rows) > 1 else None
                entry = {"type": "message", "id": identifier, "parentId": parent, "timestamp": timestamp,
                         "message": {"role": role, "content": content, "timestamp": 1793318400000, **extra}}
                with session.open("a") as stream:
                    stream.write(json.dumps(entry) + "\n")

            def text(value):
                return {"type": "text", "text": value}

            append("system", "system", [text("INTERNAL system and tools")])
            append("user", "user", [text("Synthetic native question")])
            append("thinking", "assistant", [{"type": "thinking", "thinking": "INTERNAL thinking"}])
            append("call", "assistant", [{"type": "toolCall", "id": "tool1", "name": "read", "arguments": {"path": "INTERNAL"}}])
            append("result", "toolResult", [text("INTERNAL tool result")], toolCallId="tool1", toolName="read", isError=False)
            append("final", "assistant", [text("Synthetic native answer"), {"type": "thinking", "thinking": "INTERNAL mixed thinking"}])
            append("custom", "custom", "INTERNAL injected context", customType="fixture-context", display=True)
            env = dict(
                os.environ, PI_CODING_AGENT_DIR=str(agent), PI_OFFLINE="1", NMEM_PLUGIN_SOURCE_APP="pi",
                NMEM_PLUGIN_DEBUG="1", NMEM_API_URL=f"http://127.0.0.1:{server.server_port}",
                NMEM_API_KEY="fixture-only", NMEM_SPACE="fixture-only", NMEM_SPACE_ID="fixture-only",
                NMEM_AGENT_ID="fixture-agent", NMEM_HOST_AGENT_ID="fixture-host",
                NMEM_CLI_CONFIG_DIR=tmp, NMEM_CLI_PATH=str(cli),
            )

            def run_process():
                command = [str(pi), "--mode", "rpc", "--offline", "--no-approve", "--no-skills",
                           "--no-prompt-templates", "--no-themes", "--no-context-files", "--session", str(session)]
                if not args.discover:
                    command += ["--no-extensions", "--extension", str(package / "extensions/nowledge-mem.ts")]
                proc = subprocess.Popen(command, cwd=tmp, env=env, stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                watchdog = threading.Timer(30, proc.kill)
                watchdog.start()

                def receive(identifier):
                    while True:
                        line = proc.stdout.readline()
                        if not line:
                            raise AssertionError("Pi exited before RPC response: " + proc.stderr.read()[-2000:])
                        response = json.loads(line)
                        if response.get("id") == identifier and response.get("type") == "response":
                            assert response.get("success"), response
                            return response

                try:
                    before = len(requests)
                    proc.stdin.write(json.dumps({"type": "get_state", "id": "state"}) + "\n")
                    proc.stdin.flush()
                    state = receive("state")
                    assert state["data"]["sessionId"] == "00000000-0000-4000-8000-000000000030", state
                    proc.stdin.write(json.dumps({"type": "new_session", "id": "switch"}) + "\n")
                    proc.stdin.flush()
                    receive("switch")  # The lifecycle handlers await HTTP completion.
                    assert len(requests) > before, "Pi did not load/capture through the selected extension"
                    assert "INTERNAL" not in json.dumps(requests), "Runtime content leaked into capture"
                    return proc.pid
                finally:
                    watchdog.cancel()
                    proc.terminate()
                    try:
                        proc.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        proc.wait(timeout=10)
                    for stream in (proc.stdin, proc.stdout, proc.stderr):
                        stream.close()

            first_pid = run_process()  # Exited and reaped before the next launch.
            expected = [
                {"role": "user", "content": "Synthetic native question"},
                {"role": "assistant", "content": "Synthetic native answer"},
            ]

            def dialogue():
                return [{"role": message["role"], "content": message["content"]} for message in stored.values()]

            assert dialogue() == expected, dialogue()
            append("user2", "user", [text("Synthetic question after restart")])
            append("call2", "assistant", [{"type": "toolCall", "id": "tool2", "name": "read", "arguments": {"path": "INTERNAL after restart"}}])
            append("result2", "toolResult", [text("INTERNAL output after restart")], toolCallId="tool2", toolName="read", isError=False)
            append("final2", "assistant", [
                {"type": "thinking", "thinking": "INTERNAL thinking after restart"},
                text("Synthetic answer after restart"),
                {"type": "toolCall", "id": "tool3", "name": "read", "arguments": {"path": "INTERNAL mixed call"}},
            ])
            second_pid = run_process()
            assert first_pid != second_pid
            expected += [
                {"role": "user", "content": "Synthetic question after restart"},
                {"role": "assistant", "content": "Synthetic answer after restart"},
            ]
            assert dialogue() == expected, dialogue()
            assert list(stored) == ["pi-entry-user", "pi-entry-final", "pi-entry-user2", "pi-entry-final2"]
            print(json.dumps({
                "native_pi": str(pi), "package_version": json.loads((package / "package.json").read_text())["version"],
                "loading": "package-discovery" if args.discover else "explicit-extension",
                "process_ids": [first_pid, second_pid], "restart_verified": True,
                "captured_messages": len(stored), "internal_content_found": False, "result": "PASS",
            }))
    finally:
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=5)


if __name__ == "__main__":
    main()
