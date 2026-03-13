"""Windsurf Trajectory Extractor - Command-line interface."""

from __future__ import annotations

import argparse
import binascii
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any

from .extractor import (
    extract_trajectory,
    find_by_keywords,
    find_windsurf_paths,
    list_summaries,
    list_workspaces,
    load_codeium_state,
)


def cmd_list(state: dict[str, Any], ws_storage: Path | None) -> int:
    """List all workspaces with trajectory data.

    Returns:
        Exit code (0 for success, 1 for no data found).
    """
    workspaces = list_workspaces(state, ws_storage)
    if not workspaces:
        print("No trajectories found.", file=sys.stderr)
        return 1

    print(f"{'Size':>10} {'Workspace ID':>36}  {'Project Path'}")
    print("-" * 100)
    for ws in workspaces:
        print(f"{ws['size']:>10}  {ws['id']}  {ws['path']}")
    return 0


def cmd_summaries(state: dict[str, Any], ws_id: str) -> int:
    """List conversation summaries for a workspace.

    Returns:
        Exit code (0 for success, 1 for error).
    """
    try:
        summaries = list_summaries(state, ws_id)
    except KeyError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except (binascii.Error, json.JSONDecodeError) as e:
        print(f"Error decoding data: {e}", file=sys.stderr)
        return 1

    print(f"Conversations: {len(summaries)}")
    print(f"{'#':>3} {'UUID':>40} {'Title'}")
    print("-" * 90)
    for i, s in enumerate(summaries):
        print(f"{i:>3} {s['uuid']:>40} {s['title']}")
    return 0


def cmd_extract(state: dict[str, Any], ws_id: str, output: str | None) -> int:
    """Extract trajectory data.

    Returns:
        Exit code (0 for success, 1 for error).
    """
    try:
        result = extract_trajectory(state, ws_id)
    except KeyError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except (binascii.Error, json.JSONDecodeError) as e:
        print(f"Error decoding data: {e}", file=sys.stderr)
        return 1

    size_mb = result["size_bytes"] / 1024 / 1024
    print(
        f"Trajectory size: {result['size_bytes']} bytes ({size_mb:.1f} MB)",
        file=sys.stderr,
    )
    print(f"Trajectory UUID: {result['trajectory_uuid']}", file=sys.stderr)
    print(f"Steps: {result['statistics']['total_steps']}", file=sys.stderr)

    if output:
        try:
            with open(output, "w", encoding="utf-8") as f:
                for step in result["steps"]:
                    f.write(json.dumps(step, ensure_ascii=False) + "\n")
            print(f"Wrote {len(result['steps'])} steps to {output}", file=sys.stderr)
        except OSError as e:
            print(f"Error writing output file: {e}", file=sys.stderr)
            return 1
    else:
        # Print summary table
        print(f"\n{'Step':>5} {'Type':>5} {'Timestamp':>22} {'Content Preview'}")
        print("-" * 120)
        for s in result["steps"]:
            ts = s["timestamp"][:19] if s["timestamp"] else "?"
            preview = s["content_preview"][:70].replace("\n", " ")
            print(
                f"{s['step_id'] or '?':>5} {s['step_type'] or '?':>5} {ts:>22} {preview}"
            )

    # Statistics
    stats = result["statistics"]
    if "time_range" in stats:
        print(
            f"\nTime range: {stats['time_range']['first']} ~ {stats['time_range']['last']}",
            file=sys.stderr,
        )
    print(
        f"Total: {stats['total_steps']}, "
        f"with timestamp: {stats['steps_with_timestamp']}, "
        f"with thinking: {stats['steps_with_thinking']}",
        file=sys.stderr,
    )
    return 0


def cmd_find(
    state: dict[str, Any], keywords: list[str], ws_storage: Path | None
) -> int:
    """Search trajectories by keywords.

    Returns:
        Exit code (0 for success, 1 for no matches).
    """
    print(f"Searching for: {keywords}\n")
    results = find_by_keywords(state, keywords, ws_storage)

    if not results:
        print("No matches found.")
        return 1

    for r in results:
        print(f"✅ {r['id']}")
        print(f"   Path: {r['path']}")
        print(f"   Size: {r['size_bytes']} bytes ({r['size_bytes'] / 1024:.0f}KB)")
        print(f"   Hits: {r['hits']}")
        if "models" in r:
            print(f"   Models: {r['models']}")
        print()
    return 0


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract Windsurf Cascade trajectory data (deep extraction with protobuf decoding)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --list                      List all workspaces
  %(prog)s --find cascade_solver       Search trajectories by keyword
  %(prog)s --summaries WS_ID           List conversation summaries
  %(prog)s -w WS_ID -o out.jsonl       Extract trajectory to JSONL

Features:
  - Thinking content extraction (internal reasoning)
  - Microsecond-precision timestamps
  - Complete tool call parameters
  - Provider information
""",
    )
    parser.add_argument("--list", action="store_true", help="List all workspaces")
    parser.add_argument(
        "--find", nargs="+", metavar="KEYWORD", help="Search trajectories by keywords"
    )
    parser.add_argument(
        "--summaries", metavar="WS_ID", help="List conversation summaries"
    )
    parser.add_argument("--workspace", "-w", metavar="WS_ID", help="Extract trajectory")
    parser.add_argument("--output", "-o", metavar="FILE", help="Output JSONL file")
    args = parser.parse_args()

    # Find Windsurf paths
    state_db, ws_storage = find_windsurf_paths()
    if state_db is None:
        print("Error: Windsurf installation not found.", file=sys.stderr)
        print(
            "Searched for 'Windsurf' and 'Windsurf - Next' in standard locations.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Using: {state_db}", file=sys.stderr)

    # Load state
    try:
        state = load_codeium_state(state_db)
    except (FileNotFoundError, KeyError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except (sqlite3.Error, json.JSONDecodeError) as e:
        print(f"Error reading database: {e}", file=sys.stderr)
        sys.exit(1)

    # Execute command
    exit_code = 0
    if args.list:
        exit_code = cmd_list(state, ws_storage)
    elif args.find:
        exit_code = cmd_find(state, args.find, ws_storage)
    elif args.summaries:
        exit_code = cmd_summaries(state, args.summaries)
    elif args.workspace:
        exit_code = cmd_extract(state, args.workspace, args.output)
    else:
        parser.print_help()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
