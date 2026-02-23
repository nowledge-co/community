import process from "process";
import chalk from "chalk";
export var ConsoleInteractionKey;
(function (ConsoleInteractionKey) {
    ConsoleInteractionKey["ctrlC"] = "\u0003";
    ConsoleInteractionKey["upArrow"] = "\u001B[A";
    ConsoleInteractionKey["downArrow"] = "\u001B[B";
    ConsoleInteractionKey["enter"] = "\r";
})(ConsoleInteractionKey || (ConsoleInteractionKey = {}));
export class ConsoleInteraction {
    /** @internal */ _keyCallbacks = new Map();
    /** @internal */ _stdin;
    /** @internal */ _isActive = false;
    constructor({ stdin = process.stdin } = {}) {
        this._stdin = stdin;
        this._onData = this._onData.bind(this);
    }
    get isActive() {
        return this._isActive;
    }
    start() {
        if (this._isActive)
            return;
        this._isActive = true;
        if (this._stdin.isTTY)
            this._stdin.setRawMode(true);
        this._stdin.on("data", this._onData);
        this._stdin.resume();
    }
    stop() {
        if (!this._isActive)
            return;
        this._isActive = false;
        if (this._stdin.isTTY)
            this._stdin.setRawMode(false);
        this._stdin.off("data", this._onData);
        this._stdin.pause();
    }
    onKey(key, callback) {
        if (typeof key === "string")
            key = [key];
        for (const k of key) {
            if (!this._keyCallbacks.has(k))
                this._keyCallbacks.set(k, []);
            this._keyCallbacks.get(k).push(callback);
        }
        return ConsoleInteractionOnKeyHandle._create(() => {
            for (const k of key) {
                const callbacks = this._keyCallbacks.get(k);
                if (callbacks == null)
                    continue;
                const index = callbacks.indexOf(callback);
                if (index >= 0)
                    callbacks.splice(index, 1);
            }
        });
    }
    /** @internal */
    _onData(data) {
        if (!this._isActive)
            return;
        const key = data.toString();
        const callbacks = this._keyCallbacks.get(key) ?? [];
        if (callbacks.length === 0 && key === ConsoleInteractionKey.ctrlC) {
            process.stdout.write("\n");
            this.stop();
            process.exit(0);
        }
        for (const callback of callbacks) {
            try {
                callback();
            }
            catch (err) {
                console.error(err);
            }
        }
    }
    static yesNoQuestion(question) {
        return new Promise((resolve) => {
            const interaction = new ConsoleInteraction();
            interaction.onKey(["Y", "y"], () => {
                resolve(true);
                interaction.stop();
                process.stdout.write("\n");
            });
            interaction.onKey(["N", "n"], () => {
                resolve(false);
                interaction.stop();
                process.stdout.write("\n");
            });
            console.log();
            process.stdout.write(question + " " + chalk.gray("(Y/n) "));
            interaction.start();
        });
    }
}
export class ConsoleInteractionOnKeyHandle {
    /** @internal */
    _dispose;
    constructor(dispose) {
        this._dispose = dispose;
        this.dispose = this.dispose.bind(this);
        this[Symbol.dispose] = this[Symbol.dispose].bind(this);
    }
    dispose() {
        if (this._dispose != null) {
            this._dispose();
            this._dispose = null;
        }
    }
    [Symbol.dispose]() {
        this.dispose();
    }
    get disposed() {
        return this._dispose == null;
    }
    /** @internal */
    static _create(dispose) {
        return new ConsoleInteractionOnKeyHandle(dispose);
    }
}
//# sourceMappingURL=ConsoleInteraction.js.map