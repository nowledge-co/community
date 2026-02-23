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
var _UpdateManager_hooks, _UpdateManager_isActive, _UpdateManager_isSuspended, _UpdateManager_lastLength, _UpdateManager_outside, _UpdateManager_terminal, _UpdateManager_wrapper;
import { Hook } from './Hook.js';
import { Terminal } from './Terminal.js';
import { Wrapper } from './Wrapper.js';
export class UpdateManager {
    constructor(stdout, stderr) {
        _UpdateManager_hooks.set(this, void 0);
        _UpdateManager_isActive.set(this, false);
        _UpdateManager_isSuspended.set(this, false);
        _UpdateManager_lastLength.set(this, 0);
        _UpdateManager_outside.set(this, 0);
        _UpdateManager_terminal.set(this, void 0);
        _UpdateManager_wrapper.set(this, void 0);
        __classPrivateFieldSet(this, _UpdateManager_hooks, [stdout, stderr].map((stream) => new Hook(stream)), "f");
        __classPrivateFieldSet(this, _UpdateManager_terminal, new Terminal(stdout), "f");
        __classPrivateFieldSet(this, _UpdateManager_wrapper, new Wrapper(), "f");
    }
    static getInstance(stdout = process.stdout, stderr = process.stderr) {
        if (!UpdateManager.instance)
            UpdateManager.instance = new UpdateManager(stdout, stderr);
        return UpdateManager.instance;
    }
    get lastLength() {
        return __classPrivateFieldGet(this, _UpdateManager_lastLength, "f");
    }
    get outside() {
        return __classPrivateFieldGet(this, _UpdateManager_outside, "f");
    }
    get isHooked() {
        return __classPrivateFieldGet(this, _UpdateManager_isActive, "f");
    }
    get isSuspended() {
        return __classPrivateFieldGet(this, _UpdateManager_isSuspended, "f");
    }
    erase(count = __classPrivateFieldGet(this, _UpdateManager_lastLength, "f")) {
        const [hook] = __classPrivateFieldGet(this, _UpdateManager_hooks, "f");
        if (hook)
            hook.erase(count);
    }
    hook() {
        if (!__classPrivateFieldGet(this, _UpdateManager_isActive, "f")) {
            __classPrivateFieldGet(this, _UpdateManager_hooks, "f").forEach(hook => hook.active());
            this.clear(true);
        }
        return __classPrivateFieldGet(this, _UpdateManager_isActive, "f");
    }
    resume(eraseRowCount) {
        if (__classPrivateFieldGet(this, _UpdateManager_isSuspended, "f")) {
            __classPrivateFieldSet(this, _UpdateManager_isSuspended, false, "f");
            if (eraseRowCount)
                this.erase(eraseRowCount);
            __classPrivateFieldSet(this, _UpdateManager_lastLength, 0, "f");
            __classPrivateFieldGet(this, _UpdateManager_hooks, "f").forEach(hook => hook.active());
        }
    }
    suspend(erase = true) {
        if (!__classPrivateFieldGet(this, _UpdateManager_isSuspended, "f")) {
            __classPrivateFieldSet(this, _UpdateManager_isSuspended, true, "f");
            if (erase)
                this.erase();
            __classPrivateFieldGet(this, _UpdateManager_hooks, "f").forEach(hook => hook.renew());
        }
    }
    unhook(separateHistory = true) {
        if (__classPrivateFieldGet(this, _UpdateManager_isActive, "f")) {
            __classPrivateFieldGet(this, _UpdateManager_hooks, "f").forEach(hook => hook.inactive(separateHistory));
            this.clear();
        }
        return !__classPrivateFieldGet(this, _UpdateManager_isActive, "f");
    }
    update(rows, from = 0) {
        if (rows.length) {
            const [hook] = __classPrivateFieldGet(this, _UpdateManager_hooks, "f");
            if (hook) {
                const { width, height } = __classPrivateFieldGet(this, _UpdateManager_terminal, "f");
                const position = from > height ? height - 1 : Math.max(0, Math.min(height - 1, from));
                const actualLength = this.lastLength - position;
                const outside = Math.max(actualLength - height, this.outside);
                let output = rows.reduce((acc, row) => acc.concat(__classPrivateFieldGet(this, _UpdateManager_wrapper, "f").wrap(row, width)), []);
                if (height <= actualLength) {
                    hook.erase(height);
                    if (position < outside)
                        output = output.slice(outside - position + 1);
                }
                else if (actualLength) {
                    hook.erase(actualLength);
                }
                hook.write(output.join(Terminal.EOL) + Terminal.EOL);
                __classPrivateFieldSet(this, _UpdateManager_lastLength, outside ? outside + output.length + 1 : output.length, "f");
                __classPrivateFieldSet(this, _UpdateManager_outside, Math.max(this.lastLength - height, this.outside), "f");
            }
        }
    }
    clear(status = false) {
        __classPrivateFieldSet(this, _UpdateManager_isActive, status, "f");
        __classPrivateFieldSet(this, _UpdateManager_lastLength, 0, "f");
        __classPrivateFieldSet(this, _UpdateManager_outside, 0, "f");
    }
}
_UpdateManager_hooks = new WeakMap(), _UpdateManager_isActive = new WeakMap(), _UpdateManager_isSuspended = new WeakMap(), _UpdateManager_lastLength = new WeakMap(), _UpdateManager_outside = new WeakMap(), _UpdateManager_terminal = new WeakMap(), _UpdateManager_wrapper = new WeakMap();
export default UpdateManager;
