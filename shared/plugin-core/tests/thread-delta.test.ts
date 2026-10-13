import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { selectAcknowledgedDelta, type AcknowledgedCursor } from "../src/thread-delta.ts";

type Message = { id: string; content?: string };
type Fixture = { name: string; messages: Message[]; cursor?: AcknowledgedCursor; expected: unknown };
const fixtures: Fixture[] = JSON.parse(readFileSync(new URL("./fixtures/snapshot-deltas.json", import.meta.url), "utf8"));

for (const fixture of fixtures) {
  test(`preserves legacy snapshot result: ${fixture.name}`, () => {
    assert.deepEqual(selectAcknowledgedDelta(fixture.messages, fixture.cursor, message => message.id), fixture.expected);
  });
}

test("invalid cursor counts reconcile without indexing an invalid anchor", () => {
  const messages = [{ id: "a" }];
  for (const count of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 2]) {
    const cursor = { count, remoteCount: 10, prefixFingerprint: "untrusted" };
    const delta = selectAcknowledgedDelta(messages, cursor, message => message.id);
    assert.equal(delta.reset, true);
    assert.deepEqual(delta.messages, messages);
    assert.equal(delta.next.remoteCount, 10);
  }
});

test("selection cannot commit a candidate or mutate an acknowledged cursor", () => {
  const first = [{ id: "a" }];
  const cursor = Object.freeze(selectAcknowledgedDelta(first, undefined, message => message.id).next);
  const messages = [...first, { id: "b" }];
  const candidate = selectAcknowledgedDelta(messages, cursor, message => message.id);
  assert.equal(cursor.count, 1);
  assert.equal(candidate.next.count, 2);
  assert.deepEqual(selectAcknowledgedDelta(messages, cursor, message => message.id), candidate);
});
