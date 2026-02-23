import { n as isPathInside, r as isSymlinkOpenError, t as isNotFoundPathError } from "./path-guards-CGCPSXzR.js";
import path from "node:path";
import { constants } from "node:fs";
import fs$1 from "node:fs/promises";

//#region src/infra/fs-safe.ts
var SafeOpenError = class extends Error {
	constructor(code, message, options) {
		super(message, options);
		this.code = code;
		this.name = "SafeOpenError";
	}
};
const SUPPORTS_NOFOLLOW = process.platform !== "win32" && "O_NOFOLLOW" in constants;
const OPEN_READ_FLAGS = constants.O_RDONLY | (SUPPORTS_NOFOLLOW ? constants.O_NOFOLLOW : 0);
const ensureTrailingSep = (value) => value.endsWith(path.sep) ? value : value + path.sep;
async function openVerifiedLocalFile(filePath) {
	let handle;
	try {
		handle = await fs$1.open(filePath, OPEN_READ_FLAGS);
	} catch (err) {
		if (isNotFoundPathError(err)) throw new SafeOpenError("not-found", "file not found");
		if (isSymlinkOpenError(err)) throw new SafeOpenError("symlink", "symlink open blocked", { cause: err });
		throw err;
	}
	try {
		const [stat, lstat] = await Promise.all([handle.stat(), fs$1.lstat(filePath)]);
		if (lstat.isSymbolicLink()) throw new SafeOpenError("symlink", "symlink not allowed");
		if (!stat.isFile()) throw new SafeOpenError("not-file", "not a file");
		if (stat.ino !== lstat.ino || stat.dev !== lstat.dev) throw new SafeOpenError("path-mismatch", "path changed during read");
		const realPath = await fs$1.realpath(filePath);
		const realStat = await fs$1.stat(realPath);
		if (stat.ino !== realStat.ino || stat.dev !== realStat.dev) throw new SafeOpenError("path-mismatch", "path mismatch");
		return {
			handle,
			realPath,
			stat
		};
	} catch (err) {
		await handle.close().catch(() => {});
		if (err instanceof SafeOpenError) throw err;
		if (isNotFoundPathError(err)) throw new SafeOpenError("not-found", "file not found");
		throw err;
	}
}
async function openFileWithinRoot(params) {
	let rootReal;
	try {
		rootReal = await fs$1.realpath(params.rootDir);
	} catch (err) {
		if (isNotFoundPathError(err)) throw new SafeOpenError("not-found", "root dir not found");
		throw err;
	}
	const rootWithSep = ensureTrailingSep(rootReal);
	const resolved = path.resolve(rootWithSep, params.relativePath);
	if (!isPathInside(rootWithSep, resolved)) throw new SafeOpenError("invalid-path", "path escapes root");
	let opened;
	try {
		opened = await openVerifiedLocalFile(resolved);
	} catch (err) {
		if (err instanceof SafeOpenError) {
			if (err.code === "not-found") throw err;
			throw new SafeOpenError("invalid-path", "path is not a regular file under root", { cause: err });
		}
		throw err;
	}
	if (!isPathInside(rootWithSep, opened.realPath)) {
		await opened.handle.close().catch(() => {});
		throw new SafeOpenError("invalid-path", "path escapes root");
	}
	return opened;
}
async function readLocalFileSafely(params) {
	const opened = await openVerifiedLocalFile(params.filePath);
	try {
		if (params.maxBytes !== void 0 && opened.stat.size > params.maxBytes) throw new SafeOpenError("too-large", `file exceeds limit of ${params.maxBytes} bytes (got ${opened.stat.size})`);
		return {
			buffer: await opened.handle.readFile(),
			realPath: opened.realPath,
			stat: opened.stat
		};
	} finally {
		await opened.handle.close().catch(() => {});
	}
}

//#endregion
export { openFileWithinRoot as n, readLocalFileSafely as r, SafeOpenError as t };