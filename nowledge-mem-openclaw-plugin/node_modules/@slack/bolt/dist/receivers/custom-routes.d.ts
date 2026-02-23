/// <reference types="node" />
import type { ServerResponse } from 'node:http';
import type { ParamsIncomingMessage } from './ParamsIncomingMessage';
export interface CustomRoute {
    path: string;
    method: string | string[];
    handler: (req: ParamsIncomingMessage, res: ServerResponse) => void;
}
export interface ReceiverRoutes {
    [url: string]: {
        [method: string]: (req: ParamsIncomingMessage, res: ServerResponse) => void;
    };
}
export declare function buildReceiverRoutes(customRoutes: CustomRoute[]): ReceiverRoutes;
//# sourceMappingURL=custom-routes.d.ts.map