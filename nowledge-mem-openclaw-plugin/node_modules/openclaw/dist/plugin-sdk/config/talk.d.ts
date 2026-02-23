import fs from "node:fs";
import os from "node:os";
import path from "node:path";
type TalkApiKeyDeps = {
    fs?: typeof fs;
    os?: typeof os;
    path?: typeof path;
};
export declare function readTalkApiKeyFromProfile(deps?: TalkApiKeyDeps): string | null;
export declare function resolveTalkApiKey(env?: NodeJS.ProcessEnv, deps?: TalkApiKeyDeps): string | null;
export {};
