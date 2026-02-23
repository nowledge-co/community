/**
 * On platforms other than Windows, this function will return an empty array
 * @returns Visual Studio edition installation paths - the paths are ordered from the most recent version to the oldest
 */
export declare function getWindowsVisualStudioEditionPaths(): Promise<{
    vsEditionPaths: string[];
    programFilesPaths: string[];
}>;
export declare function detectWindowsBuildTools(targetArch?: typeof process.arch): Promise<{
    hasCmake: boolean;
    hasNinja: boolean;
    hasLlvm: boolean;
    hasLibExe: boolean;
}>;
