"""Allowlisted release metadata and registry receipts (Python 3.12+, no dependencies)."""
import argparse
import hashlib
import json
import re
import sys
import tomllib
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = {
    "opencode": ("nowledge-mem-opencode-plugin", "opencode-nowledge-mem", "npm"),
    "openclaw": ("nowledge-mem-openclaw-plugin", "@nowledge/openclaw-nowledge-mem", "npm"),
    "pi": ("nowledge-mem-pi-package", "nowledge-mem-pi", "npm"),
    "omp": ("nowledge-mem-omp-plugin", "nowledge-mem-omp", "npm"),
    "step-code": ("nowledge-mem-step-code", "nowledge-mem-step-code", "npm"),
    "bub": ("nowledge-mem-bub-plugin", "nowledge-mem-bub", "pypi"),
    "langgraph": ("nowledge-mem-langgraph", "nowledge-mem-langgraph", "pypi"),
}


def metadata(plugin, version, root=ROOT):
    directory, name, channel = PACKAGES[plugin]
    path = root / directory
    manifest = (
        json.loads((path / "package.json").read_text())
        if channel == "npm"
        else tomllib.loads((path / "pyproject.toml").read_text())["project"]
    )
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version):
        raise ValueError("Only stable X.Y.Z versions may advance latest")
    assert manifest["name"] == name, "Unexpected package identity"
    assert manifest["version"] == version, "Input version differs from package"
    registry = json.loads((root / "integrations.json").read_text())
    entry = next(item for item in registry["integrations"] if item["id"] == plugin)
    assert entry["version"] == version, "Registry version differs from package"
    heading = rf"^## \[?{re.escape(version)}\]?(?:\s|$)"
    assert re.search(heading, (path / "CHANGELOG.md").read_text(), re.M), "Missing release changelog"
    lock = path / "package-lock.json"
    if lock.exists():
        data = json.loads(lock.read_text())
        assert data["version"] == version
        assert data["packages"][""]["version"] == version
    if plugin == "openclaw":
        assert json.loads((path / "openclaw.plugin.json").read_text())["version"] == version
    return directory, name, channel


def remote(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)


def absent(url):
    try:
        remote(url)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return
        raise
    raise RuntimeError("Version already published; never overwrite or skip existing artifacts")


def advances(version, latest):
    assert tuple(map(int, version.split("."))) > tuple(map(int, latest.split("."))), "Release must advance latest, never downgrade it"


def verify_npm(name, version, pack):
    artifact = json.loads(Path(pack).read_text())[0]
    assert (artifact["name"], artifact["version"]) == (name, version)
    assert remote(f"https://registry.npmjs.org/{name}/{version}")["dist"]["integrity"] == artifact["integrity"]
    assert remote(f"https://registry.npmjs.org/{name}/latest")["version"] == version


def verify_pypi(name, version, directory):
    artifacts = list(Path(directory).glob("*.whl")) + list(Path(directory).glob("*.tar.gz"))
    assert len(artifacts) == 2, "Require exactly a wheel and sdist"
    published = remote(f"https://pypi.org/pypi/{name}/{version}/json")
    hashes = {item["filename"]: item["digests"]["sha256"] for item in published["urls"]}
    for artifact in artifacts:
        assert hashes[artifact.name] == hashlib.sha256(artifact.read_bytes()).hexdigest()
    assert remote(f"https://pypi.org/pypi/{name}/json")["info"]["version"] == version


def verify_clawhub(version, files, receipt):
    assert receipt["skill"]["slug"] == "nowledge-mem"
    assert receipt["version"]["version"] == version
    assert receipt["skill"]["tags"]["latest"] == version
    expected = {item["path"]: item["sha256"] for item in files}
    actual = {item["path"]: item["sha256"] for item in receipt["version"]["files"]}
    assert expected == actual, "ClawHub file set or hashes differ from tested source"


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "verify-clawhub":
        _, _, version, pack, receipt = sys.argv
        metadata("openclaw", version)
        verify_clawhub(version, json.loads(Path(pack).read_text()), json.loads(Path(receipt).read_text()))
        print(f"Verified ClawHub nowledge-mem@{version}: exact file hashes and latest")
        return
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["check", "preflight", "verify"])
    parser.add_argument("plugin", choices=PACKAGES)
    parser.add_argument("version")
    parser.add_argument("--artifact")
    args = parser.parse_args()
    directory, name, channel = metadata(args.plugin, args.version)
    if args.operation == "preflight":
        url = f"https://registry.npmjs.org/{name}/{args.version}" if channel == "npm" else f"https://pypi.org/pypi/{name}/{args.version}/json"
        absent(url)
        latest_url = f"https://registry.npmjs.org/{name}/latest" if channel == "npm" else f"https://pypi.org/pypi/{name}/json"
        latest = remote(latest_url)
        advances(args.version, latest["version"] if channel == "npm" else latest["info"]["version"])
    elif args.operation == "verify":
        if not args.artifact:
            parser.error("--artifact is required")
        if channel == "npm":
            verify_npm(name, args.version, args.artifact)
        else:
            verify_pypi(name, args.version, args.artifact)
    print(f"{args.operation}: {name}@{args.version} ({directory})")


if __name__ == "__main__":
    main()
