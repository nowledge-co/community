export type SafeBinProfile = {
    minPositional?: number;
    maxPositional?: number;
    allowedValueFlags?: ReadonlySet<string>;
    deniedFlags?: ReadonlySet<string>;
};
export type SafeBinProfileFixture = {
    minPositional?: number;
    maxPositional?: number;
    allowedValueFlags?: readonly string[];
    deniedFlags?: readonly string[];
};
export type SafeBinProfileFixtures = Readonly<Record<string, SafeBinProfileFixture>>;
export declare const SAFE_BIN_PROFILE_FIXTURES: Record<string, SafeBinProfileFixture>;
export declare const SAFE_BIN_PROFILES: Record<string, SafeBinProfile>;
export declare function normalizeSafeBinProfileFixtures(fixtures?: SafeBinProfileFixtures | null): Record<string, SafeBinProfileFixture>;
export declare function resolveSafeBinProfiles(fixtures?: SafeBinProfileFixtures | null): Record<string, SafeBinProfile>;
export declare function resolveSafeBinDeniedFlags(fixtures?: Readonly<Record<string, SafeBinProfileFixture>>): Record<string, string[]>;
export declare function renderSafeBinDeniedFlagsDocBullets(fixtures?: Readonly<Record<string, SafeBinProfileFixture>>): string;
export declare function validateSafeBinArgv(args: string[], profile: SafeBinProfile): boolean;
