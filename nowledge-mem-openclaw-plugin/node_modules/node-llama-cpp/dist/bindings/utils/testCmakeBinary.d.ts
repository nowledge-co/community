import process from "process";
export declare function testCmakeBinary(cmakeBinaryPath?: string, { cwd, env }?: {
    cwd?: string;
    env?: typeof process.env;
}): Promise<boolean>;
