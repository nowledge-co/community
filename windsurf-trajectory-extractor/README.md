# Windsurf Trajectory Extractor

Deep extraction of Windsurf Cascade conversation history via protobuf decoding.

## What This Does

Extracts **complete trajectory data** from Windsurf's internal storage, including:

- ✅ **Thinking content** — Internal reasoning (only in thinking mode, not visible in UI)
- ✅ **Visible responses** — User-facing text
- ✅ **Tool calls** — Complete parameters and results
- ✅ **Microsecond timestamps** — High-precision timing data
- ✅ **Provider info** — Model provider (e.g., "anthropic")

## Why This Tool?

Windsurf stores conversation history in a protobuf-encoded format inside `state.vscdb`. This tool reverse-engineers that format to extract data that's not accessible through the standard UI export.

**Key differentiator**: Unlike JSON-based extraction tools, this performs **deep protobuf decoding** to access thinking content and precise timestamps.

## Installation

```bash
# No dependencies required — pure Python standard library
git clone https://github.com/nowledge-co/community.git
cd community/windsurf-trajectory-extractor

# Option 1: Install as package (recommended)
pip install -e .
windsurf-trajectory --help

# Option 2: Run with uv (if you have uv installed)
uv run windsurf-trajectory --help

# Option 3: Run directly with PYTHONPATH
PYTHONPATH=src python -m windsurf_trajectory.cli --help
```

## Usage

```bash
# List all workspaces with trajectory data
windsurf-trajectory --list

# Search trajectories by keyword (auto-discover workspace)
windsurf-trajectory --find cascade_solver

# List conversation summaries for a workspace
windsurf-trajectory --summaries WORKSPACE_ID

# Extract trajectory to JSONL
windsurf-trajectory -w WORKSPACE_ID -o trajectory.jsonl
```

## Output Format (JSONL)

Each line is a JSON object representing one step:

```json
{
  "step_id": 15,
  "step_type": 3,
  "timestamp": "2026-03-12T14:30:45.123456+08:00",
  "timestamp_unix_ms": 1741761045123,
  "thinking": "Let me analyze this code...",
  "visible": "Here's my analysis of the code...",
  "tool_calls": [
    {
      "tool_id": "abc123",
      "tool_name": "read_file",
      "params": {"file_path": "/path/to/file.py"}
    }
  ],
  "provider": "anthropic",
  "content_preview": "Here's my analysis..."
}
```

### Field Reference

| Field | Description |
|-------|-------------|
| `step_id` | Step opcode: 14=user message, 15=AI response, 21=tool execution |
| `step_type` | Internal step type (usually 3) |
| `timestamp` | ISO 8601 timestamp with microsecond precision |
| `timestamp_unix_ms` | Unix timestamp in milliseconds |
| `thinking` | Internal reasoning (only in thinking mode) |
| `visible` | User-visible response text |
| `tool_calls` | Array of tool invocations with parameters |
| `provider` | Model provider (e.g., "anthropic") |

## Technical Details

### Data Location

```
~/Library/Application Support/Windsurf - Next/User/globalStorage/state.vscdb
```

Supports both `Windsurf` (stable) and `Windsurf - Next` (preview) on macOS, Linux, and Windows.

### Protobuf Structure (Reverse-Engineered)

```
Top-level:
  f1 (string): Trajectory UUID
  f2 (message): Steps container
    repeated Step:
      f1  (varint): step_id
      f4  (varint): step_type
      f5  (message): metadata {f1: Timestamp {f1=seconds, f2=nanos}}
      f19 (message): user message
      f20 (message): AI response
        f3  (string): thinking content ← only in thinking mode
        f7  (message): tool call {f1=tool_id, f2=tool_name, f3=params_json}
        f8  (string): visible response
        f12 (string): provider
      f28 (message): tool result
```

## Limitations

- Only extracts the **active trajectory** (most recently selected conversation) per workspace
- To extract a specific conversation, first select it in Windsurf's sidebar
- Protobuf structure may change with Windsurf updates

## Use Cases

- **Import to Nowledge Mem** — Extract conversations for personal knowledge management
- **Research** — Analyze AI coding assistant behavior and timing
- **Backup** — Export conversation history not available through UI
- **Debugging** — Access thinking content for troubleshooting

## License

MIT

## Related Projects

- [nowledge-mem](https://mem.nowledge.co) — Personal memory system for AI agents
- [0xSero/ai-data-extraction](https://github.com/0xSero/ai-data-extraction) — Multi-tool extraction (JSON-based)

---

**Built for the [Nowledge Community](https://github.com/nowledge-co/community)**
