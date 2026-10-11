import assert from "node:assert/strict";
import test from "node:test";
import { buildBehavioralHook } from "../src/hooks/behavioral.js";
import { ceState } from "../src/ce-state.js";

test("both live behavioral prompt variants bound thread reads", () => {
	const previous = ceState.active;
	ceState.active = false;
	try {
		for (const sessionContext of [false, true]) {
			const hook = buildBehavioralHook({}, { sessionContext });
			const prompt = hook({}, {}).appendSystemContext;
			assert.match(prompt, /at most one small targeted message range per question/);
			assert.match(prompt, /Never loop over offsets/);
			assert.match(prompt, /report the evidence gap and refine search/);
			assert.doesNotMatch(prompt, /full conversation context/);
		}
	} finally {
		ceState.active = previous;
	}
});
