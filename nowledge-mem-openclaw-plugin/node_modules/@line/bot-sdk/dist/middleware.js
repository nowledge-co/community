import { Buffer } from "node:buffer";
import { JSONParseError, SignatureValidationFailed } from "./exceptions.js";
import * as Types from "./types.js";
import validateSignature from "./validate-signature.js";
function isValidBody(body) {
    return (body && typeof body === "string") || Buffer.isBuffer(body);
}
const readRequestBody = async (req) => {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};
export default function middleware(config) {
    if (!config.channelSecret) {
        throw new Error("no channel secret");
    }
    const secret = config.channelSecret;
    const _middleware = async (req, res, next) => {
        // header names are lower-cased
        // https://nodejs.org/api/http.html#http_message_headers
        const signature = req.headers[Types.LINE_SIGNATURE_HTTP_HEADER_NAME];
        if (!signature) {
            next(new SignatureValidationFailed("no signature"));
            return;
        }
        const body = await (async () => {
            if (isValidBody(req.rawBody)) {
                // rawBody is provided in Google Cloud Functions and others
                return req.rawBody;
            }
            else if (isValidBody(req.body)) {
                return req.body;
            }
            else {
                // body may not be parsed yet, parse it to a buffer
                const rawBody = await readRequestBody(req);
                if (isValidBody(rawBody)) {
                    return rawBody;
                }
                else {
                    throw new JSONParseError("Invalid body", { raw: rawBody });
                }
            }
        })();
        const shouldSkipVerification = config.skipSignatureVerification && config.skipSignatureVerification();
        if (!shouldSkipVerification &&
            !validateSignature(body, secret, signature)) {
            next(new SignatureValidationFailed("signature validation failed", {
                signature,
            }));
            return;
        }
        const strBody = Buffer.isBuffer(body) ? body.toString() : body;
        try {
            req.body = JSON.parse(strBody);
            next();
        }
        catch (err) {
            const { message } = err;
            next(new JSONParseError(message, { raw: strBody }));
        }
    };
    return (req, res, next) => {
        _middleware(req, res, next).catch(next);
    };
}
//# sourceMappingURL=middleware.js.map