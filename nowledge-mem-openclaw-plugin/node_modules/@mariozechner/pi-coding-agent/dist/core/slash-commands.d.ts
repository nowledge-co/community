export type SlashCommandSource = "extension" | "prompt" | "skill";
export type SlashCommandLocation = "user" | "project" | "path";
export interface SlashCommandInfo {
    name: string;
    description?: string;
    source: SlashCommandSource;
    location?: SlashCommandLocation;
    path?: string;
}
export interface BuiltinSlashCommand {
    name: string;
    description: string;
}
export declare const BUILTIN_SLASH_COMMANDS: ReadonlyArray<BuiltinSlashCommand>;
//# sourceMappingURL=slash-commands.d.ts.map