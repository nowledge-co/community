"""Require a new version whenever a PR changes the installed Codex bundle."""

import argparse
import json
from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
BUNDLE = "nowledge-mem-codex-plugin"
MANIFEST = f"{BUNDLE}/.codex-plugin/plugin.json"


def check_versions(base: str, head: str, root: Path = ROOT) -> None:
    for revision in (base, head):
        if not re.fullmatch(r"[0-9a-f]{40}", revision):
            raise ValueError("Bundle checks require full commit SHAs")
    merge_base = subprocess.check_output(
        ["git", "merge-base", base, head], cwd=root, text=True
    ).strip()
    changed = subprocess.check_output(
        ["git", "diff", "--name-only", merge_base, head, "--", BUNDLE], cwd=root
    )
    if not changed:
        return
    versions = []
    for revision in (base, head):
        manifest = json.loads(subprocess.check_output(
            ["git", "show", f"{revision}:{MANIFEST}"], cwd=root
        ))
        version = manifest["version"]
        if not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+", version):
            raise ValueError("Codex bundle versions must use stable X.Y.Z")
        versions.append(tuple(int(part) for part in version.split(".")))
    if versions[1] <= versions[0]:
        raise ValueError(
            "Codex bundle changed without a version increase. Bump plugin.json, "
            "integrations.json and active release assertions, including for docs, "
            "skills and tests shipped inside the plugin directory."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base")
    parser.add_argument("head")
    arguments = parser.parse_args()
    try:
        check_versions(arguments.base, arguments.head)
    except (ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"error: {error}\n")
    print("Codex bundle version contract satisfied")
