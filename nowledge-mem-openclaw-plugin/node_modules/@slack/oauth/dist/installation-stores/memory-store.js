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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Default Install Store. Should only be used for development
var MemoryInstallationStore = /** @class */ (function () {
    function MemoryInstallationStore() {
        this.devDB = {};
    }
    MemoryInstallationStore.prototype.storeInstallation = function (installation, logger) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // NOTE: installations on a single workspace that happen to be within an enterprise organization are stored by
                // the team ID as the key
                // TODO: what about installations on an enterprise (acting as a single workspace) with `admin` scope, which is not
                // an org install?
                if (logger !== undefined) {
                    logger.warn('Storing Access Token. Please use a real Installation Store for production!');
                }
                if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
                    if (logger !== undefined) {
                        logger.debug('storing org installation');
                    }
                    this.devDB[installation.enterprise.id] = installation;
                }
                else if (!installation.isEnterpriseInstall && installation.team !== undefined) {
                    if (logger !== undefined) {
                        logger.debug('storing single team installation');
                    }
                    this.devDB[installation.team.id] = installation;
                }
                else {
                    throw new Error('Failed saving installation data to installationStore');
                }
                return [2 /*return*/];
            });
        });
    };
    MemoryInstallationStore.prototype.fetchInstallation = function (query, logger) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (logger !== undefined) {
                    logger.warn('Retrieving Access Token from DB. Please use a real Installation Store for production!');
                }
                if (query.isEnterpriseInstall) {
                    if (query.enterpriseId !== undefined) {
                        if (logger !== undefined) {
                            logger.debug('fetching org installation');
                        }
                        return [2 /*return*/, this.devDB[query.enterpriseId]];
                    }
                }
                if (query.teamId !== undefined) {
                    if (logger !== undefined) {
                        logger.debug('fetching single team installation');
                    }
                    return [2 /*return*/, this.devDB[query.teamId]];
                }
                throw new Error('Failed fetching installation');
            });
        });
    };
    MemoryInstallationStore.prototype.deleteInstallation = function (query, logger) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _, devDB, _c, _d, _, devDB;
            return __generator(this, function (_e) {
                if (logger !== undefined) {
                    logger.warn('Deleting Access Token from DB. Please use a real Installation Store for production!');
                }
                if (query.isEnterpriseInstall && query.enterpriseId !== undefined) {
                    if (logger !== undefined) {
                        logger.debug('deleting org installation');
                    }
                    _a = this.devDB, _b = query.enterpriseId, _ = _a[_b], devDB = __rest(_a, [typeof _b === "symbol" ? _b : _b + ""]);
                    this.devDB = devDB;
                }
                else if (query.teamId !== undefined) {
                    if (logger !== undefined) {
                        logger.debug('deleting single team installation');
                    }
                    _c = this.devDB, _d = query.teamId, _ = _c[_d], devDB = __rest(_c, [typeof _d === "symbol" ? _d : _d + ""]);
                    this.devDB = devDB;
                }
                else {
                    throw new Error('Failed to delete installation');
                }
                return [2 /*return*/];
            });
        });
    };
    return MemoryInstallationStore;
}());
exports.default = MemoryInstallationStore;
//# sourceMappingURL=memory-store.js.map