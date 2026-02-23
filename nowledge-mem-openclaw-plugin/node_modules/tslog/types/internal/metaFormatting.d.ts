import { IMeta, ISettings } from "../interfaces.js";
export interface PrettyMetaRenderResult {
    text: string;
    template: string;
    placeholders: Record<string, string | number>;
}
export declare function buildPrettyMeta<LogObj>(settings: ISettings<LogObj>, meta?: IMeta): PrettyMetaRenderResult;
