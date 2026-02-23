"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryInstallationStore = exports.FileInstallationStore = void 0;
var file_store_1 = require("./file-store");
Object.defineProperty(exports, "FileInstallationStore", { enumerable: true, get: function () { return __importDefault(file_store_1).default; } });
var memory_store_1 = require("./memory-store");
Object.defineProperty(exports, "MemoryInstallationStore", { enumerable: true, get: function () { return __importDefault(memory_store_1).default; } });
//# sourceMappingURL=index.js.map