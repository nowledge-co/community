"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = defaultRenderHtmlForInstallPath;
function defaultRenderHtmlForInstallPath(addToSlackUrl) {
    return "<html>\n<head>\n<link rel=\"icon\" href=\"data:,\">\n<style>\nbody {\n  padding: 10px 15px;\n  font-family: verdana;\n  text-align: center;\n}\n</style>\n</head>\n<body>\n<h2>Slack App Installation</h2>\n<p><a href=\"".concat(addToSlackUrl, "\"><img alt=\"Add to Slack\" height=\"40\" width=\"139\" src=\"https://platform.slack-edge.com/img/add_to_slack.png\" srcset=\"https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x\" /></a></p>\n</body>\n</html>");
}
//# sourceMappingURL=default-render-html-for-install-path.js.map