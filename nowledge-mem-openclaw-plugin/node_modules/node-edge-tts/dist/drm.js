"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecMsGecToken = exports.TRUSTED_CLIENT_TOKEN = exports.CHROMIUM_FULL_VERSION = void 0;
const node_crypto_1 = require("node:crypto");
exports.CHROMIUM_FULL_VERSION = '143.0.3650.75';
exports.TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WINDOWS_FILE_TIME_EPOCH = 11644473600n;
function generateSecMsGecToken() {
    const ticks = BigInt(Math.floor((Date.now() / 1000) + Number(WINDOWS_FILE_TIME_EPOCH))) * 10000000n;
    const roundedTicks = ticks - (ticks % 3000000000n);
    const strToHash = `${roundedTicks}${exports.TRUSTED_CLIENT_TOKEN}`;
    const hash = (0, node_crypto_1.createHash)('sha256');
    hash.update(strToHash, 'ascii');
    return hash.digest('hex').toUpperCase();
}
exports.generateSecMsGecToken = generateSecMsGecToken;
