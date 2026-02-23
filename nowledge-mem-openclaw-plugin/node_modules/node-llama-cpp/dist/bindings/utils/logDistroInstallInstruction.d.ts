type DistroPackages = {
    linuxPackages?: {
        apt?: string[];
        apk?: string[];
    };
    macOsPackages?: {
        brew?: string[];
    };
};
export declare function logDistroInstallInstruction(prefixText: string, distroPackages: DistroPackages, { forceLogPrefix }?: {
    forceLogPrefix?: boolean;
}): Promise<void>;
export declare function getDistroInstallInstruction({ linuxPackages, macOsPackages }: DistroPackages): Promise<string | null>;
export {};
