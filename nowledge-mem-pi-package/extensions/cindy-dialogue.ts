/** Cindy 0.1.121 prepends these wire notes to otherwise ordinary Pi user text. */
interface CindyOrigin {
	channel: "wechat";
	chat_kind: "direct" | "group";
	chat_name?: string;
	sender_name?: string;
	sender_is_owner?: boolean;
}

interface Projection {
	content: string;
	origin?: CindyOrigin;
	cleaned?: boolean;
}

interface Prefix {
	remainder: string;
	origin?: CindyOrigin;
}

const CHANNEL_PREFIX = "[渠道说明] 系统追加，不是用户消息。本条来自";
const MOBILE_PREFERENCE = "产出 HTML 等可预览成品时**优先做成自包含单文件**:样式与脚本内联,图片用 data: URI 或公网地址,避免拆成需要同目录资源的多文件产物;用户明确要求多文件时照常产出。给出文件路径时同时给出结论或内容摘要,不要只回一个路径。";
const LEGACY_MOBILE_NOTE = "[客户端说明] 以下为系统每轮自动追加的环境说明,不是用户发来的消息;回复时不要把它当作用户的请求,也不要引用、复述或据此臆测用户意图。本轮请求来自手机客户端(小屏、远程查看被控电脑上的文件)。";
const CLIENT_NOTE = /^\[客户端说明\] 系统追加的环境说明，不是用户消息，不要回应或复述。本轮用户在(另一台电脑|手机)(.*?) 上远程操作本机(.*?)。(.*)$/;
const UI_LANGUAGE_NOTE = new RegExp([
	String.raw`^\[UI language\] System note appended each turn\. This is not a user message\. `,
	String.raw`Do not answer it, quote it, or infer intent from it\. The user interface language is ([^\r\n]+?) \(([a-zA-Z-]+)\)\. `,
	String.raw`When you tell the user that something failed, was blocked, could not continue, or needs a retry, write that report in \1\. `,
	String.raw`Do not default that report to English unless the interface language is English\. Say what happened and the next step\. `,
	String.raw`Keep commands, paths, identifiers, and error codes unchanged\. Ordinary replies still follow the user message and any explicit language request\. `,
	String.raw`Only user-facing error reports must use the interface language\.(?:\r?\n|$)`,
].join(""));

const HANDOFF_ENDS = [
	"== End of handoff note; the user's new message follows ==",
	"== End of handoff note; the user’s new message follows ==",
	"== 交接说明结束,以下是用户的新消息 ==",
];
const REBUILD_ENDS = [
	"== End of rebuild note; the user's new message follows ==",
	"== End of rebuild note; the user’s new message follows ==",
	"== 上下文重建说明结束,以下是用户的新消息 ==",
];
const CONTEXT_NOTES: Record<string, string[]> = {
	"[Session handoff · internal context]": HANDOFF_ENDS,
	"[Session context rebuild · internal context]": REBUILD_ENDS,
	// Cindy can prepend a fork fact to an existing handoff/rebuild note.
	"[Session fork · internal context]": [
		"== End of fork note; the user's new message follows ==",
		"== End of fork note; the user’s new message follows ==",
		...HANDOFF_ENDS, ...REBUILD_ENDS,
	],
};

/** IDs are transport context, not dialogue. Keep only names and explicit ownership. */
function sourceName(raw: string, key: "chat_id" | "user_id" | "device_id"): string | undefined | false {
	const match = raw.trim().match(new RegExp(`^(?:「([^「」\\r\\n]+)」)?(?: ?\\(${key}: ([^()\\r\\n]+)\\))?$`));
	return match && (match[1]?.trim() || match[2]?.trim()) ? match[1] : false;
}

function clientPrefix(content: string): Prefix | undefined {
	const newline = content.indexOf("\n");
	const line = (newline < 0 ? content : content.slice(0, newline)).replace(/\r$/, "");
	if (line !== LEGACY_MOBILE_NOTE + MOBILE_PREFERENCE) {
		const match = line.match(CLIENT_NOTE);
		if (!match || sourceName(match[2], "device_id") === false || sourceName(match[3], "device_id") === false) return undefined;
		if (match[4] && (match[1] !== "手机" || match[4] !== MOBILE_PREFERENCE)) return undefined;
	}
	return { remainder: newline < 0 ? "" : content.slice(newline + 1) };
}

