export declare function spawnCommand(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv, progressLogs?: boolean): Promise<{
    stdout: string;
    stderr: string;
    combinedStd: string;
}>;
export declare class SpawnError extends Error {
    readonly stdout: string;
    readonly stderr: string;
    readonly combinedStd: string;
    constructor(message: string, stdout: string, stderr: string, combinedStd: string);
}
