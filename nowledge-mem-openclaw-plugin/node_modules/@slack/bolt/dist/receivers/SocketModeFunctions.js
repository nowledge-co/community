"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultProcessEventErrorHandler = void 0;
const errors_1 = require("../errors");
async function defaultProcessEventErrorHandler(args) {
    const { error, logger, event } = args;
    // TODO: more details like envelop_id, payload type etc. here
    // To make them available, we need to enhance underlying SocketModeClient
    // to return more properties to 'slack_event' listeners
    logger.error(`An unhandled error occurred while Bolt processed (type: ${event.body?.type}, error: ${error})`);
    logger.debug(`Error details: ${error}, retry num: ${event.retryNum}, retry reason: ${event.retryReason}`);
    if ((0, errors_1.isCodedError)(error) && error.code === errors_1.ErrorCode.AuthorizationError) {
        // The `authorize` function threw an exception, which means there is no valid installation data.
        // In this case, we can tell the Slack server-side to stop retries.
        return true;
    }
    return false;
}
exports.defaultProcessEventErrorHandler = defaultProcessEventErrorHandler;
//# sourceMappingURL=SocketModeFunctions.js.map