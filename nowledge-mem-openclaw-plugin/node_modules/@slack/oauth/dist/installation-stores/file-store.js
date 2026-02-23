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
var node_fs_1 = __importDefault(require("node:fs"));
var node_os_1 = require("node:os");
var node_path_1 = __importDefault(require("node:path"));
var FileInstallationStore = /** @class */ (function () {
    function FileInstallationStore(_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.baseDir, baseDir = _c === void 0 ? "".concat((0, node_os_1.homedir)(), "/.bolt-js-app-installation") : _c, clientId = _b.clientId, _d = _b.historicalDataEnabled, historicalDataEnabled = _d === void 0 ? true : _d;
        this.baseDir = clientId !== undefined ? "".concat(baseDir, "/").concat(clientId) : baseDir;
        this.historicalDataEnabled = historicalDataEnabled;
    }
    FileInstallationStore.prototype.storeInstallation = function (installation, logger) {
        return __awaiter(this, void 0, void 0, function () {
            var enterprise, team, user, installationData, installationDir, dataForLogging, currentUTC;
            return __generator(this, function (_a) {
                enterprise = installation.enterprise, team = installation.team, user = installation.user;
                installationData = JSON.stringify(installation);
                installationDir = this.getInstallationDir(enterprise === null || enterprise === void 0 ? void 0 : enterprise.id, team === null || team === void 0 ? void 0 : team.id);
                if (logger !== undefined) {
                    dataForLogging = {
                        enterprise: enterprise,
                        team: team,
                        // user object can include token values
                        user: { id: user.id },
                    };
                    logger.info("Storing installation in ".concat(installationDir, " for ").concat(JSON.stringify(dataForLogging)));
                    logger.warn('FileInstallationStore is not intended for production purposes.');
                }
                // Create Installation Directory
                node_fs_1.default.mkdirSync(installationDir, { recursive: true });
                try {
                    writeToFile("".concat(installationDir, "/app-latest"), installationData);
                    writeToFile("".concat(installationDir, "/user-").concat(user.id, "-latest"), installationData);
                    if (this.historicalDataEnabled) {
                        currentUTC = Date.now();
                        writeToFile("".concat(installationDir, "/app-").concat(currentUTC), installationData);
                        writeToFile("".concat(installationDir, "/user-").concat(user.id, "-").concat(currentUTC), installationData);
                    }
                }
                catch (err) {
                    throw new Error("Failed to save installation to FileInstallationStore (error: ".concat(err, ")"));
                }
                return [2 /*return*/];
            });
        });
    };
    FileInstallationStore.prototype.fetchInstallation = function (query, logger) {
        return __awaiter(this, void 0, void 0, function () {
            var enterpriseId, teamId, isEnterpriseInstall, installationDir, data, installation, userData, userInstallation;
            return __generator(this, function (_a) {
                enterpriseId = query.enterpriseId, teamId = query.teamId, isEnterpriseInstall = query.isEnterpriseInstall;
                installationDir = this.getInstallationDir(enterpriseId, teamId, isEnterpriseInstall);
                if (logger !== undefined) {
                    logger.info("Retrieving installation from ".concat(installationDir, " with the following query: ").concat(JSON.stringify(query)));
                }
                if (isEnterpriseInstall && enterpriseId === undefined) {
                    throw new Error('enterpriseId is required to fetch data of an enterprise installation');
                }
                try {
                    data = node_fs_1.default.readFileSync(node_path_1.default.resolve("".concat(installationDir, "/app-latest")));
                    installation = JSON.parse(data.toString());
                    if (query.userId && installation.user.id !== query.userId) {
                        try {
                            userData = node_fs_1.default.readFileSync(node_path_1.default.resolve("".concat(installationDir, "/user-").concat(query.userId, "-latest")));
                            if (userData !== undefined && userData !== null) {
                                userInstallation = JSON.parse(userData.toString());
                                installation.user = userInstallation.user;
                            }
                        }
                        catch (_err) {
                            logger === null || logger === void 0 ? void 0 : logger.debug("The user-token installation for the request user (user_id: ".concat(query.userId, ") was not found."));
                            installation.user.token = undefined;
                            installation.user.refreshToken = undefined;
                            installation.user.expiresAt = undefined;
                            installation.user.scopes = undefined;
                        }
                    }
                    return [2 /*return*/, installation];
                }
                catch (_err) {
                    throw new Error("No installation data found (enterprise_id: ".concat(query.enterpriseId, ", team_id: ").concat(query.teamId, ", user_id: ").concat(query.userId, ")"));
                }
                return [2 /*return*/];
            });
        });
    };
    FileInstallationStore.prototype.deleteInstallation = function (query, logger) {
        return __awaiter(this, void 0, void 0, function () {
            var enterpriseId, teamId, userId, installationDir, filesToDelete, allFiles, userFiles, _i, filesToDelete_1, filePath;
            return __generator(this, function (_a) {
                enterpriseId = query.enterpriseId, teamId = query.teamId, userId = query.userId;
                installationDir = this.getInstallationDir(enterpriseId, teamId);
                if (logger !== undefined) {
                    logger.info("Deleting installations in ".concat(installationDir, " with the following query: ").concat(JSON.stringify(query)));
                }
                filesToDelete = [];
                if (userId === undefined) {
                    allFiles = node_fs_1.default.readdirSync(installationDir);
                    filesToDelete = filesToDelete.concat(allFiles);
                }
                else {
                    userFiles = node_fs_1.default.readdirSync(installationDir).filter(function (file) { return file.includes("user-".concat(userId, "-")); });
                    filesToDelete = filesToDelete.concat(userFiles);
                }
                try {
                    for (_i = 0, filesToDelete_1 = filesToDelete; _i < filesToDelete_1.length; _i++) {
                        filePath = filesToDelete_1[_i];
                        deleteFile(node_path_1.default.resolve("".concat(installationDir, "/").concat(filePath)));
                    }
                }
                catch (err) {
                    throw new Error("Failed to delete installation from FileInstallationStore (error: ".concat(err, ")"));
                }
                return [2 /*return*/];
            });
        });
    };
    FileInstallationStore.prototype.getInstallationDir = function (enterpriseId, teamId, isEnterpriseInstall) {
        if (enterpriseId === void 0) { enterpriseId = ''; }
        if (teamId === void 0) { teamId = ''; }
        if (isEnterpriseInstall === void 0) { isEnterpriseInstall = false; }
        var installDir = "".concat(this.baseDir, "/").concat(enterpriseId);
        if (teamId !== '' && !isEnterpriseInstall) {
            installDir += enterpriseId !== '' ? "-".concat(teamId) : "".concat(teamId);
        }
        return installDir;
    };
    return FileInstallationStore;
}());
exports.default = FileInstallationStore;
function writeToFile(filePath, data) {
    node_fs_1.default.writeFileSync(filePath, data);
}
function deleteFile(filePath) {
    node_fs_1.default.unlinkSync(node_path_1.default.resolve(filePath));
}
//# sourceMappingURL=file-store.js.map