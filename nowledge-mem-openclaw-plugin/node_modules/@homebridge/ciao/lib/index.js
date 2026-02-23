"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Protocol = void 0;
exports.getResponder = getResponder;
const tslib_1 = require("tslib");
require("source-map-support/register"); // registering node-source-map-support for typescript stack traces
const debug_1 = tslib_1.__importDefault(require("debug"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const version = require("../package.json").version;
if (version.includes("beta") || process.env.BCT) { // enable debug output if beta version or running bonjour conformance testing
    const debug = process.env.DEBUG;
    if (!debug || !debug.includes("ciao")) {
        if (!debug) {
            debug_1.default.enable("ciao:*");
        }
        else {
            debug_1.default.enable(debug + ",ciao:*");
        }
    }
}
require("./coder/records/index");
const Responder_1 = require("./Responder");
tslib_1.__exportStar(require("./CiaoService"), exports);
tslib_1.__exportStar(require("./Responder"), exports);
function printInitInfo() {
    const debug = (0, debug_1.default)("ciao:init");
    debug("Loading ciao v" + version + "...");
}
printInitInfo();
/**
 * Defines the transport protocol of a service.
 *
 * As of RFC 6763 7. TCP must be used for any applications using tcp.
 *  For applications using any other transport protocol UDP must be used.
 *  This applies to all other transport protocols like SCTP, DCCP, RTMFP, etc
 */
var Protocol;
(function (Protocol) {
    Protocol["TCP"] = "tcp";
    Protocol["UDP"] = "udp";
})(Protocol || (exports.Protocol = Protocol = {}));
/**
 * This method is used to get a responder for the provided (optional) set of options.
 *
 * Ciao tries to create as few Responder instances as possible.
 * Thus, it will share the same Responder instance for the same set of options.
 *
 * @param options - If specified, the options will be passed to the underlying mdns server.
 * @returns A Responder instance for the given options. Might be shared with others using the same options.
 */
function getResponder(options) {
    return Responder_1.Responder.getResponder(options);
}
exports.default = {
    getResponder: getResponder,
};
//# sourceMappingURL=index.js.map