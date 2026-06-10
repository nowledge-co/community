"""Empirical proof that the Windows ``.cmd`` launcher neutralizes cmd.exe
metacharacter injection (BatBadBut / CVE-2024-1874 class).

WHY THIS TEST EXISTS
--------------------
``shutil.which("nmem")`` resolves on Windows to ``nmem.CMD`` -- nmem ships only a
batch shim, no native ``.exe``. The shim's last line forwards every argument to a
bundled python::

    "%PYTHON%" -m nowledge_graph_server.ncli %*

Python's ``subprocess`` runs a ``.cmd`` through ``cmd.exe``, whose metacharacter
parsing (``& | < > ^ "``) is NOT neutralized by list-form quoting. Proven live on
a real Windows box: ``subprocess.run([nmem_cmd, "a&b"])`` makes cmd.exe execute
``b`` as a separate command. nmem arguments are user/model-controlled (memory
content, search queries, titles, labels, ids) and routinely contain these
characters, so the old list form both corrupted ordinary content and was a
command-injection vector. ``client._build_cmd_command`` closes it.

ORACLE CHOICE (read before editing the fixture)
-----------------------------------------------
The faithful fixture forwards ``%*`` to a tiny python argv printer, because that
is EXACTLY what the real ``nmem.CMD`` does -- one command line parsed twice (once
by cmd.exe, once by the C runtime building ``sys.argv``).

A fixture that instead does ``echo ARG=[%~1]`` is a BROKEN oracle: ``%~1`` strips
the quotes and then ``echo`` RE-PARSES the now-bare metacharacters, so
``echo ARG=[a&b]`` makes cmd run ``b]`` as a command. That re-parse is an artifact
of ``echo``; the real shim never echoes arguments, it forwards them to a program.
We therefore only assert against the production-shaped forwarding oracle.
"""
from __future__ import annotations

import importlib.util
import ntpath
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


