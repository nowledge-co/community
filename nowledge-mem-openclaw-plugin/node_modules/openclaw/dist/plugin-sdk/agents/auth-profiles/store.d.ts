import type { AuthProfileStore } from "./types.js";
export declare function updateAuthProfileStoreWithLock(params: {
    agentDir?: string;
    updater: (store: AuthProfileStore) => boolean;
}): Promise<AuthProfileStore | null>;
export declare function loadAuthProfileStore(): AuthProfileStore;
export declare function ensureAuthProfileStore(agentDir?: string, options?: {
    allowKeychainPrompt?: boolean;
}): AuthProfileStore;
export declare function saveAuthProfileStore(store: AuthProfileStore, agentDir?: string): void;
