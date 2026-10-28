# Cherry Studio → Nowledge Mem

Automatically keep original Cherry Studio conversations as Threads in Nowledge
Mem. This opt-in companion runs **on the machine running Cherry Studio**. Your
Mem endpoint can be on the same machine, on another computer through Access
Anywhere / Nowledge Link, or at Nowledge Cloud. It uses your configured `nmem`
connection; it does not need a local Mem App.

This is a foreground companion, not a Cherry Studio plugin SDK. Cherry Studio
2.1.8 already includes a Nowledge Mem MCP preset. MCP provides tools to the model;
connecting it alone does **not** authorize or enable conversation synchronization.
You can use MCP and this companion independently.

## Requirements

- Cherry Studio **2.1.8**, the latest release validated against official source.
  Older 1.x IndexedDB storage is not supported. Other 2.x schemas are not promised.
- Python 3.10+ and an installed, configured native `nmem` CLI on this machine.
- A CLI reader that supports **both ordinary `topic/message` chats and Agent
  `agent_session/agent_session_message` sessions**. The older Agent-only reader
  is insufficient. The companion refuses to apply when preview omits ordinary
  chats it can see. Until a containing CLI release ships, use a reviewed build
  containing the ordinary-chat reader; installing this package does not upgrade
  the CLI or imply that such a release has shipped.
- Write access to the intended destination and Space. Check `nmem status` first.
  Configure the remote URL/key using the CLI's existing connection workflow;
  do not place credentials in this package, command arguments or issue reports.

## Install and preview

```sh
python3 -m pip install 'git+https://github.com/nowledge-co/community.git#subdirectory=nowledge-mem-cherry-studio'
nowledge-mem-cherry-studio --version
```

Choose the exact database belonging to the Cherry profile you want to sync.
Find your data directory in Cherry Studio's settings; select its
`Data/cherrystudio.sqlite` file. A common macOS default is
`~/Library/Application Support/CherryStudio/Data/cherrystudio.sqlite`; Windows
and Linux, portable installs, and custom data directories differ. Do not guess
another user's profile or pass a network share. Cherry Studio may remain open:
the native reader uses a read-only consistent SQLite view, including live WAL.

```sh
# No upload: inspect whether this exact source is readable.
nowledge-mem-cherry-studio --database '/absolute/path/Data/cherrystudio.sqlite'

# Upload once, with an explicit exact destination Space ID.
nowledge-mem-cherry-studio --database '/absolute/path/Data/cherrystudio.sqlite' --space-id 'YOUR_SPACE_ID' --apply

# Keep observing in this terminal; Ctrl-C stops future uploads.
nowledge-mem-cherry-studio --database '/absolute/path/Data/cherrystudio.sqlite' --space-id 'YOUR_SPACE_ID' --watch --apply
```

After a successful apply, open Threads in the configured Mem workspace and find
the Cherry conversation by its title. Complete another reply in Cherry and check
that it appears in the same Thread; an alternate branch should appear separately.
The terminal should report `synced`, not `retrying` or `failed`.

`--apply` consents to importing **existing history as well as future replies**
from the selected database. There is no topic allowlist or future-only mode in
0.1.0. Do not enable it if that scope is inappropriate. If `--space-id` is omitted,
the CLI's existing configured Space/default rules apply; this does not switch a
personal conversation into a shared Team Space automatically. Choose the exact
Space deliberately before uploading. No automatic startup service is installed.

## What is synchronized

- Original successful user and assistant text, in order, with stable identities.
  Reasoning blocks, tool internals, attachment bytes and model-written summaries
  are not substituted for the originals. Multimodal-only turns may have no text.
- For ordinary chats, only the **currently selected branch** is read. A selected
  alternate branch becomes a separate stable Thread; later replies extend it.
  Switching back does not concatenate alternatives. An unselected branch is not
  proactively uploaded. Invalid, deleted or pending ancestry is refused and
  retried rather than guessed.
- Active Agent conversation identities remain compatible with earlier `nmem`
  imports. Trashed sessions and internal background sessions are excluded when
  those visibility columns are present. This does not create a parallel identity
  scheme or delete earlier imports of those sessions.

The database and its `-wal` are observed every 15 seconds. Changed sources trigger
native full-session reconciliation; unchanged sources are reconciled every five
minutes. This is **not** a constant-cost delta scanner: large histories incur
repeated parsing and deduplicating network writes. `--interval`,
`--reconcile-interval` and `--timeout` accept 5–3600 seconds. Increase the
reconciliation interval for large histories. A second watcher for the same
source/configuration/destination is refused.

## Safety and recovery

The companion does not modify Cherry's messages. It passes source selection,
authentication and Space handling to native `nmem`, and acknowledges an
observation only after an applied receipt with no failures. Failed uploads are
retried; stable native/server identities make replay safe. Changes during an
upload remain eligible on the next observation. No separate persistent cursor
can skip an unacknowledged reply.

Each preview/apply pair uses an opaque private snapshot of the CLI configuration,
removed when the operation finishes. This avoids a connection change between
the two child processes. The supported `NMEM_CLI_CONFIG_DIR` override is honored.
Changing the original profile while a watcher runs pauses uploads: stop, review
the new destination, preview and restart. Environment overrides are inherited.
Keep the CLI executable and its parent directories trusted.

Output contains counts and static error messages, not transcript text, keys or
raw CLI errors. Child output is held in private temporary files and discarded.
The watcher lock contains no credential or source path. Stopping the watcher
does not delete already imported Threads; deleting a Cherry chat does not delete
its previously saved Mem copy. This is import, not bidirectional replication.

`retrying` means an observation was not acknowledged, not that nothing else was
imported in that batch. A permanently invalid topic requires repairing or
excluding it at the source before the whole batch can report success. An empty
database may report no readable sessions until a conversation is completed.
If the CLI is too old, update it before retrying; never disable the compatibility
check to force an apparently successful sync.
If the database changes during a compatibility check, the companion instead
reports a source-change retry. Let the current Cherry turn finish; this is not
evidence that the CLI needs an update. Empty WAL sidecars created by SQLite
readers do not count as new conversation data.

## Development

```sh
python3 -m unittest discover -s nowledge-mem-cherry-studio/tests -v
python3 -m unittest discover -s tests/guidance -v
python3 -m pip wheel --no-deps ./nowledge-mem-cherry-studio
# Optional synthetic HTTP contract smoke using a reviewed native build:
python3 nowledge-mem-cherry-studio/tests/native_smoke.py --nmem /absolute/path/to/nmem
```

Tests use disposable synthetic databases, not your existing conversation data.
CI runs the companion tests on Linux, macOS and Windows. A production Cloud or
real-user profile smoke is a separate acceptance boundary, not implied by unit
tests or a packaging build. The initial distribution is this repository's Git
install; there is no promised PyPI or Cherry marketplace release channel.
