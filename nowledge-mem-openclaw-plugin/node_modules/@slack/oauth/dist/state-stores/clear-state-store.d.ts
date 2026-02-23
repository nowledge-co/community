import type { InstallURLOptions } from '../install-url-options';
import type { StateStore } from './interface';
export default class ClearStateStore implements StateStore {
    private stateSecret;
    private stateExpirationSeconds;
    constructor(stateSecret: string, stateExpirationSeconds?: number);
    generateStateParam(installOptions: InstallURLOptions, now: Date): Promise<string>;
    verifyStateParam(now: Date, state: string): Promise<InstallURLOptions>;
}
//# sourceMappingURL=clear-state-store.d.ts.map