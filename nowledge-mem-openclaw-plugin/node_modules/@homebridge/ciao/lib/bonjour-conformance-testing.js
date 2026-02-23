"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
process.env.BCT = "yes"; // set bonjour conformance testing env (used to enable debug output)
const http_1 = tslib_1.__importDefault(require("http"));
const readline_1 = tslib_1.__importDefault(require("readline"));
const _1 = tslib_1.__importDefault(require("."));
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
});
// bct checks if the advertised service also has a tcp socket bound to
const server = http_1.default.createServer((req, res) => {
    res.writeHead(200, "OK");
    res.end("Hello world!\n");
});
server.listen(8085);
const responder = _1.default.getResponder();
const service = responder.createService({
    name: "My Test Service",
    port: 8085,
    type: "http" /* ServiceType.HTTP */,
    txt: {
        "test": "key",
        "test2": "key2",
        "ver": 1,
    },
});
server.on("listening", () => {
    service.advertise().then(() => {
        rl.question("What should the service name be changed to? [N to close]: ", answer => {
            if (!answer || answer.toLowerCase() === "n") {
                rl.close();
            }
            else {
                service.updateName(answer);
            }
        });
    });
});
const exitHandler = (signal) => {
    rl.close();
    responder.shutdown().then(() => {
        process.exit(128 + signal);
    });
};
process.on("SIGINT", exitHandler.bind(undefined, 2));
process.on("SIGTERM", exitHandler.bind(undefined, 15));
//# sourceMappingURL=bonjour-conformance-testing.js.map