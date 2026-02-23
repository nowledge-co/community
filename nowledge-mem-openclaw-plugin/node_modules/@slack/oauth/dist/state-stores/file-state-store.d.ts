import { type Logger } from '@slack/logger';
import type { InstallURLOptions } from '../install-url-options';
import type { StateStore } from './interface';
export interface FileStateStoreArgs {
    stateExpirationSeconds?: number;
    baseDir?: string;
    logger?: Logger;
}
export declare class FileStateStore implements StateStore {
    private baseDir;
    private stateExpirationSeconds;
    private logger;
    constructor(args: FileStateStoreArgs);
    generateStateParam(installOptions: InstallURLOptions, now: Date): Promise<string>;
    verifyStateParam(now: Date, state: string): Promise<InstallURLOptions>;
    private alreadyExists;
    private writeToFile;
    private readFile;
    private deleteFile;
}
//# sourceMappingURL=file-state-store.d.ts.map