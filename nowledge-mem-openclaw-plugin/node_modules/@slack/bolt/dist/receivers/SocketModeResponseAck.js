"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketModeResponseAck = void 0;
class SocketModeResponseAck {
    logger;
    isAcknowledged;
    // TODO: the SocketModeClient should expose its send method and it should be used to acknowledge rather then an arbitrary ack() function
    socketModeClientAck;
    constructor(args) {
        this.logger = args.logger;
        this.isAcknowledged = false;
        this.socketModeClientAck = args.socketModeClientAck;
        // TODO: a Timeout should be used to acknowledge the request after 3 seconds and mimic the HTTPReceiver behavior
    }
    bind() {
        return async (responseBody) => {
            this.logger.debug(`ack() call begins (body: ${JSON.stringify(responseBody)})`);
            if (this.isAcknowledged) {
                // TODO: (semver:major) this should throw a ReceiverMultipleAckError error instead of printing a debug message
                this.logger.warn('ack() has already been called. Additional calls will be ignored and may lead to errors in other receivers.');
                return;
            }
            this.isAcknowledged = true;
            await this.socketModeClientAck(responseBody);
            this.logger.debug(`ack() response sent (body: ${JSON.stringify(responseBody)})`);
        };
    }
}
exports.SocketModeResponseAck = SocketModeResponseAck;
//# sourceMappingURL=SocketModeResponseAck.js.map