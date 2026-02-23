import "./providers/register-builtins.js";
import "./utils/http-proxy.js";
import type { Api, AssistantMessage, AssistantMessageEventStream, Context, Model, ProviderStreamOptions, SimpleStreamOptions } from "./types.js";
export { getEnvApiKey } from "./env-api-keys.js";
export declare function stream<TApi extends Api>(model: Model<TApi>, context: Context, options?: ProviderStreamOptions): AssistantMessageEventStream;
export declare function complete<TApi extends Api>(model: Model<TApi>, context: Context, options?: ProviderStreamOptions): Promise<AssistantMessage>;
export declare function streamSimple<TApi extends Api>(model: Model<TApi>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;
export declare function completeSimple<TApi extends Api>(model: Model<TApi>, context: Context, options?: SimpleStreamOptions): Promise<AssistantMessage>;
//# sourceMappingURL=stream.d.ts.map