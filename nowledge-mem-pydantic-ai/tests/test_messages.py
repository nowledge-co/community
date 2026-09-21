from __future__ import annotations

from pydantic_ai.messages import (
    BinaryContent,
    ModelMessagesTypeAdapter,
    ModelRequest,
    ModelResponse,
    SystemPromptPart,
    TextContent,
    TextPart,
    ThinkingPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)

from nowledge_mem_pydantic_ai.messages import (
    CONTEXT_METADATA,
    bounded_text,
    normalize_messages,
    without_context,
)


def test_native_json_roundtrip_preserves_context_marker_and_message_ids() -> None:
    history = [
        ModelRequest(
            parts=[
                SystemPromptPart("host-secret"),
                UserPromptPart(
                    [
                        TextContent(
                            "recalled evidence", metadata={CONTEXT_METADATA: "nowledge-mem"}
                        ),
                        TextContent("User question"),
                    ]
                ),
            ]
        ),
        ModelResponse(parts=[ThinkingPart("hidden"), TextPart("Answer")]),
    ]
    encoded = ModelMessagesTypeAdapter.dump_json(history)
    decoded = ModelMessagesTypeAdapter.validate_json(encoded)
    before = normalize_messages(history, output_tools=set(), max_bytes=512)
    after = normalize_messages(decoded, output_tools=set(), max_bytes=512)
    assert before == after
    assert [m["content"] for m in after] == ["User question", "Answer"]
    assert ModelMessagesTypeAdapter.dump_json(history) == encoded


def test_only_owned_metadata_is_removed_and_user_markup_is_preserved() -> None:
    history = [
        ModelRequest(
            parts=[
                UserPromptPart(
                    [
                        TextContent("ours", metadata={CONTEXT_METADATA: "ours"}),
                        TextContent("theirs", metadata={CONTEXT_METADATA: "theirs"}),
                        "<nowledge_mem_context>User text</nowledge_mem_context>",
                        BinaryContent(data=b"opaque-image", media_type="image/png"),
                    ]
                )
            ]
        )
    ]
    cleaned = without_context(history, "ours")
    encoded = ModelMessagesTypeAdapter.dump_json(cleaned).decode()
    assert '"ours"' not in encoded
    assert '"theirs"' in encoded
    normalized = normalize_messages(history, output_tools=set(), max_bytes=512)
    assert normalized[0]["content"] == "<nowledge_mem_context>User text</nowledge_mem_context>"


def test_redaction_precedes_byte_limit_and_title_source() -> None:
    normalized = normalize_messages(
        [
            ModelRequest(
                parts=[
                    UserPromptPart(
                        'api_key="provider-value" Authorization: Bearer token-value '
                        "known-mem-token password=private-value " + chr(0x1F680) * 500
                    )
                ]
            ),
        ],
        output_tools=set(),
        max_bytes=512,
        secrets=["known-mem-token"],
    )
    content = normalized[0]["content"]
    for secret in ("provider-value", "token-value", "known-mem-token", "private-value"):
        assert secret not in content
    assert len(content.encode()) <= 512
    assert content.endswith("[truncated]")
    assert normalized[0]["metadata"]["truncated"] is True
    assert bounded_text("short", 512) == "short"


def test_only_acknowledged_structured_output_is_captured() -> None:
    history = [
        ModelResponse(
            parts=[
                ToolCallPart("final_result", {"answer": "winner"}, "one"),
                ToolCallPart("final_result", {"answer": "discarded"}, "two"),
                ToolCallPart("memory_search", {"query": "private query"}, "three"),
            ]
        ),
        ModelRequest(
            parts=[
                ToolReturnPart("final_result", "Final result processed.", "one"),
                ToolReturnPart("final_result", "Output tool not used", "two"),
                ToolReturnPart("memory_search", "recalled content", "three"),
            ]
        ),
    ]
    normalized = normalize_messages(history, output_tools={"final_result"}, max_bytes=512)
    assert [m["content"] for m in normalized] == ['{"answer": "winner"}']
