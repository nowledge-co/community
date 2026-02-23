import { ISettings } from "./interfaces.js";
export declare function formatTemplate<LogObj>(settings: ISettings<LogObj>, template: string, values: Record<string, string | number>, hideUnsetPlaceholder?: boolean): string;
