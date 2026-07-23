#!/bin/sh

find_nmem() {
  if [ -n "${NMEM_CLI_PATH:-}" ] && [ -x "$NMEM_CLI_PATH" ]; then
    printf '%s\n' "$NMEM_CLI_PATH"
    return 0
  fi

  if command -v nmem >/dev/null 2>&1; then
    command -v nmem
    return 0
  fi

  for candidate in \
    "$HOME/.local/share/nowledge-mem/bin/nmem-wrapper" \
    "/usr/local/bin/nmem" \
    "$HOME/.local/bin/nmem" \
    "/opt/homebrew/bin/nmem" \
    "/usr/bin/nmem"
  do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

nmem_bin="$(find_nmem)" || {
  echo "nmem is not installed. In Nowledge Mem, open Settings > Preferences > Developer Tools and install or repair the CLI." >&2
  exit 127
}

exec "$nmem_bin" "$@"
