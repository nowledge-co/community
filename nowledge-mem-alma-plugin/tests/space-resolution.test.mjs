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

test("resolveAmbientSpace lets blank settings fall back to environment", () => {
	const previous = process.env.NMEM_SPACE;
	process.env.NMEM_SPACE = "Env Space";
	try {
		const resolved = resolveAmbientSpace(
			settings({ "nowledgeMem.space": "" }),
			logger,
		);
		assert.deepEqual(resolved, {
			space: "Env Space",
			source: "env",
		});
	} finally {
		if (previous === undefined) delete process.env.NMEM_SPACE;
		else process.env.NMEM_SPACE = previous;
	}
});

test("resolveAmbientSpace falls back to environment when Alma returns default blank settings", () => {
	const previousSpace = process.env.NMEM_SPACE;
	const previousTemplateVar = process.env.ALMA_AGENT_NAME;
	process.env.NMEM_SPACE = "Env Space";
	delete process.env.ALMA_AGENT_NAME;
	try {
		const resolved = resolveAmbientSpace(
			settings({
				"nowledgeMem.space": "",
				"nowledgeMem.spaceTemplate": "",
			}),
			logger,
		);
		assert.deepEqual(resolved, {
			space: "Env Space",
			source: "env",
		});
	} finally {
		if (previousSpace === undefined) delete process.env.NMEM_SPACE;
		else process.env.NMEM_SPACE = previousSpace;
		if (previousTemplateVar === undefined) delete process.env.ALMA_AGENT_NAME;
		else process.env.ALMA_AGENT_NAME = previousTemplateVar;
	}
});

test("resolveAmbientSpace falls back to environment when configured template resolves empty", () => {
	const previousSpace = process.env.NMEM_SPACE;
	const previousTemplateVar = process.env.ALMA_AGENT_NAME;
	process.env.NMEM_SPACE = "Env Space";
	delete process.env.ALMA_AGENT_NAME;
	try {
		const resolved = resolveAmbientSpace(
			settings({
				"nowledgeMem.spaceTemplate": "agent-${ALMA_AGENT_NAME}",
			}),
			logger,
		);
		assert.deepEqual(resolved, {
			space: "Env Space",
			source: "env",
		});
	} finally {
		if (previousSpace === undefined) delete process.env.NMEM_SPACE;
		else process.env.NMEM_SPACE = previousSpace;
		if (previousTemplateVar === undefined) delete process.env.ALMA_AGENT_NAME;
		else process.env.ALMA_AGENT_NAME = previousTemplateVar;
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

test("readContextBundle passes source, identity, and ambient space", async () => {
	const client = new NowledgeMemClient(logger, {
		apiUrl: "http://127.0.0.1:14242",
		space: "Research Agent",
	});
	let seen = null;
	client._fetch = async (method, path, options) => {
		seen = {
			method,
			path,
			params: client._withSpaceQuery(options?.params),
		};
		return { rendered_markdown: "context" };
	};

	const bundle = await client.readContextBundle({
		agentId: "alice",
		hostAgentId: "alma:alice",
	});

	assert.equal(bundle.rendered_markdown, "context");
	assert.deepEqual(seen, {
		method: "GET",
		path: "/context/bundle",
		params: {
			source_app: "alma",
			agent_id: "alice",
			host_agent_id: "alma:alice",
			include_working_memory: undefined,
			space_id: "Research Agent",
		},
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
