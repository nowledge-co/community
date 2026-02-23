import type { Logger } from '@slack/logger';
import type { WebClient } from '@slack/web-api';
import type { AnyMiddlewareArgs, Context, Middleware } from '../types';
export default function processMiddleware(middleware: Middleware<AnyMiddlewareArgs>[], initialArgs: AnyMiddlewareArgs, context: Context, client: WebClient, logger: Logger, last: () => Promise<void>): Promise<void>;
//# sourceMappingURL=process.d.ts.map