#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_APP = "pi";
const DEFAULT_API_URL = "http://127.0.0.1:14242";
const CONFIG_PATH = join(homedir(), ".nowledge-mem", "config.json");
const DEFAULT_MAX_MESSAGE_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const VERSION = readPackageVersion();
const fileMtimes = new Map();

function readPackageVersion() {
	try {
		const here = dirname(fileURLToPath(import.meta.url));
		const pkg = JSON.parse(readFileSync(resolve(here, "..", "package.json"), "utf8"));
		return typeof pkg.version === "string" ? pkg.version : "unknown";
	} catch {
		return "unknown";
	}
}

function usage() {
	return `Nowledge Mem Pi historical thread sync

Preview Pi sessions:
  nowledge-mem-pi-sync
  nowledge-mem-pi-sync --limit 20 --json

Import Pi sessions:
  nowledge-mem-pi-sync --apply
  nowledge-mem-pi-sync --apply --space work

Options:
  --apply                    Import sessions. Without this, the command only previews.
  --json                     Print machine-readable JSON.
  --session-dir <dir>        Scan a Pi session directory. May be repeated.
  --limit <n>                Limit imported/previewed sessions after filtering.
  --since <date>             Include sessions modified at or after this date.
  --until <date>             Include sessions modified before this date.
  --project <text>           Include sessions whose cwd contains this text.
  --space <id-or-name>       Route imported threads to a Mem space.
  --api-url <url>            Override NMEM_API_URL or ~/.nowledge-mem/config.json.
  --api-key <key>            Override NMEM_API_KEY or ~/.nowledge-mem/config.json.
  --agent-id <id>            Attribute messages to an AI Identity.
  --host-agent-id <id>       Attribute messages to a host-local agent identity.
  --max-message-chars <n>    Truncate individual messages after n characters.
  --help                     Show this help.
`;
}

