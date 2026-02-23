import type { WebAPICallResult } from '../../WebClient';
export type AdminFunctionsListResponse = WebAPICallResult & {
    error?: string;
    functions?: Function[];
    needed?: string;
    ok?: boolean;
    provided?: string;
    response_metadata?: ResponseMetadata;
};
export interface Function {
    app_id?: string;
    callback_id?: string;
    category_id?: string;
    category_label?: string;
    date_created?: number;
    date_deleted?: number;
    date_released?: number;
    date_updated?: number;
    description?: string;
    form_enabled?: boolean;
    id?: string;
    input_parameters?: PutParameter[];
    output_parameters?: PutParameter[];
    title?: string;
    type?: string;
}
export interface PutParameter {
    description?: string;
    is_required?: boolean;
    name?: string;
    title?: string;
    type?: string;
}
export interface ResponseMetadata {
    messages?: string[];
    next_cursor?: string;
}
//# sourceMappingURL=AdminFunctionsListResponse.d.ts.map