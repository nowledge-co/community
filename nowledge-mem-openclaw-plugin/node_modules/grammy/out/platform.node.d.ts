import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import { Readable } from "stream";
export { debug } from "debug";
export declare const itrToStream: (itr: AsyncIterable<Uint8Array>) => Readable;
export declare function baseFetchConfig(apiRoot: string): {
    compress: boolean;
    agent: HttpsAgent;
} | {
    agent: HttpAgent;
    compress?: undefined;
} | {
    compress?: undefined;
    agent?: undefined;
};
export declare const defaultAdapter = "express";
