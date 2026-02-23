import { BinaryPlatform } from "./getPlatform.js";
export declare function detectGlibc({ platform }: {
    platform: BinaryPlatform;
}): Promise<boolean>;