function channelPrefix(content: string): Prefix | undefined {
	const newline = content.indexOf("\n");
	const line = (newline < 0 ? content : content.slice(0, newline)).replace(/\r$/, "");
	if (!line.startsWith(CHANNEL_PREFIX) || !line.endsWith("。")) return undefined;
	const match = line.slice(CHANNEL_PREFIX.length, -1).match(/^(?:微信| WeChat )(私聊|群)(.*)$/);
	if (!match) return undefined;
	const refs = match[2].split("，发言人");
	if (refs.length > 2) return undefined;
	const chatName = sourceName(refs[0], "chat_id");
	if (chatName === false) return undefined;
	const origin: CindyOrigin = { channel: "wechat", chat_kind: match[1] === "群" ? "group" : "direct" };
	if (chatName) origin.chat_name = chatName;
	if (refs.length === 2) {
		const ownership = refs[1].match(/(?:，)?(不是主人|是主人)$/);
		const sender = ownership ? refs[1].slice(0, ownership.index) : refs[1];
		// Cindy also emits an ownership-only speaker, without a name or ID.
		const senderName = !sender.trim() && ownership ? undefined : sourceName(sender, "user_id");
		if (senderName === false) return undefined;
		if (senderName) origin.sender_name = senderName;
		if (ownership) origin.sender_is_owner = ownership[1] === "是主人";
	}
	return { remainder: newline < 0 ? "" : content.slice(newline + 1), origin };
}

function contextPrefix(content: string): Prefix | undefined {
	const heading = content.split(/\r?\n/, 1)[0];
	const terminators = Object.hasOwn(CONTEXT_NOTES, heading) ? CONTEXT_NOTES[heading] : undefined;
	if (!terminators) return undefined;
	let fence: string | undefined;
	for (const match of content.matchAll(/^.*(?:\r?\n|$)/gm)) {
		const line = match[0].replace(/\r?\n$/, "");
		const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
		if (marker) {
			if (!fence) fence = marker[1];
			else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
			continue;
		}
		if (!fence && terminators.includes(line)) return { remainder: content.slice(match.index! + match[0].length) };
	}
	return undefined;
}

function knownPrefix(content: string): Prefix | undefined {
	for (const tag of ["cindy-extra-writable-directories", "cindy-extra-reference-directories"]) {
		if (!content.startsWith(`<${tag}>\n`) && !content.startsWith(`<${tag}>\r\n`)) continue;
		const close = `</${tag}>`;
		const end = content.indexOf(close);
		if (end < 0) return undefined;
		const remainder = content.slice(end + close.length);
		return remainder === "" || /^\r?\n/.test(remainder) ? { remainder } : undefined;
	}
	const note = content.match(UI_LANGUAGE_NOTE);
	if (note) return { remainder: content.slice(note[0].length) };
	return channelPrefix(content) || clientPrefix(content) || contextPrefix(content);
}

export function projectCindyUserText(content: string, env: Record<string, string | undefined> = process.env): Projection {
	// These are both assigned by Cindy's Pi launcher, locally and remotely.
	// A quoted marker in an ordinary Pi session must never enable filtering.
	if (!env.CINDY_PI_SESSION_ID?.trim() || !env.CINDY_PI_PERMISSION_FILE?.trim()) return { content };
	let remainder = content;
	let origin: CindyOrigin | undefined;
	let cleaned = false;
	for (;;) {
		const prefix = knownPrefix(remainder);
		if (!prefix) {
			const speaker = origin?.sender_name && (origin.chat_kind === "group" || origin.sender_is_owner === false)
				? `发言人「${origin.sender_name}」：\n` : "";
			return { content: remainder ? speaker + remainder : "", ...(origin ? { origin } : {}), ...(cleaned ? { cleaned } : {}) };
		}
		// Consume separator lines, never indentation belonging to the actual text.
		remainder = prefix.remainder.replace(/^(?:[ \t]*\r?\n)+/, "");
		if (!remainder.trim()) remainder = "";
		origin = prefix.origin || origin;
		cleaned = true;
	}
}
