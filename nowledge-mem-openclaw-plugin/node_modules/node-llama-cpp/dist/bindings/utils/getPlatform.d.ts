export declare function getPlatform(): "aix" | "freebsd" | "haiku" | "linux" | "openbsd" | "sunos" | "netbsd" | "win" | "mac";
export type BinaryPlatform = ReturnType<typeof getPlatform>;
