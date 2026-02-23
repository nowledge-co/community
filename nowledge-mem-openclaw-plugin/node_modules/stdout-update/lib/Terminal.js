var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Terminal_isWin32, _Terminal_stdout;
export class Terminal {
    constructor(stdout) {
        _Terminal_isWin32.set(this, process.platform === 'win32');
        _Terminal_stdout.set(this, void 0);
        __classPrivateFieldSet(this, _Terminal_stdout, stdout, "f");
    }
    get width() {
        return __classPrivateFieldGet(this, _Terminal_stdout, "f").columns ? this.adapt(__classPrivateFieldGet(this, _Terminal_stdout, "f").columns) : Terminal.COLUMNS;
    }
    get height() {
        return __classPrivateFieldGet(this, _Terminal_stdout, "f").rows ? this.adapt(__classPrivateFieldGet(this, _Terminal_stdout, "f").rows) : Terminal.ROWS;
    }
    adapt(value) {
        return __classPrivateFieldGet(this, _Terminal_isWin32, "f") ? value - 1 : value;
    }
}
_Terminal_isWin32 = new WeakMap(), _Terminal_stdout = new WeakMap();
Terminal.COLUMNS = 80;
Terminal.EOL = '\n';
Terminal.ROWS = 24;
