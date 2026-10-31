"""Replay synthetic dialogue across a real Pi process restart into a loopback receiver.

Usage: python3 native-pi-dialogue-smoke.py PI_BINARY PACKAGE_DIR [--discover] [--cindy] [--side]
No model requests, live-config edits or real Mem writes are made. --discover
loads the package through isolated global Pi settings instead of explicit -e.
--cindy replays the verified Cindy wire templates and launcher markers.
--side also seeds inherited fork history and verifies an empty pre-turn flush.
"""
import argparse
import base64
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
    parser.add_argument("--cindy", action="store_true")
    parser.add_argument("--side", action="store_true")
    args = parser.parse_args()
    args.cindy = args.cindy or args.side
    pi, package = args.pi.resolve(), args.package.resolve()
    cindy = json.loads((Path(__file__).parent / "fixtures/cindy-context.json").read_text()) if args.cindy else None
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
            header = {
                "type": "session", "version": 3, "id": "00000000-0000-4000-8000-000000000030",
                "timestamp": timestamp, "cwd": tmp,
            }
            parent_id = "00000000-0000-4000-8000-000000000029"
            if args.side:
                header["parentSession"] = str(root / f"2026-10-29T00-00-00-000Z_{parent_id}.jsonl")
            session.write_text(json.dumps(header) + "\n")

            def append(identifier, role, content, entry_timestamp=timestamp, **extra):
                rows = [json.loads(line) for line in session.read_text().splitlines() if line]
                parent = rows[-1].get("id") if len(rows) > 1 else None
                entry = {"type": "message", "id": identifier, "parentId": parent, "timestamp": entry_timestamp,
                         "message": {"role": role, "content": content, "timestamp": 1793318400000, **extra}}
                with session.open("a") as stream:
                    stream.write(json.dumps(entry) + "\n")

            def text(value):
                return {"type": "text", "text": value}

            if args.side:
                for identifier, role in [("parent-u", "user"), ("parent-progress1", "assistant"),
                                         ("parent-progress2", "assistant"), ("parent-a", "assistant")]:
                    append(identifier, role, [text("INHERITED " + identifier)], entry_timestamp="2026-10-29T00:00:00Z")
                target = {"thread_id": "synthetic-parent-thread", "thread_storage_id": "synthetic-parent-storage",
                          "space_id": "fixture-only", "connection_id": "fixture-connection"}
                locator = base64.urlsafe_b64encode(json.dumps(target).encode()).decode().rstrip("=")
                with session.open("a") as stream:
                    stream.write(json.dumps({"type": "custom", "id": "parent-binding", "parentId": "parent-a",
                        "timestamp": "2026-10-29T00:00:00Z", "customType": "nowledge-mem-thread-resume-v1",
                        "data": {"locator": locator}}) + "\n")
                rows = session.read_text().splitlines()
                parent_header = {key: value for key, value in header.items() if key != "parentSession"}
                parent_header.update(id=parent_id, timestamp="2026-10-29T00:00:00Z")
                Path(header["parentSession"]).write_text(json.dumps(parent_header) + "\n" + "\n".join(rows[1:]) + "\n")
                inherited_only = session.read_text()
            append("system", "system", [text("INTERNAL system and tools")])
            expected_question = "    Synthetic native question\n    preserve indentation" if cindy else "Synthetic native question"
            first_question = expected_question
            if cindy:
                first_question = "\n\n".join([cindy[part] for part in
                    (("writable", "side", "language", "client", "handoff", "fork", "channel") if args.side
                     else ("writable", "language", "client", "handoff", "channel"))] + [first_question])
            append("user", "user", [text(first_question)])
            append("thinking", "assistant", [{"type": "thinking", "thinking": "INTERNAL thinking"}])
            append("call", "assistant", [{"type": "toolCall", "id": "tool1", "name": "read", "arguments": {"path": "INTERNAL"}}])
            append("result", "toolResult", [text("INTERNAL tool result")], toolCallId="tool1", toolName="read", isError=False)
            append("final", "assistant", [text("Synthetic native answer"), {"type": "thinking", "thinking": "INTERNAL mixed thinking"}])
            append("custom", "custom", "INTERNAL injected context", customType="fixture-context", display=True)
            if cindy:
                append("internal-user", "user", [text(cindy["language"])])
            env = dict(
                os.environ, PI_CODING_AGENT_DIR=str(agent), PI_OFFLINE="1", NMEM_PLUGIN_SOURCE_APP="pi",
                NMEM_PLUGIN_DEBUG="1", NMEM_API_URL=f"http://127.0.0.1:{server.server_port}",
                NMEM_API_KEY="fixture-only", NMEM_SPACE="fixture-only", NMEM_SPACE_ID="fixture-only",
                NMEM_AGENT_ID="fixture-agent", NMEM_HOST_AGENT_ID="fixture-host",
                NMEM_CLI_CONFIG_DIR=tmp, NMEM_CLI_PATH=str(cli),
                CINDY_PI_SESSION_ID="synthetic-cindy-task" if cindy else "",
                CINDY_PI_PERMISSION_FILE=str(root / "synthetic-permissions.json") if cindy else "",
            )

            def run_process(expect_capture=True):
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
                    if expect_capture:
                        assert len(requests) > before, "Pi did not load/capture through the selected extension"
                    else:
                        assert len(requests) == before, "Fork uploaded inherited dialogue before its first own user turn"
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

            if args.side:
                complete = session.read_text()
                session.write_text(inherited_only)
                run_process(expect_capture=False)
                session.write_text(complete)
            first_pid = run_process()  # Exited and reaped before the next launch.
            expected = [
                {"role": "user", "content": expected_question},
                {"role": "assistant", "content": "Synthetic native answer"},
            ]

            def dialogue():
                return [{"role": message["role"], "content": message["content"]} for message in stored.values()]

            assert dialogue() == expected, dialogue()
            second_question = "Synthetic question after restart"
            if cindy:
                second_question = cindy["rebuild"] + "\n\n" + cindy["channel"] + "\n\n" + second_question
            append("user2", "user", [text(second_question)])
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
            if cindy:
                for message in stored.values():
                    if message["role"] == "user":
                        assert message["metadata"]["cindy_origin"] == {"channel": "wechat", "chat_kind": "direct"}
                encoded = json.dumps(requests)
                assert all(marker not in encoded for marker in [
                    "[UI language]", "[Session handoff", "[Session context rebuild", "cindy-extra-",
                    "[Side chat context]", "[Session fork", "INHERITED",
                    "nowledge-mem-thread-resume-v1", "synthetic-parent-thread",
                    "synthetic-chat", "synthetic-controller", "synthetic-host",
                ]), "Cindy runtime notes or transport identifiers leaked"
            if args.side:
                assert requests[0]["body"]["metadata"]["pi_parent_session_id"] == parent_id
                assert requests[0]["body"]["metadata"]["pi_side_session"] is True
            print(json.dumps({
                "native_pi": str(pi), "package_version": json.loads((package / "package.json").read_text())["version"],
                "loading": "package-discovery" if args.discover else "explicit-extension",
                "cindy_wire_templates": bool(cindy),
                "side_session": args.side, "inherited_messages_excluded": 4 if args.side else 0,
                "process_ids": [first_pid, second_pid], "restart_verified": True,
                "captured_messages": len(stored), "internal_content_found": False, "result": "PASS",
            }))
    finally:
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=5)


if __name__ == "__main__":
    main()
