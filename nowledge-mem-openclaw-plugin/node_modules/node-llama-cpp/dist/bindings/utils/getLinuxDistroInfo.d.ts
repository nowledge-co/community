export type LinuxDistroInfo = Awaited<ReturnType<typeof getLinuxDistroInfo>>;
export declare function getLinuxDistroInfo(): Promise<{
    name: string;
    id: string;
    version: string;
    versionCodename: string;
    prettyName: string;
}>;
export declare function isDistroAlpineLinux(linuxDistroInfo: LinuxDistroInfo): Promise<boolean>;
