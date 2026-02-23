"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultCallbackSuccess = defaultCallbackSuccess;
exports.defaultCallbackFailure = defaultCallbackFailure;
exports.escapeHtml = escapeHtml;
var errors_1 = require("./errors");
// Default function to call when OAuth flow is successful
function defaultCallbackSuccess(installation, _options, _req, res) {
    var redirectUrl;
    if (isNotOrgInstall(installation) && installation.appId !== undefined) {
        // redirect back to Slack native app
        // Changes to the workspace app was installed to, to the app home
        redirectUrl = "slack://app?team=".concat(installation.team.id, "&id=").concat(installation.appId);
    }
    else if (isOrgInstall(installation)) {
        // redirect to Slack app management dashboard
        redirectUrl = "".concat(installation.enterpriseUrl, "manage/organization/apps/profile/").concat(installation.appId, "/workspaces/add");
    }
    else {
        // redirect back to Slack native app
        // does not change the workspace the slack client was last in
        redirectUrl = 'slack://open';
    }
    var browserUrl = redirectUrl;
    if (isNotOrgInstall(installation)) {
        browserUrl = "https://app.slack.com/client/".concat(installation.team.id);
    }
    var htmlResponse = "<html>\n  <head>\n  <meta http-equiv=\"refresh\" content=\"0; URL=".concat(escapeHtml(redirectUrl), "\">\n  <style>\n  body {\n    padding: 10px 15px;\n    font-family: verdana;\n    text-align: center;\n  }\n  </style>\n  </head>\n  <body>\n  <h2>Thank you!</h2>\n  <p>Redirecting to the Slack App... click <a href=\"").concat(escapeHtml(redirectUrl), "\">here</a>. If you use the browser version of Slack, click <a href=\"").concat(escapeHtml(browserUrl), "\" target=\"_blank\">this link</a> instead.</p>\n  </body>\n  </html>");
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlResponse);
}
// Default function to call when OAuth flow is unsuccessful
function defaultCallbackFailure(error, _options, _req, res) {
    var httpStatus;
    switch (error.code) {
        case errors_1.ErrorCode.MissingStateError:
        case errors_1.ErrorCode.InvalidStateError:
        case errors_1.ErrorCode.MissingCodeError:
            httpStatus = 400;
            break;
        default:
            httpStatus = 500;
    }
    res.writeHead(httpStatus, { 'Content-Type': 'text/html; charset=utf-8' });
    var html = "<html>\n  <head>\n  <style>\n  body {\n    padding: 10px 15px;\n    font-family: verdana;\n    text-align: center;\n  }\n  </style>\n  </head>\n  <body>\n  <h2>Oops, Something Went Wrong!</h2>\n  <p>Please try again or contact the app owner (reason: ".concat(escapeHtml(error.code), ")</p>\n  </body>\n  </html>");
    res.end(html);
}
// ------------------------------------------
// Internals
// ------------------------------------------
// Type guard to narrow Installation type to OrgInstallation
function isOrgInstall(installation) {
    return installation.isEnterpriseInstall || false;
}
function isNotOrgInstall(installation) {
    return !isOrgInstall(installation);
}
function escapeHtml(input) {
    if (input) {
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }
    return '';
}
//# sourceMappingURL=callback-options.js.map