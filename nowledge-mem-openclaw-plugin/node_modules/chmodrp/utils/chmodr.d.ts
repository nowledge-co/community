/// <reference types="node" />
import * as fs from 'node:fs';
export declare function chmodr(entryPath: string, mode: fs.Mode): Promise<void>;
export declare function chmodrSync(entryPath: string, mode: fs.Mode): void;
