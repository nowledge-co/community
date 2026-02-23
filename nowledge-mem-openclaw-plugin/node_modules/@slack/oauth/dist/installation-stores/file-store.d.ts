import type { Installation, InstallationQuery, InstallationStore } from '../index';
import type { Logger } from '../logger';
export interface FileInstallationOptions {
    baseDir?: string;
    historicalDataEnabled?: boolean;
    clientId?: string;
}
export default class FileInstallationStore implements InstallationStore {
    private baseDir;
    private historicalDataEnabled;
    constructor({ baseDir, clientId, historicalDataEnabled, }?: FileInstallationOptions);
    storeInstallation(installation: Installation, logger?: Logger): Promise<void>;
    fetchInstallation(query: InstallationQuery<boolean>, logger?: Logger): Promise<Installation>;
    deleteInstallation(query: InstallationQuery<boolean>, logger?: Logger): Promise<void>;
    private getInstallationDir;
}
//# sourceMappingURL=file-store.d.ts.map