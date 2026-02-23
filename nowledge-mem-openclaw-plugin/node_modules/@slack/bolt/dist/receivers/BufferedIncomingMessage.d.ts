/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import type { IncomingMessage } from 'node:http';
export interface BufferedIncomingMessage extends IncomingMessage {
    rawBody: Buffer;
}
//# sourceMappingURL=BufferedIncomingMessage.d.ts.map