def _load_client_module():
    plugin_dir = Path(__file__).resolve().parents[1]
    package_name = "nowledge_mem_hermes_windows_batch"
    if package_name not in sys.modules:
        package = type(sys)(package_name)
        package.__path__ = [str(plugin_dir)]
        sys.modules[package_name] = package
    spec = importlib.util.spec_from_file_location(
        f"{package_name}.client",
        plugin_dir / "client.py",
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


client_module = _load_client_module()


# The exact battery the task specifies, plus an explicit injection payload.
# %VAR% is intentionally excluded from the verbatim battery: cmd.exe expands it
# before the shim runs. The production batch path rejects env-var-shaped tokens
# before they reach cmd.exe.
ARG_BATTERY = [
    "normal",
    "a&b",
    "a|b",
    "x^y",
    "c:\\a\\b",
    "with space",
    "中文记忆",
    'q"uote',
    "a<b>c",
    "(paren)",
    "z & echo INJECTED",
]

# A separate, unmistakable injection probe. If cmd.exe interprets the ``&`` this
# token would run ``echo`` and emit BATBADBUT_PWNED on its own output line.
INJECTION_ARG = "safe&echo BATBADBUT_PWNED&rem "
INJECTION_MARKER = "BATBADBUT_PWNED"


def _parse_args(stdout: str) -> list[str]:
    """Pull values back out of ``ARG=[...]`` lines, one per received argv token."""
    received = []
    for line in stdout.splitlines():
        line = line.rstrip("\r")
        if line.startswith("ARG=[") and line.endswith("]"):
            received.append(line[len("ARG=[") : -1])
    return received


def _injected_lines(stdout: str) -> list[str]:
    """Any non-empty stdout line that is NOT an ``ARG=[...]`` line.

    The forwarding fixture's argv printer emits *only* ``ARG=[token]`` lines, so
    a line of any other shape can only be the output of a command that cmd.exe
    executed -- i.e. a successful injection. This is a stronger, unambiguous
    injection oracle than substring matching (a metacharacter payload legitimately
    appears verbatim *inside* its own ``ARG=[...]`` line when the fix works)."""
    leaked = []
    for line in stdout.splitlines():
        stripped = line.strip()
        if stripped and not (
            stripped.startswith("ARG=[") and stripped.endswith("]")
        ):
            leaked.append(stripped)
    return leaked


def _write_crlf(path: Path, text_lines: list[str]) -> None:
    path.write_bytes(("\r\n".join(text_lines) + "\r\n").encode("utf-8"))


class _CmdFixtureMixin:
    """Creates a temp ``.cmd`` fixture that emits one ``ARG=[token]`` line per argv."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        tmp = Path(self._tmp.name)

        # Faithful fixture: forward %* to a python argv printer, mirroring the
        # real nmem.CMD line `"%PYTHON%" -m ...ncli %*`. This is the oracle the
        # production code is actually designed for: one command line parsed twice
        # (cmd.exe, then the C runtime building sys.argv), with NO echo re-parse.
        #
        # A naive `echo ARG=[%~1]` fixture would be a BROKEN oracle: %~1 strips
        # the quotes and echo then RE-parses the bare metacharacters, so
        # `echo ARG=[a&b]` runs `b]`. That re-parse is an artifact of echo; the
        # real shim never echoes args, it forwards them to a program. See module
        # docstring.
        #
        # We deliberately do NOT emit `setlocal EnableDelayedExpansion`: the real
        # nmem.CMD does not, and that directive would make cmd.exe expand `!`
        # tokens (so `a!b` -> `ab`). Omitting it keeps the fixture faithful and
        # lets `!`-bearing content round-trip verbatim (asserted below).
        printer = tmp / "print_argv.py"
        printer.write_text(
            "import sys\n"
            "for a in sys.argv[1:]:\n"
            "    sys.stdout.write('ARG=[' + a + ']\\n')\n",
            encoding="utf-8",
        )
        self.forward_cmd = tmp / "echoargs.cmd"
        _write_crlf(
            self.forward_cmd,
            [
                "@echo off",
                f'"{sys.executable}" -X utf8 "{printer}" %*',
            ],
        )

    def _drive(self, cmd_path: Path, args: list[str]):
        """Route args through the production helper, pointed at the fixture."""
        original = client_module._resolve_nmem
        client_module._resolve_nmem = lambda: str(cmd_path)
        try:
            # _build_cmd_command is the exact string the production batch path
            # hands to subprocess.run(shell=False); drive it end to end.
            command = client_module._build_cmd_command([str(cmd_path), *args])
            return subprocess.run(
                command,
                shell=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=30,
            )
        finally:
            client_module._resolve_nmem = original


@unittest.skipUnless(os.name == "nt", "cmd.exe batch quoting is Windows-only")
class WindowsBatchArgRoundTripTests(_CmdFixtureMixin, unittest.TestCase):
    def test_every_argument_round_trips_verbatim(self):
        result = self._drive(self.forward_cmd, ARG_BATTERY)
        self.assertEqual(
            result.returncode,
            0,
            msg=f"fixture exited nonzero; stderr={result.stderr!r}",
        )
        received = _parse_args(result.stdout)
        self.assertEqual(
            received,
            ARG_BATTERY,
            msg=(
                "argument corrupted crossing cmd.exe + MSVCRT.\n"
                f"stdout={result.stdout!r}\nstderr={result.stderr!r}"
            ),
        )

    def test_each_argument_individually_round_trips(self):
        # Isolate each token so a single failure is unambiguous.
        for arg in ARG_BATTERY:
            with self.subTest(arg=arg):
                result = self._drive(self.forward_cmd, [arg])
                received = _parse_args(result.stdout)
                self.assertEqual(
                    received,
                    [arg],
                    msg=f"stdout={result.stdout!r} stderr={result.stderr!r}",
                )

    def test_delayed_expansion_bang_content_round_trips(self):
        # `!` is only special when a shim enables delayed expansion; the real
        # nmem.CMD does not, so memory content with bangs must survive intact.
        # (This would regress to `ab` / an expanded var if the fixture or a real
        # shim turned on EnableDelayedExpansion.)
        for arg in ["a!b", "a!!b", "ping !PATH! pong", "100%! done"]:
            with self.subTest(arg=arg):
                received = _parse_args(self._drive(self.forward_cmd, [arg]).stdout)
                self.assertEqual(received, [arg])

    def test_no_command_injection_on_forwarding_shim(self):
        result = self._drive(self.forward_cmd, [INJECTION_ARG])
        # The whole payload must arrive as exactly one literal argv token...
        received = _parse_args(result.stdout)
        self.assertEqual(received, [INJECTION_ARG])
        # ...so the marker appears ONLY inside that ARG=[...] line, never as the
        # output of an executed `echo`. Any non-ARG line would be injected output.
        self.assertEqual(
            _injected_lines(result.stdout),
            [],
            msg=f"command injection leaked output: {result.stdout!r}",
        )
        self.assertNotIn(
            INJECTION_MARKER,
            result.stderr,
            msg=f"injected command ran (stderr): {result.stderr!r}",
        )

    def test_injection_arg_inside_full_battery_does_not_execute(self):
        battery = [*ARG_BATTERY, INJECTION_ARG]
        result = self._drive(self.forward_cmd, battery)
        received = _parse_args(result.stdout)
        self.assertEqual(received, battery)
        # The printer emits only ARG=[...] lines; a line of any other shape could
        # only come from a command cmd.exe executed. There must be none.
        self.assertEqual(
            _injected_lines(result.stdout),
            [],
            msg=f"command injection executed: {result.stdout!r}",
        )

    def test_old_list_form_was_vulnerable_new_form_is_not(self):
        """Regression guard: prove the bug was real and the fix closes it.

        ``a&b`` has no spaces, so ``subprocess.list2cmdline`` leaves it BARE on the
        command line -- cmd.exe then splits on ``&`` and runs ``b`` as a command.
        The old code (``subprocess.run([exe, *args])``) did exactly this. The new
        batch path quotes every token, so the same argument arrives intact. If a
        future change reverts to the list form, the first assertion fails loudly."""
        # Old, buggy path: plain list form straight to subprocess (what we fixed).
        old = subprocess.run(
            [str(self.forward_cmd), "a&b"],
            shell=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
        )
        old_args = _parse_args(old.stdout)
        # cmd.exe ate the `&`: the program saw only `a`, and `b` ran separately.
        self.assertEqual(
            old_args,
            ["a"],
            msg=f"expected the old form to corrupt a&b; stdout={old.stdout!r}",
        )

        # New, hardened path through the production helper: argument intact.
        new = self._drive(self.forward_cmd, ["a&b"])
        self.assertEqual(_parse_args(new.stdout), ["a&b"])
        self.assertEqual(_injected_lines(new.stdout), [])

    def test_literal_percent_text_without_env_shape_round_trips(self):
        # Ordinary percent text should not be mangled. Only %NAME%-style tokens
        # are blocked because cmd.exe expands them before the shim runs.
        for arg in ["100% done", "50% + 50% = 100%", "%not closed"]:
            with self.subTest(arg=arg):
                result = self._drive(self.forward_cmd, [arg])
                self.assertEqual(_parse_args(result.stdout), [arg])
                self.assertEqual(_injected_lines(result.stdout), [])

    def test_percent_var_reference_is_rejected_before_cmd(self):
        with self.assertRaisesRegex(ValueError, "%VAR%-style"):
            self._drive(self.forward_cmd, ["%NMEM_TEST_EVIL%"])

    def test_run_nmem_production_path_routes_through_safe_batch(self):
        # FIX 3 -- exercise the REAL production entry point, not just the builder.
        # _run_nmem inspects argv[0]; because the fixture path ends in `.cmd` it
        # routes through the hardened cmd.exe string path. A regression that sent
        # .cmd back to plain list-form subprocess.run([...]) would corrupt these
        # metacharacter args (and could inject) -- this catches that end to end.
        result = client_module._run_nmem(
            [str(self.forward_cmd), "a&b", "x|y", "中文"],
            timeout=15,
        )
        self.assertEqual(result.returncode, 0, msg=f"stderr={result.stderr!r}")
        self.assertEqual(
            _parse_args(result.stdout),
            ["a&b", "x|y", "中文"],
            msg=f"args corrupted via _run_nmem: stdout={result.stdout!r}",
        )
        self.assertEqual(
            _injected_lines(result.stdout),
            [],
            msg=f"_run_nmem leaked injected output: {result.stdout!r}",
        )


class BuildCmdCommandStringTests(unittest.TestCase):
    """OS-independent coverage of the escaping algorithm. These assert the exact
    generated command STRING so the logic is verified even on Linux/macOS CI,
    where the Windows round-trip tests above skip."""

    def test_is_batch_detects_only_cmd_and_bat(self):
        self.assertTrue(client_module._is_batch("nmem.CMD"))
        self.assertTrue(client_module._is_batch("nmem.cmd"))
        self.assertTrue(client_module._is_batch("nmem.bat"))
        self.assertTrue(client_module._is_batch("nmem.BAT"))
        self.assertFalse(client_module._is_batch("nmem"))
        self.assertFalse(client_module._is_batch("nmem.exe"))
        self.assertFalse(client_module._is_batch("/usr/local/bin/nmem"))

    def test_force_quotes_every_token_including_plain_ones(self):
        # Plain tokens are still quoted so cmd.exe never sees a bare metachar.
        self.assertEqual(client_module._quote_cmd_arg("normal"), '"normal"')
        self.assertEqual(client_module._quote_cmd_arg("a&b"), '"a&b"')
        self.assertEqual(client_module._quote_cmd_arg(""), '""')

    def test_embedded_quote_becomes_doubled_quote(self):
        # q"uote -> "q""uote"  (literal to cmd, collapses to one " under MSVCRT)
        self.assertEqual(client_module._quote_cmd_arg('q"uote'), '"q""uote"')

    def test_backslash_rules_match_msvcrt(self):
        # Backslashes are literal unless they precede a quote / the closing quote.
        self.assertEqual(client_module._quote_cmd_arg("c:\\a\\b"), '"c:\\a\\b"')
        # One backslash before a quote: doubled, then the quote becomes "".
        self.assertEqual(client_module._quote_cmd_arg('a\\"b'), '"a\\\\""b"')
        # Trailing backslashes are doubled so they don't escape the closing quote.
        self.assertEqual(client_module._quote_cmd_arg("end\\"), '"end\\\\"')

    def test_full_command_line_shape(self):
        command = client_module._build_cmd_command(["nmem.CMD", "a&b", "x"])
        # The leading token is the command processor resolved by absolute path
        # (FIX 1: never the bare name `cmd.exe`, which CreateProcess would resolve
        # via the search path / current directory). It is quoted with the same
        # escaper as the args. The /d /s /c switches and that comspec token sit
        # OUTSIDE the outer "..." pair that /s strips off the inner argv line.
        prefix = client_module._quote_cmd_arg(client_module._comspec())
        self.assertEqual(command, prefix + ' /d /s /c ""nmem.CMD" "a&b" "x""')

    def test_command_processor_is_absolute(self):
        # FIX 1: launching by absolute path is what denies CreateProcess any
        # PATH / current-directory resolution of cmd.exe.
        comspec = client_module._comspec()
        self.assertTrue(
            ntpath.isabs(comspec),
            msg=f"comspec must be absolute, got {comspec!r}",
        )
        self.assertTrue(comspec.lower().endswith("cmd.exe"))
        self.assertEqual(
            client_module._build_cmd_command(["nmem.CMD"]).split(" /d /s /c ")[0],
            client_module._quote_cmd_arg(comspec),
        )

    def test_command_line_for_spec_battery(self):
        # Lock down the exact escaped string for the documented battery so any
        # future drift in the algorithm is caught on every platform. The comspec
        # prefix is environment-derived, so compute it rather than hard-coding.
        command = client_module._build_cmd_command(["nmem.CMD", *ARG_BATTERY])
        expected = (
            client_module._quote_cmd_arg(client_module._comspec())
            + ' /d /s /c '
            '""nmem.CMD" "normal" "a&b" "a|b" "x^y" "c:\\a\\b" "with space" '
            '"中文记忆" "q""uote" "a<b>c" "(paren)" "z & echo INJECTED""'
        )
        self.assertEqual(command, expected)


if __name__ == "__main__":
    unittest.main()
