//#region src/commands/auth-choice-legacy.ts
const AUTH_CHOICE_LEGACY_ALIASES_FOR_CLI = [
	"setup-token",
	"oauth",
	"claude-cli",
	"codex-cli",
	"minimax-cloud",
	"minimax"
];
function normalizeLegacyOnboardAuthChoice(authChoice) {
	if (authChoice === "oauth" || authChoice === "claude-cli") return "setup-token";
	if (authChoice === "codex-cli") return "openai-codex";
	return authChoice;
}
function isDeprecatedAuthChoice(authChoice) {
	return authChoice === "claude-cli" || authChoice === "codex-cli";
}

//#endregion
export { isDeprecatedAuthChoice as n, normalizeLegacyOnboardAuthChoice as r, AUTH_CHOICE_LEGACY_ALIASES_FOR_CLI as t };