function parseArgs(argv) {
	const args = {
		apply: false,
		json: false,
		sessionDirs: [],
		limit: undefined,
		since: undefined,
		until: undefined,
		project: undefined,
		space: undefined,
		apiUrl: undefined,
		apiKey: undefined,
		agentId: undefined,
		hostAgentId: undefined,
		maxMessageChars: DEFAULT_MAX_MESSAGE_CHARS,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const value = () => {
			index += 1;
			if (index >= argv.length) throw new Error(`${arg} requires a value`);
			return argv[index];
		};
		if (arg === "--apply") args.apply = true;
		else if (arg === "--json") args.json = true;
		else if (arg === "--session-dir") args.sessionDirs.push(resolve(value()));
		else if (arg === "--limit") args.limit = positiveInt(value(), "--limit");
		else if (arg === "--since") args.since = parseDate(value(), "--since");
		else if (arg === "--until") args.until = parseDate(value(), "--until");
		else if (arg === "--project") args.project = value().toLowerCase();
		else if (arg === "--space") args.space = value().trim() || undefined;
		else if (arg === "--api-url") args.apiUrl = trimTrailingSlash(value());
		else if (arg === "--api-key") args.apiKey = value().trim() || undefined;
		else if (arg === "--agent-id") args.agentId = value().trim() || undefined;
		else if (arg === "--host-agent-id") args.hostAgentId = value().trim() || undefined;
		else if (arg === "--max-message-chars") args.maxMessageChars = positiveInt(value(), "--max-message-chars");
		else if (arg === "--help" || arg === "-h") {
			console.log(usage());
			process.exit(0);
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}
	return args;
}

function positiveInt(raw, name) {
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
	return parsed;
}

function parseDate(raw, name) {
	const date = new Date(raw);
	if (Number.isNaN(date.getTime())) throw new Error(`${name} must be a valid date`);
	return date;
}

function trimTrailingSlash(value) {
	return value.trim().replace(/\/+$/, "");
}

function readSharedConfig() {
	try {
		if (!existsSync(CONFIG_PATH)) return {};
		const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function stringValue(value) {
	return typeof value === "string" ? value.trim() || undefined : undefined;
}

function readConfigValue(args, config, optionName, envName, ...configKeys) {
	if (args[optionName]) return args[optionName];
	const envValue = process.env[envName]?.trim();
	if (envValue) return envValue;
	for (const key of configKeys) {
		const value = stringValue(config[key]);
		if (value) return value;
	}
	return undefined;
}

function resolveConfig(args) {
	const config = readSharedConfig();
	return {
		apiUrl: trimTrailingSlash(args.apiUrl || process.env.NMEM_API_URL || stringValue(config.apiUrl) || stringValue(config.api_url) || DEFAULT_API_URL),
		apiKey: readConfigValue(args, config, "apiKey", "NMEM_API_KEY", "apiKey", "api_key"),
		space:
			args.space ||
			process.env.NMEM_SPACE?.trim() ||
			process.env.NMEM_SPACE_ID?.trim() ||
			stringValue(config.space) ||
			stringValue(config.spaceId) ||
			stringValue(config.space_id),
		agentId: readConfigValue(args, config, "agentId", "NMEM_AGENT_ID", "agentId", "agent_id"),
		hostAgentId: readConfigValue(args, config, "hostAgentId", "NMEM_HOST_AGENT_ID", "hostAgentId", "host_agent_id"),
	};
}

function candidateSessionDirs(args) {
	const dirs = [];
	const add = (candidate) => {
		if (!candidate) return;
		const resolved = resolve(candidate);
		if (!dirs.includes(resolved)) dirs.push(resolved);
	};
	for (const dir of args.sessionDirs) add(dir);
	if (args.sessionDirs.length > 0) return dirs;
	add(process.env.PI_CODING_AGENT_SESSION_DIR);
	if (process.env.PI_CODING_AGENT_DIR) add(join(process.env.PI_CODING_AGENT_DIR, "sessions"));
	add(join(homedir(), ".pi", "agent", "sessions"));
	add(join(homedir(), ".pi", "agent"));
	return dirs;
}

function isFilesystemError(error) {
	return Boolean(error && typeof error === "object" && typeof error.code === "string");
}

function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

function warnFilesystem(action, path, error) {
	console.warn(`Warning: skipped ${path}: ${action} failed: ${errorMessage(error)}`);
}

function rememberFileMtime(file, stats) {
	fileMtimes.set(file, stats.mtime.toISOString());
}

function discoverSessionFiles(args) {
	fileMtimes.clear();
	const seen = new Set();
	const files = [];
	for (const dir of candidateSessionDirs(args)) {
		if (!existsSync(dir)) continue;
		let stats;
		try {
			stats = statSync(dir);
		} catch (error) {
			if (!isFilesystemError(error)) throw error;
			warnFilesystem("stat", dir, error);
			continue;
		}
		if (stats.isFile() && dir.endsWith(".jsonl")) {
			if (!seen.has(dir)) {
				seen.add(dir);
				rememberFileMtime(dir, stats);
				files.push(dir);
			}
			continue;
		}
		if (!stats.isDirectory()) continue;
		for (const file of walkJsonl(dir)) {
			if (!seen.has(file)) {
				seen.add(file);
				files.push(file);
			}
		}
	}
	return files;
}

function walkJsonl(root) {
	const files = [];
	const visit = (dir) => {
		let names;
		try {
			names = readdirSync(dir);
		} catch (error) {
			if (!isFilesystemError(error)) throw error;
			warnFilesystem("read directory", dir, error);
			return;
		}
		for (const name of names) {
			const path = join(dir, name);
			let stats;
			try {
				stats = statSync(path);
			} catch (error) {
				if (!isFilesystemError(error)) throw error;
				warnFilesystem("stat", path, error);
				continue;
			}
			if (stats.isDirectory()) visit(path);
			else if (stats.isFile() && name.endsWith(".jsonl")) {
				rememberFileMtime(path, stats);
				files.push(path);
			}
		}
	};
	visit(root);
	return files;
}

function parseSessionFile(file) {
	let raw;
	try {
		raw = readFileSync(file, "utf8");
	} catch (error) {
		if (!isFilesystemError(error)) throw error;
		warnFilesystem("read file", file, error);
		return undefined;
	}
	const entries = [];
	const errors = [];
	const lines = raw.split(/\r?\n/);
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index].trim();
		if (!line) continue;
		try {
			const value = JSON.parse(line);
			if (value && typeof value === "object" && !Array.isArray(value)) entries.push(value);
		} catch (error) {
			errors.push(`line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	const header = entries.find((entry) => entry.type === "session") || {};
	const body = entries.filter((entry) => entry.type !== "session");
	return { file, header, entries: body, errors };
}

function fileModifiedAt(file) {
	const cached = fileMtimes.get(file);
	if (cached) return cached;
	try {
		const modifiedAt = statSync(file).mtime.toISOString();
		fileMtimes.set(file, modifiedAt);
		return modifiedAt;
	} catch (error) {
		if (!isFilesystemError(error)) throw error;
		warnFilesystem("stat", file, error);
		return undefined;
	}
}

function isLegacyLinearSession(parsed) {
	const version = Number.parseInt(String(parsed.header.version ?? ""), 10);
	return Number.isFinite(version) && version < 2;
}

function branchEntries(parsed) {
	const entries = parsed.entries;
	const withIds = entries.filter((entry) => typeof entry.id === "string" && entry.id);
	if (!withIds.length) return isLegacyLinearSession(parsed) ? entries : [];
	const byId = new Map(withIds.map((entry) => [entry.id, entry]));
	const leaf = withIds[withIds.length - 1];
	const branch = [];
	const seen = new Set();
	let current = leaf;
	while (current && !seen.has(current.id)) {
		branch.unshift(current);
		seen.add(current.id);
		const parentId = typeof current.parentId === "string" ? current.parentId : undefined;
		current = parentId ? byId.get(parentId) : undefined;
	}
	return branch.length ? branch : entries;
}

function contentToText(content) {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) return content.map(partToText).filter(Boolean).join("\n");
	if (content && typeof content === "object") return partToText(content);
	return "";
}

function partToText(part) {
	if (typeof part === "string") return part;
	if (!part || typeof part !== "object") return "";
	const type = stringValue(part.type) || "part";
	if (type === "text") return stringValue(part.text) || stringValue(part.content) || "";
	if (type === "image") return "[Image]";
	if (type === "toolUse" || type === "tool" || type === "toolCall") {
		return `[Tool: ${stringValue(part.name) || stringValue(part.tool) || "tool"}]`;
	}
	if (type === "file") return `[File: ${stringValue(part.filename) || stringValue(part.path) || "attachment"}]`;
	return stringValue(part.text) || stringValue(part.content) || `[${type}]`;
}

function messageToText(message) {
	const role = stringValue(message.role);
	if (role === "bashExecution") {
		const command = stringValue(message.command) || "";
		const output = stringValue(message.output) || "(no output)";
		const suffix = typeof message.exitCode === "number" && message.exitCode !== 0 ? `\n\nCommand exited with code ${message.exitCode}` : "";
		return `Ran \`${command}\`\n\`\`\`\n${output}\n\`\`\`${suffix}`;
	}
	if (role === "branchSummary") return `Pi branch summary:\n${stringValue(message.summary) || ""}`;
	if (role === "compactionSummary") return `Pi compaction summary:\n${stringValue(message.summary) || ""}`;
	return contentToText(message.content);
}

function normalizeRole(role) {
	if (role === "user" || role === "bashExecution") return "user";
	if (role === "assistant" || role === "toolResult" || role === "branchSummary" || role === "compactionSummary") return "assistant";
	return undefined;
}

function truncate(text, maxChars) {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}\n\n[Pi message truncated by Nowledge Mem history sync]`;
}

function entryToMessage(entry, index, ambient, maxMessageChars) {
	if (entry.type === "message") {
		const message = entry.message;
		if (!message || typeof message !== "object") return undefined;
		if (message.role === "custom") return undefined;
		const role = normalizeRole(message.role);
		if (!role) return undefined;
		const content = truncate(messageToText(message).trim(), maxMessageChars);
		if (!content) return undefined;
		return {
			role,
			content,
			timestamp: stringValue(entry.timestamp),
			metadata: {
				external_id: `pi-entry-${stringValue(entry.id) || index}`,
				pi_entry_id: stringValue(entry.id),
				pi_entry_type: entry.type,
				pi_message_role: stringValue(message.role),
				...ambient,
			},
		};
	}
	if (entry.type === "custom_message") {
		const content = truncate(contentToText(entry.content).trim(), maxMessageChars);
		if (!content) return undefined;
		return {
			role: "user",
			content: `Pi custom context${stringValue(entry.customType) ? ` (${stringValue(entry.customType)})` : ""}:\n${content}`,
			timestamp: stringValue(entry.timestamp),
			metadata: {
				external_id: `pi-entry-${stringValue(entry.id) || index}`,
				pi_entry_id: stringValue(entry.id),
				pi_entry_type: entry.type,
				pi_custom_type: stringValue(entry.customType),
				pi_custom_display: typeof entry.display === "boolean" ? entry.display : undefined,
				...ambient,
			},
		};
	}
	if (entry.type === "compaction" || entry.type === "branch_summary") {
		const label = entry.type === "compaction" ? "Pi compaction summary" : "Pi branch summary";
		const content = truncate(`${label}:\n${stringValue(entry.summary) || ""}`.trim(), maxMessageChars);
		if (!content) return undefined;
		return {
			role: "assistant",
			content,
			timestamp: stringValue(entry.timestamp),
			metadata: {
				external_id: `pi-entry-${stringValue(entry.id) || index}`,
				pi_entry_id: stringValue(entry.id),
				pi_entry_type: entry.type,
				...ambient,
			},
		};
	}
	return undefined;
}

function stablePathSuffix(file) {
	return createHash("sha256").update(resolve(file)).digest("hex").slice(0, 10);
}

function sessionIdFor(parsed) {
	return stringValue(parsed.header.id) || `${basename(parsed.file).replace(/\.jsonl$/i, "")}-${stablePathSuffix(parsed.file)}`;
}

function threadIdFor(sessionId) {
	return `pi-${sessionId}`.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function sessionName(entries) {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (entry.type === "session_info" && stringValue(entry.name)) return stringValue(entry.name);
	}
	return undefined;
}

function buildTitle(parsed, messages, branch) {
	const name = sessionName(branch);
	if (name) return name;
	const firstUser = messages.find((message) => message.role === "user")?.content.trim();
	if (firstUser) return firstUser.slice(0, 120);
	const cwd = stringValue(parsed.header.cwd);
	return cwd ? `Pi session - ${basename(cwd)}` : `Pi session - ${basename(parsed.file, ".jsonl")}`;
}

function shouldSync(messages) {
	return messages.some((message) => message.role === "user") && messages.some((message) => message.role === "assistant");
}

function normalizeSession(parsed, args, config) {
	const sessionId = sessionIdFor(parsed);
	const threadId = threadIdFor(sessionId);
	const cwd = stringValue(parsed.header.cwd);
	const ambient = {
		source_app: SOURCE_APP,
		...(config.agentId ? { agent_id: config.agentId } : {}),
		...(config.hostAgentId ? { host_agent_id: config.hostAgentId } : {}),
	};
	const branch = branchEntries(parsed);
	const messages = branch
		.map((entry, index) => entryToMessage(entry, index, ambient, args.maxMessageChars))
		.filter(Boolean);
	const importable = shouldSync(messages);
	const modifiedAt = fileModifiedAt(parsed.file);
	if (!modifiedAt) return undefined;
	const body = {
		thread_id: threadId,
		title: buildTitle(parsed, messages, branch),
		messages,
		source: SOURCE_APP,
		project: cwd,
		workspace: cwd,
		tool_version: VERSION,
		metadata: {
			pi_session_id: sessionId,
			pi_session_file: parsed.file,
			sync_reason: "history_sync",
			historical_import: true,
			analysis: "searchable-now-distill-on-demand",
			branch_entry_count: branch.length,
			total_entry_count: parsed.entries.length,
			...(config.agentId ? { agent_id: config.agentId } : {}),
			...(config.hostAgentId ? { host_agent_id: config.hostAgentId } : {}),
		},
	};
	return {
		file: parsed.file,
		sessionId,
		threadId,
		cwd,
		modifiedAt,
		parseErrors: parsed.errors,
		messageCount: messages.length,
		importable,
		skipReason: importable ? undefined : "needs at least one user and one assistant message on the active branch",
		body,
	};
}

function filterSessions(sessions, args) {
	let result = sessions;
	if (args.since) result = result.filter((session) => new Date(session.modifiedAt) >= args.since);
	if (args.until) result = result.filter((session) => new Date(session.modifiedAt) < args.until);
	if (args.project) result = result.filter((session) => (session.cwd || "").toLowerCase().includes(args.project));
	result = result.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
	if (args.limit) result = result.slice(0, args.limit);
	return result;
}

function withSpace(body, space) {
	if (!space || Object.prototype.hasOwnProperty.call(body, "space_id")) return body;
	return { ...body, space_id: space };
}

function remoteApiFallbackUrls(url) {
	const urls = [];
	const add = (candidate) => {
		if (!urls.includes(candidate)) urls.push(candidate);
	};
	const parsed = new URL(url);
	const path = parsed.pathname || "";
	if (path === "/remote-api") {
		parsed.pathname = "/";
		add(parsed.toString());
	} else if (path.startsWith("/remote-api/")) {
		parsed.pathname = path.slice("/remote-api".length);
		add(parsed.toString());
	}
	return urls;
}

async function postJson(config, path, body) {
	const headers = { "Content-Type": "application/json" };
	if (config.apiKey) {
		headers.Authorization = `Bearer ${config.apiKey}`;
		headers["X-NMEM-API-Key"] = config.apiKey;
	}
	let urls;
	try {
		urls = [`${config.apiUrl}${path}`, ...remoteApiFallbackUrls(`${config.apiUrl}${path}`)];
	} catch {
		return { ok: false, status: 0, data: { error: "Invalid API URL" } };
	}
	const requestBody = JSON.stringify(withSpace(body, config.space));
	let last = { ok: false, status: 0, data: { error: "request was not sent" } };
	for (const url of urls) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
		try {
			const response = await fetch(url, { method: "POST", headers, body: requestBody, signal: controller.signal });
			const data = await response.json().catch(() => ({}));
			last = { ok: response.ok, status: response.status, data };
			if (response.ok) return last;
		} catch (error) {
			last = { ok: false, status: 0, data: { error: error instanceof Error ? error.message : String(error) } };
		} finally {
			clearTimeout(timeout);
		}
	}
	return last;
}

async function syncSession(session, config) {
	let result = await postJson(config, "/threads", session.body);
	if (result.ok) return { ...session, action: "created", ok: true, status: result.status, response: result.data };
	result = await postJson(config, `/threads/${encodeURIComponent(session.threadId)}/append`, {
		messages: session.body.messages,
		deduplicate: true,
		idempotency_key: `pi:history:${session.sessionId}:${session.messageCount}`,
		historical_import: true,
		analysis: "searchable-now-distill-on-demand",
	});
	if (result.ok) return { ...session, action: "appended", ok: true, status: result.status, response: result.data };
	return { ...session, action: "failed", ok: false, status: result.status, response: result.data };
}

function summarize(results, apply) {
	const summary = {
		apply,
		found: results.length,
		importable: results.filter((session) => session.importable).length,
		skipped: results.filter((session) => !session.importable).length,
		created: results.filter((session) => session.action === "created").length,
		appended: results.filter((session) => session.action === "appended").length,
		failed: results.filter((session) => session.action === "failed").length,
		parseWarnings: results.filter((session) => session.parseErrors.length).length,
	};
	return { summary, sessions: results };
}

function printHuman(report) {
	const { summary, sessions } = report;
	const mode = summary.apply ? "Import" : "Preview";
	console.log(`${mode}: ${summary.importable}/${summary.found} Pi sessions importable`);
	if (summary.skipped) console.log(`Skipped: ${summary.skipped}`);
	if (summary.parseWarnings) console.log(`Parse warnings: ${summary.parseWarnings}`);
	if (summary.apply) console.log(`Created: ${summary.created}  Appended: ${summary.appended}  Failed: ${summary.failed}`);
	if (!summary.apply) console.log("No changes made. Re-run with --apply to import.");
	for (const session of sessions.slice(0, 20)) {
		const status = session.action || (session.importable ? "ready" : "skipped");
		const reason = session.skipReason ? ` (${session.skipReason})` : "";
		console.log(`- ${status}: ${session.threadId}  messages=${session.messageCount}  ${session.body.title}${reason}`);
		console.log(`  ${session.file}`);
	}
	if (sessions.length > 20) console.log(`... ${sessions.length - 20} more sessions hidden; use --json for full output.`);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const config = resolveConfig(args);
	const files = discoverSessionFiles(args);
	const parsed = files.map((file) => parseSessionFile(file)).filter(Boolean);
	let sessions = parsed.map((session) => normalizeSession(session, args, config)).filter(Boolean);
	sessions = filterSessions(sessions, args);
	if (!args.apply) {
		const report = summarize(sessions, false);
		if (args.json) console.log(JSON.stringify(report, null, 2));
		else printHuman(report);
		return;
	}
	const results = [];
	for (const session of sessions) {
		if (!session.importable) {
			results.push({ ...session, action: "skipped", ok: true });
			continue;
		}
		results.push(await syncSession(session, config));
	}
	const report = summarize(results, true);
	if (args.json) console.log(JSON.stringify(report, null, 2));
	else printHuman(report);
	if (report.summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
