import type { ReplyPayload } from "../../auto-reply/types.js";
import type { RuntimeEnv } from "../../runtime.js";
import type { createIMessageRpcClient } from "../client.js";
type SentMessageCache = {
    remember: (scope: string, text: string) => void;
};
export declare function deliverReplies(params: {
    replies: ReplyPayload[];
    target: string;
    client: Awaited<ReturnType<typeof createIMessageRpcClient>>;
    accountId?: string;
    runtime: RuntimeEnv;
    maxBytes: number;
    textLimit: number;
    sentMessageCache?: SentMessageCache;
}): Promise<void>;
export {};
