import test from "node:test";
import assert from "node:assert/strict";

import {
	NowledgeMemClient,
	resolveAmbientSpace,
	resolveWorkingMemoryToolPath,
} from "../main.js";

const logger = {
	info() {},
	warn() {},
	debug() {},
	error() {},
};

function settings(values) {
	return {
		get(key) {
			return values[key];
		},
	};
}

test("resolveAmbientSpace prefers plugin settings over environment", () => {
	const previous = process.env.NMEM_SPACE;
	process.env.NMEM_SPACE = "Env Space";
	try {
		const resolved = resolveAmbientSpace(
			settings({ "nowledgeMem.space": "Configured Space" }),
			logger,
		);
		assert.deepEqual(resolved, {
			space: "Configured Space",
			source: "settings",
		});
	} finally {
		if (previous === undefined) delete process.env.NMEM_SPACE;
		else process.env.NMEM_SPACE = previous;
	}
});

test("resolveAmbientSpace resolves configured template", () => {
	const previous = process.env.ALMA_AGENT_NAME;
	process.env.ALMA_AGENT_NAME = "research";
	try {
		const resolved = resolveAmbientSpace(
			settings({ "nowledgeMem.spaceTemplate": "agent-${ALMA_AGENT_NAME}" }),
			logger,
		);
		assert.deepEqual(resolved, {
			space: "agent-research",
			source: "settings:template",
		});
	} finally {
		if (previous === undefined) delete process.env.ALMA_AGENT_NAME;
		else process.env.ALMA_AGENT_NAME = previous;
	}
});

test("resolveAmbientSpace preserves explicit empty settings over environment", () => {
	const previous = process.env.NMEM_SPACE;
	process.env.NMEM_SPACE = "Env Space";
	try {
		const resolved = resolveAmbientSpace(
			settings({ "nowledgeMem.space": "" }),
			logger,
		);
		assert.deepEqual(resolved, {
			space: "",
			source: "settings",
		});
	} finally {
		if (previous === undefined) delete process.env.NMEM_SPACE;
		else process.env.NMEM_SPACE = previous;
	}
});

test("NowledgeMemClient injects ambient space into HTTP requests", () => {
	const client = new NowledgeMemClient(logger, {
		apiUrl: "http://127.0.0.1:14242",
		space: "Research Agent",
	});

	assert.deepEqual(client._withSpaceQuery({ q: "hello" }), {
		q: "hello",
		space_id: "Research Agent",
	});
	assert.deepEqual(client._withSpaceBody({ title: "hello" }), {
		title: "hello",
		space_id: "Research Agent",
	});
});

test("readWorkingMemory rethrows backend errors for non-default spaces", async () => {
	const client = new NowledgeMemClient(logger, {
		apiUrl: "http://127.0.0.1:14242",
		space: "Research Agent",
	});
	client._fetch = async () => {
		const err = new Error("HTTP 401");
		err.status = 401;
		throw err;
	};

	await assert.rejects(() => client.readWorkingMemory(), /HTTP 401/);
});

test("Working Memory tool path only falls back locally for Default space", () => {
	assert.equal(
		resolveWorkingMemoryToolPath("Research Agent", {
			available: false,
			content: "",
			path: null,
		}),
		null,
	);
	assert.match(
		resolveWorkingMemoryToolPath("", {
			available: true,
			content: "hello",
			path: null,
		}),
		/\/ai-now\/memory\.md$/,
	);
});
