"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetch = exports.AbortController = void 0;
var abort_controller_1 = require("abort-controller");
Object.defineProperty(exports, "AbortController", { enumerable: true, get: function () { return abort_controller_1.AbortController; } });
var node_fetch_1 = require("node-fetch");
Object.defineProperty(exports, "fetch", { enumerable: true, get: function () { return node_fetch_1.default; } });
