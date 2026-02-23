import { type AllAssistantMiddlewareArgs } from './Assistant';
export interface AssistantThreadContextStore {
    get: GetThreadContextFn;
    save: SaveThreadContextFn;
}
export type GetThreadContextFn = (args: AllAssistantMiddlewareArgs) => Promise<AssistantThreadContext>;
export type SaveThreadContextFn = (args: AllAssistantMiddlewareArgs) => Promise<void>;
export interface AssistantThreadContext {
    channel_id?: string;
    team_id?: string;
    enterprise_id?: string | null;
}
export declare class DefaultThreadContextStore implements AssistantThreadContextStore {
    private context;
    get(args: AllAssistantMiddlewareArgs): Promise<AssistantThreadContext>;
    save(args: AllAssistantMiddlewareArgs): Promise<void>;
}
//# sourceMappingURL=AssistantThreadContextStore.d.ts.map