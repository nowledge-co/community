import * as http from "node:http";
import * as Types from "./types.js";
export type Request = http.IncomingMessage & {
    body: any;
};
export type Response = http.ServerResponse;
export type NextCallback = (err?: Error) => void;
export type Middleware = (req: Request, res: Response, next: NextCallback) => void | Promise<void>;
export default function middleware(config: Types.MiddlewareConfig): Middleware;
//# sourceMappingURL=middleware.d.ts.map