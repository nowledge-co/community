import type { Api, AssistantMessageEventStream, Context, Model, SimpleStreamOptions, StreamFunction, StreamOptions } from "./types.js";
export type ApiStreamFunction = (model: Model<Api>, context: Context, options?: StreamOptions) => AssistantMessageEventStream;
export type ApiStreamSimpleFunction = (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => AssistantMessageEventStream;
export interface ApiProvider<TApi extends Api = Api, TOptions extends StreamOptions = StreamOptions> {
    api: TApi;
    stream: StreamFunction<TApi, TOptions>;
    streamSimple: StreamFunction<TApi, SimpleStreamOptions>;
}
interface ApiProviderInternal {
    api: Api;
    stream: ApiStreamFunction;
    streamSimple: ApiStreamSimpleFunction;
}
export declare function registerApiProvider<TApi extends Api, TOptions extends StreamOptions>(provider: ApiProvider<TApi, TOptions>, sourceId?: string): void;
export declare function getApiProvider(api: Api): ApiProviderInternal | undefined;
export declare function getApiProviders(): ApiProviderInternal[];
export declare function unregisterApiProviders(sourceId: string): void;
export declare function clearApiProviders(): void;
export {};
//# sourceMappingURL=api-registry.d.ts.map