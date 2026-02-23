export interface InstallationQuery<isEnterpriseInstall extends boolean> {
    teamId: isEnterpriseInstall extends false ? string : undefined;
    enterpriseId: isEnterpriseInstall extends true ? string : string | undefined;
    userId?: string;
    conversationId?: string;
    isEnterpriseInstall: isEnterpriseInstall;
}
export type OrgInstallationQuery = InstallationQuery<true>;
//# sourceMappingURL=installation-query.d.ts.map