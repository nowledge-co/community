"""Run shipped hook entrypoints with the interpreter selected by the host/CI."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


PLUGIN = Path(__file__).resolve().parents[1]


class PythonRuntimeTests(unittest.TestCase):
    def run_python(self, script, env, cwd, *args):
        result = subprocess.run(
            [sys.executable, str(script), *args],
            input="{}",
            text=True,
            capture_output=True,
            env=env,
            cwd=cwd,
            timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def check_hook(self, installed):
        with tempfile.TemporaryDirectory(prefix="copilot-python-runtime-") as owned:
            root = Path(owned)
            profile = root / "profile with spaces"
            env = dict(os.environ, COPILOT_HOME=str(profile))
            if installed:
                self.run_python(PLUGIN / "scripts" / "install_hooks.py", env, root)
                hook = profile / "nowledge-mem-hooks" / "copilot-hook.py"
            else:
                hook = PLUGIN / "hooks" / "copilot-hook.py"
            self.run_python(hook, env, root, "--event", "stop")
            # The installer may create the directory, but no session state is saved.
            state = profile / "nowledge-mem-hooks" / "state"
            self.assertEqual(list(state.iterdir()) if state.exists() else [], [])

    def test_packaged_stop_hook_starts(self):
        self.check_hook(installed=False)

    def test_installed_stop_hook_starts(self):
        self.check_hook(installed=True)


if __name__ == "__main__":
    unittest.main()
