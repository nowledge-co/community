#!/usr/bin/env bash
# Optional compatibility runtime. Native marketplace installs use packaged hooks.
set -euo pipefail
exec python3 -c 'import pathlib,runpy,sys; runpy.run_path(str(pathlib.Path(sys.argv[1]).resolve().with_name("install_hooks.py")), run_name="__main__")' "${BASH_SOURCE[0]}"
