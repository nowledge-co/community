"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizationError = exports.UnknownError = exports.MissingCodeError = exports.InvalidStateError = exports.MissingStateError = exports.GenerateInstallUrlError = exports.InstallerInitializationError = exports.ErrorCode = void 0;
/**
 * A dictionary of codes for errors produced by this package.
 */
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["InstallerInitializationError"] = "slack_oauth_installer_initialization_error";
    ErrorCode["AuthorizationError"] = "slack_oauth_installer_authorization_error";
    ErrorCode["GenerateInstallUrlError"] = "slack_oauth_generate_url_error";
    ErrorCode["MissingStateError"] = "slack_oauth_missing_state";
    ErrorCode["InvalidStateError"] = "slack_oauth_invalid_state";
    ErrorCode["MissingCodeError"] = "slack_oauth_missing_code";
    ErrorCode["UnknownError"] = "slack_oauth_unknown_error";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
var InstallerInitializationError = /** @class */ (function (_super) {
    __extends(InstallerInitializationError, _super);
    function InstallerInitializationError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.code = ErrorCode.InstallerInitializationError;
        return _this;
    }
    return InstallerInitializationError;
}(Error));
exports.InstallerInitializationError = InstallerInitializationError;
var GenerateInstallUrlError = /** @class */ (function (_super) {
    __extends(GenerateInstallUrlError, _super);
    function GenerateInstallUrlError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.code = ErrorCode.GenerateInstallUrlError;
        return _this;
    }
    return GenerateInstallUrlError;
}(Error));
exports.GenerateInstallUrlError = GenerateInstallUrlError;
var MissingStateError = /** @class */ (function (_super) {
    __extends(MissingStateError, _super);
    function MissingStateError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.code = ErrorCode.MissingStateError;
        return _this;
    }
    return MissingStateError;
}(Error));
exports.MissingStateError = MissingStateError;
var InvalidStateError = /** @class */ (function (_super) {
    __extends(InvalidStateError, _super);
    function InvalidStateError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.code = ErrorCode.InvalidStateError;
        return _this;
    }
    return InvalidStateError;
}(Error));
exports.InvalidStateError = InvalidStateError;
var MissingCodeError = /** @class */ (function (_super) {
    __extends(MissingCodeError, _super);
    function MissingCodeError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.code = ErrorCode.MissingCodeError;
        return _this;
    }
    return MissingCodeError;
}(Error));
exports.MissingCodeError = MissingCodeError;
var UnknownError = /** @class */ (function (_super) {
    __extends(UnknownError, _super);
    function UnknownError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.code = ErrorCode.UnknownError;
        return _this;
    }
    return UnknownError;
}(Error));
exports.UnknownError = UnknownError;
var AuthorizationError = /** @class */ (function (_super) {
    __extends(AuthorizationError, _super);
    function AuthorizationError(message, original) {
        var _this = _super.call(this, message) || this;
        _this.code = ErrorCode.AuthorizationError;
        if (original !== undefined) {
            _this.original = original;
        }
        return _this;
    }
    return AuthorizationError;
}(Error));
exports.AuthorizationError = AuthorizationError;
//# sourceMappingURL=errors.js.map