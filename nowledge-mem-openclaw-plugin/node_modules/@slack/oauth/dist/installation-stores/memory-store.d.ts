import type { Installation, InstallationQuery, InstallationStore } from '../index';
import type { Logger } from '../logger';
interface DevDatabase {
    [teamIdOrEnterpriseId: string]: Installation;
}
export default class MemoryInstallationStore implements InstallationStore {
    devDB: DevDatabase;
    storeInstallation(installation: Installation, logger?: Logger): Promise<void>;
    fetchInstallation(query: InstallationQuery<boolean>, logger?: Logger): Promise<Installation<'v1' | 'v2'>>;
    deleteInstallation(query: InstallationQuery<boolean>, logger?: Logger): Promise<void>;
}
export {};
//# sourceMappingURL=memory-store.d.ts.map