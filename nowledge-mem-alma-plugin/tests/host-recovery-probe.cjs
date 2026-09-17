const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

exports.activate = async (context) => {
	const config = JSON.parse(fs.readFileSync(path.join(context.extensionPath, "probe-config.json"), "utf8"));
	const record = (event, details = {}) => fs.appendFileSync(config.log, `${JSON.stringify({ time: new Date().toISOString(), event, ...details })}\n`, { mode: 0o600 });
	const digest = (text) => crypto.createHash("sha256").update(text).digest("hex");
	const candidate = require(config.candidateModule);
	const handlers = new Map();
	const settings = JSON.parse(fs.readFileSync(config.settings, "utf8"));
	const recordsPath = path.join(context.storagePath, "probe-records.json");
	const instance = await candidate.activate({
		storagePath: context.storagePath,
		logger: { info() {}, debug() {}, warn() {}, error() { record("candidate.error"); } },
		settings: { get: (key) => settings[key] },
		chat: {
			getThread: async () => ({ title: config.marker }),
			getMessages: async (threadId) => {
				if (threadId !== config.threadId) throw new Error("Unowned synthetic thread");
				return fs.existsSync(recordsPath) ? JSON.parse(fs.readFileSync(recordsPath, "utf8")) : [];
			},
		},
		events: {
			on(name, handler) {
				handlers.set(name, handler);
				return context.events.on(name, (input, output) => {
					if (input?.threadId !== config.threadId) return;
					return handler(input, output);
				});
			},
		},
	});
	record("activate", { storagePath: context.storagePath });
	const sentinel = path.join(context.storagePath, "probe-captured");
	if (!fs.existsSync(sentinel)) {
		const records = ["user", "assistant"].map((role) => ({
			id: `${config.threadId}-${role}`, threadId: config.threadId, role, createdAt: new Date().toISOString(),
			content: { id: `${config.threadId}-${role}`, role, parts: [{ type: "text", text: `${config.marker} ${role}` }] },
		}));
		fs.writeFileSync(recordsPath, JSON.stringify(records), { flag: "wx", mode: 0o600 });
		fs.writeFileSync(sentinel, config.marker, { flag: "wx", mode: 0o600 });
		record("synthetic-callback.capture", { count: 2, digest: digest(`${config.marker} user\n${config.marker} assistant`) });
	}
	if (settings["nowledgeMem.apiKey"] === "synthetic-A") {
		await handlers.get("chat.message.willSend")({ threadId: config.threadId, content: "SYNTHETIC_TRANSFORMED_INPUT" });
		await handlers.get("chat.message.didReceive")({ threadId: config.threadId, response: { content: "SYNTHETIC_TRANSFORMED_OUTPUT" } });
	}
	record("canonical.reread", { level: "synthetic persisted UIMessage adapter; actual candidate and host lifecycle, not real chat capture" });
	return {
		async dispose() {
			record("dispose.start");
			await instance.dispose();
			record("dispose.end");
		},
	};
};
