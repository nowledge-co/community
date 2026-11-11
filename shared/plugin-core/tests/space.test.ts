import { test } from "node:test";
import assert from "node:assert/strict";
import { exactSpaceBody, resolveSpaceReference } from "../src/space.ts";

test("Space resolution preserves opaque IDs and prioritizes them over names", () => {
  const roster = { spaces: [{id: " 旧/ID ", name: "Work", aliases: ["项目"]}, {id: "other", name: " 旧/ID "}] };
  assert.equal(resolveSpaceReference(roster, " 旧/ID "), " 旧/ID ");
  assert.equal(resolveSpaceReference(roster, "work"), " 旧/ID ");
  assert.equal(resolveSpaceReference(roster, "项目"), " 旧/ID ");
  assert.throws(() => resolveSpaceReference(roster, "missing"));
  assert.throws(() => resolveSpaceReference({spaces: [{id:"a",name:"Work"},{id:"b",name:"Work"}]}, "work"));
});

test("omitted and explicit empty selectors remain distinct; failed resolution cannot write", async () => {
  const load = async () => ({spaces: [{id:"opaque",name:"Work"}]});
  assert.deepEqual(await exactSpaceBody({}, "Work", load), {space_id:"opaque"});
  assert.deepEqual(await exactSpaceBody({space_id:""}, "Work", async () => { throw Error("must not load"); }), {space_id:""});
  assert.deepEqual(await exactSpaceBody({}, undefined, load), {});
  await assert.rejects(exactSpaceBody({}, "unknown", load));
});
