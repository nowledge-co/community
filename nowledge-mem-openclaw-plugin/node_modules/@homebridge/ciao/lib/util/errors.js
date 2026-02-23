"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerClosedError = exports.InterfaceNotFoundError = exports.ERR_SERVER_CLOSED = exports.ERR_INTERFACE_NOT_FOUND = void 0;
exports.ERR_INTERFACE_NOT_FOUND = "ERR_INTERFACE_NOT_FOUND";
exports.ERR_SERVER_CLOSED = "ERR_SERVER_CLOSED";
class InterfaceNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "ERR_INTERFACE_NOT_FOUND";
    }
}
exports.InterfaceNotFoundError = InterfaceNotFoundError;
class ServerClosedError extends Error {
    constructor(message) {
        super(message);
        this.name = exports.ERR_SERVER_CLOSED;
    }
}
exports.ServerClosedError = ServerClosedError;
//# sourceMappingURL=errors.js.map