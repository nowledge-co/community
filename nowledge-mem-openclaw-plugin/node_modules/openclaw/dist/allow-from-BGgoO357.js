//#region src/channels/telegram/allow-from.ts
function normalizeTelegramAllowFromEntry(raw) {
	return (typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "").trim().replace(/^(telegram|tg):/i, "").trim();
}
function isNumericTelegramUserId(raw) {
	return /^-?\d+$/.test(raw);
}

//#endregion
export { normalizeTelegramAllowFromEntry as n, isNumericTelegramUserId as t };