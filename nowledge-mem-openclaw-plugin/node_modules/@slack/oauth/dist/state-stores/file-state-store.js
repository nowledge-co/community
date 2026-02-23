"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStateStore = void 0;
var node_fs_1 = __importDefault(require("node:fs"));
var node_os_1 = require("node:os");
var node_path_1 = __importDefault(require("node:path"));
var logger_1 = require("@slack/logger");
var errors_1 = require("../errors");
var FileStateStore = /** @class */ (function () {
    function FileStateStore(args) {
        this.baseDir = args.baseDir !== undefined ? args.baseDir : "".concat((0, node_os_1.homedir)(), "/.bolt-js-oauth-states");
        this.stateExpirationSeconds = args.stateExpirationSeconds !== undefined ? args.stateExpirationSeconds : 600;
        this.logger = args.logger !== undefined ? args.logger : new logger_1.ConsoleLogger();
    }
    FileStateStore.prototype.generateStateParam = function (installOptions, now) {
        return __awaiter(this, void 0, void 0, function () {
            var state, source;
            return __generator(this, function (_a) {
                state = generateRandomString();
                while (this.alreadyExists(state)) {
                    // Still race condition can arise here
                    state = generateRandomString();
                }
                source = { installOptions: installOptions, now: now };
                this.writeToFile(state, source);
                return [2 /*return*/, state];
            });
        });
    };
    FileStateStore.prototype.verifyStateParam = function (now, state) {
        return __awaiter(this, void 0, void 0, function () {
            var decoded, message, generatedAt, passedSeconds;
            return __generator(this, function (_a) {
                try {
                    decoded = void 0;
                    try {
                        decoded = this.readFile(state);
                    }
                    catch (e) {
                        message = "Failed to load the data represented by the state parameter (error: ".concat(e, ")");
                        throw new errors_1.InvalidStateError(message);
                    }
                    if (decoded !== undefined) {
                        generatedAt = new Date(decoded.now);
                        passedSeconds = Math.floor((now.getTime() - generatedAt.getTime()) / 1000);
                        if (passedSeconds > this.stateExpirationSeconds) {
                            throw new errors_1.InvalidStateError('The state value is already expired');
                        }
                        // return installOptions
                        return [2 /*return*/, decoded.installOptions];
                    }
                }
                finally {
                    this.deleteFile(state);
                }
                throw new errors_1.InvalidStateError('The state value is already expired');
            });
        });
    };
    // -------------------------------------------
    // private methods
    // -------------------------------------------
    FileStateStore.prototype.alreadyExists = function (filename) {
        var fullpath = node_path_1.default.resolve("".concat(this.baseDir, "/").concat(filename));
        return node_fs_1.default.existsSync(fullpath);
    };
    FileStateStore.prototype.writeToFile = function (filename, data) {
        node_fs_1.default.mkdirSync(this.baseDir, { recursive: true });
        var fullpath = node_path_1.default.resolve("".concat(this.baseDir, "/").concat(filename));
        node_fs_1.default.writeFileSync(fullpath, JSON.stringify(data));
    };
    FileStateStore.prototype.readFile = function (filename) {
        var fullpath = node_path_1.default.resolve("".concat(this.baseDir, "/").concat(filename));
        try {
            var data = node_fs_1.default.readFileSync(fullpath);
            if (data !== undefined) {
                return JSON.parse(data.toString());
            }
            return undefined;
        }
        catch (e) {
            this.logger.debug("Failed to load state data from file (error: ".concat(e, ")"));
            return undefined;
        }
    };
    FileStateStore.prototype.deleteFile = function (filename) {
        var fullpath = node_path_1.default.resolve("".concat(this.baseDir, "/").concat(filename));
        if (node_fs_1.default.existsSync(fullpath)) {
            node_fs_1.default.unlinkSync(fullpath);
        }
    };
    return FileStateStore;
}());
exports.FileStateStore = FileStateStore;
var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateRandomString(length) {
    if (length === void 0) { length = 10; }
    var generated = '';
    for (var i = 0; i < length; i += 1) {
        var position = Math.floor(Math.random() * chars.length);
        generated += chars.charAt(position);
    }
    return generated;
}
//# sourceMappingURL=file-state-store.js.map