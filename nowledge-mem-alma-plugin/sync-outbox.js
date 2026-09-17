import { randomUUID } from "node:crypto";
import {
	closeSync,
	existsSync,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { planAutomaticFlush } from "./session-delta.js";

function validMessages(messages) {
	return (
		Array.isArray(messages) &&
		messages.every(
			(message) =>
				message &&
				["user", "assistant"].includes(message.role) &&
				typeof message.content === "string",
		)
	);
}

function validRecord(record) {
	if (
		!record ||
		typeof record.threadId !== "string" ||
		typeof record.title !== "string" ||
		typeof record.destinationKey !== "string" ||
		!/^[a-f0-9]{64}$/.test(record.destinationKey.slice(0, -1)) ||
		!record.destinationKey.endsWith("\0") ||
		!validMessages(record.messages) ||
		(record.captureSince !== undefined && (!Number.isFinite(record.captureSince) || record.captureSince < 0)) ||
		!Number.isInteger(record.savedCount) ||
		record.savedCount < 0 ||
		record.savedCount > record.messages.length ||
		!(
			record.nowledgeThreadId === null ||
			typeof record.nowledgeThreadId === "string"
		)
	)
		return false;
	const cursor = record.acknowledged;
	if (
		cursor !== null &&
		(!cursor ||
			cursor.count !== record.savedCount ||
			!Number.isInteger(cursor.remoteCount) ||
			cursor.remoteCount < 0 ||
			!/^[a-f0-9]{64}$/.test(cursor.prefixFingerprint))
	)
		return false;
	if (!record.attempt) return true;
	if (!validMessages(record.attempt.snapshot) || !record.nowledgeThreadId)
		return false;
	if (
		JSON.stringify(record.attempt.snapshot) !==
		JSON.stringify(record.messages.slice(0, record.attempt.snapshot.length))
	)
		return false;
	const plan = planAutomaticFlush({
		messages: record.attempt.snapshot,
		cursor,
		threadId: record.nowledgeThreadId,
	});
	return JSON.stringify(plan) === JSON.stringify(record.attempt.plan);
}

export function openSyncOutbox(storagePath, logger) {
	if (!storagePath) {
		logger.warn?.(
			"nowledge-mem: storagePath unavailable; automatic capture has no restart recovery",
		);
		return { records: () => [], save() {} };
	}
	mkdirSync(storagePath, { recursive: true, mode: 0o700 });
	const path = join(storagePath, "thread-sync-outbox.json");
	let records = [];
	let category = "read failure";
	try {
		if (existsSync(path)) {
			const serialized = readFileSync(path, "utf8");
			category = "invalid JSON";
			records = JSON.parse(serialized);
			category = "invalid records";
			if (!Array.isArray(records) || !records.every(validRecord))
				throw new Error("Invalid records");
		}
	} catch {
		throw new Error(
			`Cannot load thread-sync-outbox.json (${category}). Sync has not started; the original file is retained. Back up the file, then restore a valid copy or contact support.`,
		);
	}
	const writerPath = join(storagePath, "thread-sync-writer");
	const writer = randomUUID();
	writeFileSync(writerPath, writer, { mode: 0o600 });
	return {
		records: (destinationKey) =>
			records.filter((record) => record.destinationKey === destinationKey),
		save(threadId, buffer) {
			if (readFileSync(writerPath, "utf8") !== writer)
				throw new Error(
					"Thread sync outbox writer superseded by another activation",
				);
			const {
				title,
				messages,
				savedCount,
				acknowledged,
				destinationKey,
				nowledgeThreadId,
				attempt,
				captureSince,
			} = buffer;
			const record = {
				threadId,
				title,
				messages,
				savedCount,
				acknowledged,
				destinationKey,
				nowledgeThreadId,
				attempt,
				captureSince,
			};
			const next = records.filter(
				(entry) =>
					entry.threadId !== threadId ||
					entry.destinationKey !== destinationKey,
			);
			if (messages.length > savedCount || attempt || captureSince !== undefined) next.push(record);
			const serialized = JSON.stringify(next);
			const temporary = `${path}.${randomUUID()}.tmp`;
			let descriptor;
			try {
				descriptor = openSync(temporary, "wx", 0o600);
				writeFileSync(descriptor, serialized);
				fsyncSync(descriptor);
				closeSync(descriptor);
				descriptor = undefined;
				renameSync(temporary, path);
				records = JSON.parse(serialized);
				if (process.platform !== "win32") {
					descriptor = openSync(storagePath, "r");
					fsyncSync(descriptor);
				}
			} finally {
				if (descriptor !== undefined) closeSync(descriptor);
				if (existsSync(temporary)) unlinkSync(temporary);
			}
		},
	};
}
