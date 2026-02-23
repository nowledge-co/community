import { BuildGpu } from "../types.js";
export declare function testBindingBinary(bindingBinaryPath: string, extBackendsPath: string | undefined, gpu: BuildGpu, testTimeout?: number, pipeOutputOnNode?: boolean): Promise<boolean>;
