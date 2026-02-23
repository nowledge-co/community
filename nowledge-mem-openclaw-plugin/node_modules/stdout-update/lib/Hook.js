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
var _Hook_decoder, _Hook_history, _Hook_method, _Hook_stream;
import ansiEscapes from 'ansi-escapes';
import { StringDecoder } from 'string_decoder';
import { Terminal } from './Terminal.js';
export class Hook {
    constructor(stream) {
        _Hook_decoder.set(this, new StringDecoder());
        _Hook_history.set(this, []);
        _Hook_method.set(this, void 0);
        _Hook_stream.set(this, void 0);
        __classPrivateFieldSet(this, _Hook_method, stream.write, "f");
        __classPrivateFieldSet(this, _Hook_stream, stream, "f");
    }
    active() {
        this.write(ansiEscapes.cursorHide);
        __classPrivateFieldGet(this, _Hook_stream, "f").write = (data, ...args) => {
            const callback = args[args.length - 1];
            __classPrivateFieldGet(this, _Hook_history, "f").push(__classPrivateFieldGet(this, _Hook_decoder, "f").write(typeof data === 'string'
                ? Buffer.from(data, typeof args[0] === 'string' ? args[0] : undefined)
                : Buffer.from(data)));
            if (typeof callback === 'function')
                callback();
            return Hook.DRAIN;
        };
    }
    erase(count) {
        if (count > 0)
            this.write(ansiEscapes.eraseLines(count + 1));
    }
    inactive(separateHistory = false) {
        if (__classPrivateFieldGet(this, _Hook_history, "f").length) {
            if (separateHistory)
                this.write(Terminal.EOL);
            __classPrivateFieldGet(this, _Hook_history, "f").forEach(this.write, this);
            __classPrivateFieldSet(this, _Hook_history, [], "f");
        }
        this.renew();
    }
    renew() {
        __classPrivateFieldGet(this, _Hook_stream, "f").write = __classPrivateFieldGet(this, _Hook_method, "f");
        this.write(ansiEscapes.cursorShow);
    }
    write(msg) {
        __classPrivateFieldGet(this, _Hook_method, "f").apply(__classPrivateFieldGet(this, _Hook_stream, "f"), [msg]);
    }
}
_Hook_decoder = new WeakMap(), _Hook_history = new WeakMap(), _Hook_method = new WeakMap(), _Hook_stream = new WeakMap();
Hook.DRAIN = true;
