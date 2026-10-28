import argparse
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import nowledge_mem_cherry_studio as sync


def receipt(apply=False, action="ready", **changes):
    value = {"status": "success", "failed": 0, "apply": apply,
             "results": [{"session_id": "session-1", "action": action}], "created": 1, "appended": 0}
    value.update(changes)
    return value


class CompanionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.database = Path(self.temp.name) / "cherrystudio.sqlite"
        conn = sqlite3.connect(self.database)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("CREATE TABLE agent_session(id TEXT)")
        conn.commit()
        conn.close()
        self.args = argparse.Namespace(database=self.database, nmem="nmem", space_id="exact-space",
                                       apply=False, watch=False, timeout=120, interval=15, reconcile_interval=300)
        self.environment = patch.dict(os.environ, {"NMEM_CLI_CONFIG_DIR": str(Path(self.temp.name) / "profile")})
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_preview_never_applies_and_preserves_exact_scope_and_path(self):
        with patch.object(sync, "invoke", return_value=receipt()) as call:
            self.assertEqual(sync.sync_once(self.args)["uploaded"], False)
        command = call.call_args.args[0]
        self.assertNotIn("--apply", command)
        self.assertEqual(command[-2:], ["--space-id", "exact-space"])
        self.assertEqual(command[command.index("--session-dir") + 1], str(self.database))
        self.args.space_id = ""
        with patch.object(sync, "invoke", return_value=receipt()) as call:
            sync.sync_once(self.args)
        self.assertEqual(call.call_args.args[0][-2:], ["--space-id", ""])

    def test_apply_requires_both_preview_and_an_applied_acknowledgement(self):
        self.args.apply = True
        with patch.object(sync, "invoke", side_effect=[receipt(), receipt(True, "created")]) as call:
            self.assertEqual(sync.sync_once(self.args)["status"], "synced")
        self.assertEqual(call.call_count, 2)
        self.assertEqual(call.call_args.args[0][-1], "--apply")
        for bad in [receipt(), receipt(True, "failed"), receipt(True, "skipped"), receipt(True, results=[])]:
            with self.subTest(bad=bad), patch.object(sync, "invoke", side_effect=[receipt(), bad]):
                with self.assertRaises(sync.SyncError):
                    sync.sync_once(self.args)

    def test_ordinary_topic_compatibility_gate_prevents_silent_agent_only_sync(self):
        conn = sqlite3.connect(self.database)
        conn.executescript("CREATE TABLE topic(id TEXT,active_node_id TEXT,deleted_at INTEGER);"
                           "CREATE TABLE message(topic_id TEXT,role TEXT,status TEXT,deleted_at INTEGER);"
                           "INSERT INTO topic VALUES('chat','a',NULL);"
                           "INSERT INTO message VALUES('chat','user','success',NULL);"
                           "INSERT INTO message VALUES('chat','assistant','success',NULL);")
        conn.close()
        self.args.apply = True
        with patch.object(sync, "invoke", return_value=receipt()) as call:
            with self.assertRaisesRegex(sync.SyncError, "ordinary Cherry chats"):
                sync.sync_once(self.args)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(sync.required_topics(self.database), {"topic:chat"})

    def test_live_wal_fingerprint_sees_uncheckpointed_changes(self):
        conn = sqlite3.connect(self.database)
        conn.execute("PRAGMA wal_autocheckpoint=0")
        before = sync.fingerprint(self.database)
        conn.execute("INSERT INTO agent_session VALUES('new')")
        conn.commit()
        self.assertNotEqual(sync.fingerprint(self.database), before)
        conn.close()

    def test_empty_reader_wal_sidecar_is_not_a_conversation_change(self):
        before = sync.fingerprint(self.database)
        wal = Path(str(self.database) + "-wal")
        wal.write_bytes(b"\0" * 32)
        self.assertEqual(sync.fingerprint(self.database), before)
        wal.write_bytes(b"\0" * 33)
        self.assertNotEqual(sync.fingerprint(self.database), before)

    def test_legacy_reader_cannot_apply_trashed_or_background_agent_sessions(self):
        conn = sqlite3.connect(self.database)
        conn.executescript("ALTER TABLE agent_session ADD COLUMN type TEXT;"
                           "ALTER TABLE agent_session ADD COLUMN deleted_at INTEGER;"
                           "INSERT INTO agent_session VALUES('session-1','background',NULL);"
                           "INSERT INTO agent_session VALUES('trash','conversation',1);"
                           "INSERT INTO agent_session VALUES('visible','conversation',NULL);")
        conn.close()
        self.assertEqual(sync.forbidden_agent_sessions(self.database), {"session-1", "trash"})
        self.args.apply = True
        with patch.object(sync, "invoke", return_value=receipt()) as call:
            with self.assertRaisesRegex(sync.SyncError, "trash or internal"):
                sync.sync_once(self.args)
        self.assertEqual(call.call_count, 1)

    def test_source_change_during_compatibility_check_is_not_an_upgrade_error(self):
        self.args.apply = True
        for required, forbidden in [({"topic:new"}, set()), (set(), {"session-1"})]:
            with self.subTest(required=required), patch.object(sync, "required_topics", return_value=required), patch.object(sync, "forbidden_agent_sessions", return_value=forbidden), patch.object(sync, "fingerprint", side_effect=[(1,), (2,)]), patch.object(sync, "invoke", return_value=receipt()) as call:
                with self.assertRaisesRegex(sync.SyncError, "changed while checking"):
                    sync.sync_once(self.args)
            self.assertEqual(call.call_count, 1)

    def test_profile_change_between_preview_and_apply_does_not_upload(self):
        self.args.apply = True
        with patch.object(sync, "profile_stamp", side_effect=["old", "old", "old", "new"]), patch.object(sync, "invoke", return_value=receipt()) as call:
            with self.assertRaises(sync.SyncError):
                sync.sync_once(self.args)
        self.assertEqual(call.call_count, 1)

    def test_real_overridden_profile_change_is_detected(self):
        config = Path(self.temp.name) / "config.json"
        with patch.dict(os.environ, {"NMEM_CLI_CONFIG_DIR": self.temp.name}):
            config.write_text('{"apiUrl":"http://127.0.0.1:8001"}')
            before = sync.profile_stamp()
            config.write_text('{"apiUrl":"http://127.0.0.1:80022"}')
            self.assertNotEqual(sync.profile_stamp(), before)

    def test_children_keep_immutable_profile_after_original_is_replaced(self):
        config = sync.config_directory() / "config.json"
        config.parent.mkdir()
        config.write_text('{"apiUrl":"http://127.0.0.1:8001","space_id":"first"}')
        with sync.pinned_profile() as env:
            pinned = Path(env["NMEM_CLI_CONFIG_DIR"]) / "config.json"
            config.write_text('{"apiUrl":"http://127.0.0.1:8002","space_id":"other"}')
            script = [sys.executable, "-c", "import os,pathlib; print((pathlib.Path(os.environ['NMEM_CLI_CONFIG_DIR'])/'config.json').read_text())"]
            result = __import__("subprocess").run(script, env=env, capture_output=True, text=True, check=True)
            self.assertEqual(json.loads(result.stdout)["space_id"], "first")
            self.assertEqual(json.loads(pinned.read_text())["apiUrl"], "http://127.0.0.1:8001")
        self.assertFalse(pinned.exists())

    def test_profile_change_after_watch_check_cannot_rebind_the_upload(self):
        config = sync.config_directory() / "config.json"
        config.parent.mkdir()
        config.write_text('{"apiUrl":"http://127.0.0.1:8001"}')
        self.args.apply = True
        def change_profile(_):
            config.write_text('{"apiUrl":"http://127.0.0.1:80022"}')
            return (1,)
        with patch.object(sync, "fingerprint", side_effect=change_profile), patch.object(sync, "invoke", side_effect=[receipt(), receipt(True, "created")]) as call, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(sync.run(self.args), 1)
        call.assert_not_called()

    def test_failed_observation_retries_without_advancing_progress(self):
        self.args.watch = True
        snapshots = [(1,), (1,), (1,)]
        def tick(_):
            if run.call_count == 2:
                raise KeyboardInterrupt
        with patch.object(sync, "fingerprint", side_effect=snapshots), patch.object(sync, "sync_once", side_effect=[sync.SyncError("failed"), {"status":"synced"}]) as run, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(KeyboardInterrupt):
                sync.run(self.args, sleep=tick, clock=lambda: 0)
        self.assertEqual(run.call_count, 2)

    def test_change_during_sync_is_not_acknowledged_by_later_fingerprint(self):
        self.args.watch = True
        def tick(_):
            if run.call_count == 2:
                raise KeyboardInterrupt
        with patch.object(sync, "fingerprint", side_effect=[(1,), (2,)]), patch.object(sync, "sync_once", return_value={"status":"synced"}) as run, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(KeyboardInterrupt):
                sync.run(self.args, sleep=tick, clock=lambda: 0)
        self.assertEqual(run.call_count, 2)

    def test_unchanged_database_uses_periodic_reconciliation_not_every_tick(self):
        self.args.watch = True
        ticks = iter([0, 20, 301, 301])
        calls = 0
        def tick(_):
            nonlocal calls
            calls += 1
            if calls == 3:
                raise KeyboardInterrupt
        with patch.object(sync, "fingerprint", return_value=(1,)), patch.object(sync, "sync_once", return_value={"status":"synced"}) as run, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(KeyboardInterrupt):
                sync.run(self.args, sleep=tick, clock=lambda: next(ticks))
        self.assertEqual(run.call_count, 2)

    def test_owner_lock_is_exclusive_and_contains_no_credentials(self):
        with sync.single_owner(self.args):
            with self.assertRaises(sync.SyncError):
                with sync.single_owner(self.args):
                    self.fail("duplicate owner")
        with sync.single_owner(self.args):
            pass
        for path in Path(self.temp.name).rglob("*.lock"):
            self.assertIn(path.read_bytes(), [b"", b"0"])

    def test_paths_and_polling_limits_fail_closed(self):
        for raw in ["", "//server/share", "\\\\server\\share"]:
            with self.assertRaises(argparse.ArgumentTypeError):
                sync.local_database(raw)
        for raw in ["nan", "inf", "-1", "0", "3601"]:
            with self.assertRaises(argparse.ArgumentTypeError):
                sync.bounded_seconds(raw)

    def test_actual_child_receipts_are_checked_and_never_echoed(self):
        script = Path(self.temp.name) / "child.py"
        for body in [receipt(), receipt(failed=1), {"error":"secret-token"}, receipt(failed=False)]:
            script.write_text("import json; print(" + repr(json.dumps(body)) + ")", encoding="utf-8")
            if type(body.get("failed")) is int and body == receipt():
                self.assertEqual(sync.invoke([sys.executable, str(script)], 5), body)
            else:
                with self.assertRaises(sync.SyncError) as error:
                    sync.invoke([sys.executable, str(script)], 5)
                self.assertNotIn("secret-token", str(error.exception))

    def test_main_requires_explicit_upload_opt_in_for_watch(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            sync.main(["--database", str(self.database), "--watch"])


if __name__ == "__main__":
    unittest.main()
